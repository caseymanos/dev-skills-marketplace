/**
 * WebSocket Protocol Schema
 *
 * Defines message formats for client-server real-time synchronization.
 * All messages are JSON-encoded with a discriminated union on the `type` field.
 *
 * Owner: Shared (agent-sync implements server, agent-ui implements client)
 * Version: 1.0.0
 */

import type { ObjectId, DocumentId, UserId, Point, Color } from './wasm-api';

// =============================================================================
// MESSAGE ENVELOPE
// =============================================================================

/**
 * All WebSocket messages follow this envelope structure.
 */
export interface MessageEnvelope<T extends MessageType, P> {
  /** Message type discriminator */
  type: T;

  /** Unique message ID for request/response correlation */
  messageId: string;

  /** Timestamp (ISO 8601) */
  timestamp: string;

  /** Payload specific to message type */
  payload: P;
}

// =============================================================================
// MESSAGE TYPES
// =============================================================================

export type MessageType =
  // Connection lifecycle
  | 'join_document'
  | 'join_document_ack'
  | 'leave_document'
  | 'leave_document_ack'
  | 'error'

  // Document sync
  | 'sync_request'
  | 'sync_response'
  | 'change'
  | 'change_ack'

  // Presence
  | 'presence_update'
  | 'presence_broadcast'
  | 'cursor_move'
  | 'cursor_broadcast'
  | 'selection_update'
  | 'selection_broadcast'

  // Document management
  | 'document_snapshot'
  | 'document_history';

// =============================================================================
// CONNECTION LIFECYCLE MESSAGES
// =============================================================================

/**
 * Client -> Server: Request to join a document session
 */
export type JoinDocumentMessage = MessageEnvelope<
  'join_document',
  {
    documentId: DocumentId;
    userId: UserId;
    displayName: string;
    color: Color;
    /** Client's current document version (for sync) */
    clientVersion?: string;
  }
>;

/**
 * Server -> Client: Acknowledgment of join request
 */
export type JoinDocumentAckMessage = MessageEnvelope<
  'join_document_ack',
  {
    success: boolean;
    /** Session token for subsequent requests */
    sessionToken?: string;
    /** Current document state (Automerge bytes, base64 encoded) */
    documentState?: string;
    /** Current document version */
    documentVersion: string;
    /** List of currently connected users */
    connectedUsers: UserPresence[];
    /** Error message if success is false */
    error?: string;
  }
>;

/**
 * Client -> Server: Request to leave a document session
 */
export type LeaveDocumentMessage = MessageEnvelope<
  'leave_document',
  {
    documentId: DocumentId;
    sessionToken: string;
  }
>;

/**
 * Server -> Client: Acknowledgment of leave request
 */
export type LeaveDocumentAckMessage = MessageEnvelope<
  'leave_document_ack',
  {
    success: boolean;
  }
>;

/**
 * Server -> Client: Error message
 */
export type ErrorMessage = MessageEnvelope<
  'error',
  {
    code: ErrorCode;
    message: string;
    /** Original message ID that caused the error */
    originalMessageId?: string;
  }
>;

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'DOCUMENT_NOT_FOUND'
  | 'INVALID_MESSAGE'
  | 'SYNC_CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

// =============================================================================
// DOCUMENT SYNC MESSAGES
// =============================================================================

/**
 * Client -> Server: Request full document sync
 */
export type SyncRequestMessage = MessageEnvelope<
  'sync_request',
  {
    documentId: DocumentId;
    sessionToken: string;
    /** Client's current heads (Automerge) */
    clientHeads: string[];
  }
>;

/**
 * Server -> Client: Sync response with missing changes
 */
export type SyncResponseMessage = MessageEnvelope<
  'sync_response',
  {
    /** Changes client is missing (base64 encoded Automerge changes) */
    changes: string[];
    /** Server's current heads after sync */
    serverHeads: string[];
    /** Whether more changes are available (pagination) */
    hasMore: boolean;
  }
>;

/**
 * Client -> Server: Local change to apply
 */
export type ChangeMessage = MessageEnvelope<
  'change',
  {
    documentId: DocumentId;
    sessionToken: string;
    /** Automerge change bytes (base64 encoded) */
    change: string;
    /** Client's heads before this change */
    baseHeads: string[];
    /** Sequence number for ordering */
    sequence: number;
  }
>;

/**
 * Server -> Client: Acknowledgment of change
 */
export type ChangeAckMessage = MessageEnvelope<
  'change_ack',
  {
    /** Original change sequence number */
    sequence: number;
    /** Whether the change was accepted */
    accepted: boolean;
    /** Server's current heads after applying */
    serverHeads: string[];
    /** If rejected, the reason */
    rejectionReason?: string;
  }
>;

/**
 * Server -> Client: Broadcast of change from another client
 */
export type ChangeBroadcastMessage = MessageEnvelope<
  'change',
  {
    /** User who made the change */
    userId: UserId;
    /** Automerge change bytes (base64 encoded) */
    change: string;
    /** Server heads after this change */
    serverHeads: string[];
  }
