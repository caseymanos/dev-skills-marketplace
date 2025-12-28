// ProgressTracker Durable Object
// Handles real-time progress updates for project processing

interface ProgressState {
  projectId: string;
  currentStage: string;
  progress: number;
  message: string;
  discoveries: Array<{
    type: string;
    preview: string;
    timestamp: number;
  }>;
  lastUpdate: number;
}

export class ProgressTracker implements DurableObject {
  private state: DurableObjectState;
  private sessions: Map<string, WebSocket>;
  private progressState: ProgressState | null;
  private initialized: boolean;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sessions = new Map();
    this.progressState = null;
    this.initialized = false;

    // Initialize state from storage on construction
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<ProgressState>('progress');
      if (stored) {
        this.progressState = stored;
      }
      this.initialized = true;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    switch (path) {
      case '/sse':
        return this.handleSSE(request);
      case '/ws':
        return this.handleWebSocket(request);
      case '/update':
        return this.handleUpdate(request);
      case '/discovery':
        return this.handleDiscovery(request);
      case '/complete':
        return this.handleComplete(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  // SSE endpoint for progress streaming
  private handleSSE(request: Request): Response {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Send initial state if exists
    if (this.progressState) {
      writer.write(
        encoder.encode(
          `event: stage\ndata: ${JSON.stringify({
            stage: this.progressState.currentStage,
            progress: this.progressState.progress,
            message: this.progressState.message,
          })}\n\n`
        )
      );

      // Send recent discoveries
      for (const discovery of this.progressState.discoveries.slice(-10)) {
        writer.write(
          encoder.encode(
            `event: discovery\ndata: ${JSON.stringify(discovery)}\n\n`
          )
        );
      }
    }

    // Store writer for future updates
    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, {
      send: (data: string) => writer.write(encoder.encode(data)),
      close: () => writer.close(),
    } as unknown as WebSocket);

    // Clean up on connection close
    request.signal.addEventListener('abort', () => {
      this.sessions.delete(sessionId);
      writer.close();
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // WebSocket endpoint for bidirectional communication
  private handleWebSocket(request: Request): Response {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket
    server.accept();

    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, server);

    // Send initial state
    if (this.progressState) {
      server.send(
        JSON.stringify({
          type: 'state',
          data: this.progressState,
        })
      );
    }

    // Handle messages from client
    server.addEventListener('message', (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data as string);
        // Handle ping/pong for keepalive
        if (message.type === 'ping') {
          server.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // Ignore invalid messages
      }
    });

    // Clean up on close
    server.addEventListener('close', () => {
      this.sessions.delete(sessionId);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // Update progress from queue workers
  private async handleUpdate(request: Request): Promise<Response> {
    const body = await request.json() as {
      projectId: string;
      stage: string;
      progress: number;
      message: string;
    };

    this.progressState = {
      projectId: body.projectId,
      currentStage: body.stage,
      progress: body.progress,
      message: body.message,
      discoveries: this.progressState?.discoveries || [],
      lastUpdate: Date.now(),
    };

    // Persist state
    await this.state.storage.put('progress', this.progressState);

    // Broadcast to all sessions
    const event = `event: stage\ndata: ${JSON.stringify({
      stage: body.stage,
      progress: body.progress,
      message: body.message,
    })}\n\n`;

    this.broadcast(event);

    return new Response('OK');
  }

  // Add a discovery notification
  private async handleDiscovery(request: Request): Promise<Response> {
    const body = await request.json() as {
      type: string;
      preview: string;
    };

    const discovery = {
      type: body.type,
      preview: body.preview,
      timestamp: Date.now(),
    };

    if (!this.progressState) {
      this.progressState = {
        projectId: '',
        currentStage: 'parsing',
        progress: 0,
        message: '',
        discoveries: [],
        lastUpdate: Date.now(),
      };
    }

    // Keep only last 100 discoveries
    this.progressState.discoveries.push(discovery);
    if (this.progressState.discoveries.length > 100) {
      this.progressState.discoveries = this.progressState.discoveries.slice(-100);
    }

    await this.state.storage.put('progress', this.progressState);

    // Broadcast discovery
    const event = `event: discovery\ndata: ${JSON.stringify(discovery)}\n\n`;
    this.broadcast(event);

    return new Response('OK');
  }

  // Mark processing as complete
  private async handleComplete(request: Request): Promise<Response> {
    const body = await request.json() as {
      status: 'success' | 'error';
      nextStage?: string;
      error?: string;
    };

    // Broadcast completion
    const event = `event: complete\ndata: ${JSON.stringify(body)}\n\n`;
    this.broadcast(event);

    // Clear state after a delay (keep for late connections)
    setTimeout(async () => {
      this.progressState = null;
      await this.state.storage.delete('progress');
    }, 60000); // 1 minute

    return new Response('OK');
  }

  // Broadcast message to all connected sessions
  private broadcast(message: string): void {
    for (const [sessionId, session] of this.sessions) {
      try {
        if ('send' in session && typeof session.send === 'function') {
          // WebSocket
          session.send(message);
        }
      } catch {
        // Remove dead sessions
        this.sessions.delete(sessionId);
      }
    }
  }

}