>;

// =============================================================================
// PRESENCE MESSAGES
// =============================================================================

/**
 * User presence information
 */
export interface UserPresence {
  userId: UserId;
  displayName: string;
  color: Color;
  status: 'active' | 'idle' | 'away';
  /** Last activity timestamp */
  lastActive: string;
  /** Current cursor position (if available) */
  cursor?: Point;
  /** Current selection (if available) */
  selection?: ObjectId[];
}

/**
 * Client -> Server: Update own presence
 */
export type PresenceUpdateMessage = MessageEnvelope<
  'presence_update',
  {
    documentId: DocumentId;
    sessionToken: string;
    status: 'active' | 'idle' | 'away';
  }
>;

/**
 * Server -> Client: Broadcast presence changes
 */
export type PresenceBroadcastMessage = MessageEnvelope<
  'presence_broadcast',
  {
    /** Type of presence event */
    event: 'user_joined' | 'user_left' | 'user_updated';
    user: UserPresence;
  }
>;

/**
 * Client -> Server: Update cursor position
 * Sent at high frequency during mouse movement
 */
export type CursorMoveMessage = MessageEnvelope<
  'cursor_move',
  {
    documentId: DocumentId;
    sessionToken: string;
    position: Point;
  }
>;

/**
 * Server -> Client: Broadcast cursor positions
 * Throttled to ~30fps per user
 */
export type CursorBroadcastMessage = MessageEnvelope<
  'cursor_broadcast',
  {
    userId: UserId;
    position: Point;
  }
>;

/**
 * Client -> Server: Update selection
 */
export type SelectionUpdateMessage = MessageEnvelope<
  'selection_update',
  {
    documentId: DocumentId;
    sessionToken: string;
    selectedIds: ObjectId[];
  }
>;

/**
 * Server -> Client: Broadcast selection changes
 */
export type SelectionBroadcastMessage = MessageEnvelope<
  'selection_broadcast',
  {
    userId: UserId;
    selectedIds: ObjectId[];
  }
>;

// =============================================================================
// DOCUMENT MANAGEMENT MESSAGES
// =============================================================================

/**
 * Server -> Client: Full document snapshot
 * Sent on initial load or for recovery
 */
export type DocumentSnapshotMessage = MessageEnvelope<
  'document_snapshot',
  {
    documentId: DocumentId;
    /** Full Automerge document (base64 encoded) */
    document: string;
    /** Document version */
    version: string;
    /** Document metadata */
    metadata: {
      title: string;
      createdAt: string;
      updatedAt: string;
      ownerId: UserId;
    };
  }
>;

/**
 * Client -> Server: Request document history
 */
export type DocumentHistoryRequestMessage = MessageEnvelope<
  'document_history',
  {
    documentId: DocumentId;
    sessionToken: string;
    /** Number of history entries to fetch */
    limit: number;
    /** Offset for pagination */
    offset: number;
  }
>;

// =============================================================================
// UNION TYPE FOR ALL MESSAGES
// =============================================================================

export type ClientMessage =
  | JoinDocumentMessage
  | LeaveDocumentMessage
  | SyncRequestMessage
  | ChangeMessage
  | PresenceUpdateMessage
  | CursorMoveMessage
  | SelectionUpdateMessage
  | DocumentHistoryRequestMessage;

export type ServerMessage =
  | JoinDocumentAckMessage
  | LeaveDocumentAckMessage
  | ErrorMessage
  | SyncResponseMessage
  | ChangeAckMessage
  | ChangeBroadcastMessage
  | PresenceBroadcastMessage
  | CursorBroadcastMessage
  | SelectionBroadcastMessage
  | DocumentSnapshotMessage;

export type WebSocketMessage = ClientMessage | ServerMessage;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a message envelope
 */
export function createMessage<T extends MessageType, P>(
  type: T,
  payload: P
): MessageEnvelope<T, P> {
  return {
    type,
    messageId: generateMessageId(),
    timestamp: new Date().toISOString(),
    payload,
  };
}

/**
 * Type guard for checking message type
 */
export function isMessageType<T extends MessageType>(
  message: WebSocketMessage,
  type: T
): message is Extract<WebSocketMessage, { type: T }> {
  return message.type === type;
}

// =============================================================================
// PROTOCOL CONSTANTS
// =============================================================================

export const PROTOCOL = {
  /** Current protocol version */
  VERSION: '1.0.0',

  /** WebSocket subprotocol name */
  SUBPROTOCOL: 'canvas-sync-v1',

  /** Heartbeat interval in milliseconds */
  HEARTBEAT_INTERVAL: 30000,

  /** Cursor broadcast throttle in milliseconds */
  CURSOR_THROTTLE: 33, // ~30fps

  /** Maximum message size in bytes */
  MAX_MESSAGE_SIZE: 10 * 1024 * 1024, // 10MB

  /** Reconnection delays (exponential backoff) */
  RECONNECT_DELAYS: [1000, 2000, 4000, 8000, 16000, 32000],
} as const;
