import type { AnalyzeContentMessage } from '@autobiography/types';
import Anthropic from '@anthropic-ai/sdk';

interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  PROGRESS_TRACKER: DurableObjectNamespace;
  CLAUDE_API_KEY: string;
  ENVIRONMENT: string;
}

interface QueueBatch {
  messages: Message<AnalyzeContentMessage>[];
}

export default {
  async queue(batch: QueueBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await analyzeContent(message.body, env);
        message.ack();
      } catch (error) {
        console.error('Failed to analyze content:', message.body.contentId, error);
        message.retry();
      }
    }
  },
};

async function analyzeContent(msg: AnalyzeContentMessage, env: Env): Promise<void> {
  const { contentId, projectId } = msg;

  // Get content from database
  const content = await env.DB.prepare(`
    SELECT c.id, c.content_type, c.extracted_text, c.metadata, f.original_name
    FROM content c
    JOIN files f ON f.id = c.file_id
    WHERE c.id = ?
  `)
    .bind(contentId)
    .first();

  if (!content) {
    throw new Error(`Content not found: ${contentId}`);
  }

  // Update progress
  await updateProgress(env, projectId, {
    stage: 'analyze',
    progress: 50,
    message: `Analyzing ${content.original_name}...`,
  });

  // Prepare content for analysis
  const metadata = content.metadata ? JSON.parse(content.metadata as string) : {};
  const textToAnalyze = (content.extracted_text as string) ||
    `[${content.content_type}: ${content.original_name}]`;

  // Call Claude for analysis
  const analysis = await callClaudeForAnalysis(
    textToAnalyze,
    content.content_type as string,
    metadata,
    env.CLAUDE_API_KEY
  );

  // Auto-select content with good narrative value (>= 6)
  const shouldSelect = analysis.narrative_value >= 6;

  // Update content with analysis and auto-selection
  await env.DB.prepare(
    'UPDATE content SET analysis = ?, is_selected = ? WHERE id = ?'
  )
    .bind(JSON.stringify(analysis), shouldSelect ? 1 : 0, contentId)
    .run();

  // Send discovery if high narrative value
  if (analysis.narrative_value >= 7) {
    await sendDiscovery(env, projectId, {
      type: 'gem',
      preview: `Found a gem: ${textToAnalyze.slice(0, 80)}...`,
    });
  }

  // Update progress
  await updateProgress(env, projectId, {
    stage: 'analyze',
    progress: 100,
    message: `Analysis complete for ${content.original_name}`,
  });
}

interface AnalysisResult {
  narrative_value: number;
  emotional_impact: number;
  uniqueness: number;
  clarity: number;
  historical_significance: number;
  themes: string[];
  timeline_placement?: {
    estimated_date?: string;
    life_phase?: string;
    confidence: number;
  };
  connections: string[];
  suggested_chapter?: string;
}

async function callClaudeForAnalysis(
  text: string,
  contentType: string,
  metadata: Record<string, unknown>,
  apiKey: string
): Promise<AnalysisResult> {
  const anthropic = new Anthropic({
    apiKey,
  });

  const systemPrompt = `You are a life story analyst. Given content from someone's personal files, you must:

1. Identify narrative potential (is this a story worth telling?)
2. Detect emotional significance (milestones, achievements, challenges)
3. Place content on a timeline (when did this happen?)
4. Identify recurring themes, people, and places
5. Suggest which chapter this might belong to

Score each dimension from 1-10:
- narrative_value: Does this tell a compelling story?
- emotional_impact: Does this evoke strong feelings?
- uniqueness: Is this distinct from typical content?
- clarity: How clear and understandable is this?
- historical_significance: Is this a major life milestone?

Consider the full human experience: major events AND everyday moments.

Respond with valid JSON only, no markdown or explanation.`;

  const userPrompt = `Analyze this ${contentType} content:

Content: ${text.slice(0, 2000)}

Metadata: ${JSON.stringify(metadata)}

Respond with JSON in this exact format:
{
  "narrative_value": <1-10>,
  "emotional_impact": <1-10>,
  "uniqueness": <1-10>,
  "clarity": <1-10>,
  "historical_significance": <1-10>,
  "themes": ["theme1", "theme2"],
  "timeline_placement": {
    "estimated_date": "YYYY-MM-DD or null",
    "life_phase": "childhood|school|college|early_career|etc or null",
    "confidence": <0-1>
  },
  "connections": [],
  "suggested_chapter": "Chapter title or null"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const responseText = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Parse JSON response
    const parsed = JSON.parse(responseText) as AnalysisResult;

    // Validate and ensure all required fields
    return {
      narrative_value: clamp(parsed.narrative_value || 5, 1, 10),
      emotional_impact: clamp(parsed.emotional_impact || 5, 1, 10),
      uniqueness: clamp(parsed.uniqueness || 5, 1, 10),
      clarity: clamp(parsed.clarity || 5, 1, 10),
      historical_significance: clamp(parsed.historical_significance || 5, 1, 10),
      themes: parsed.themes || [],
      timeline_placement: parsed.timeline_placement,
      connections: parsed.connections || [],
      suggested_chapter: parsed.suggested_chapter,
    };
  } catch (error) {
    console.error('Claude analysis error:', error);
    // Return default scores on error
    return {
      narrative_value: 5,
      emotional_impact: 5,
      uniqueness: 5,
      clarity: 5,
      historical_significance: 5,
      themes: [],
      connections: [],
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Helper to update progress via Durable Object
async function updateProgress(
  env: Env,
  projectId: string,
  data: { stage: string; progress: number; message: string }
): Promise<void> {
  try {
    const id = env.PROGRESS_TRACKER.idFromName(projectId);
    const tracker = env.PROGRESS_TRACKER.get(id);
    await tracker.fetch('https://internal/update', {
      method: 'POST',
      body: JSON.stringify({ projectId, ...data }),
    });
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
}

// Helper to send discovery notification
async function sendDiscovery(
  env: Env,
  projectId: string,
  data: { type: string; preview: string }
): Promise<void> {
  try {
    const id = env.PROGRESS_TRACKER.idFromName(projectId);
    const tracker = env.PROGRESS_TRACKER.get(id);
    await tracker.fetch('https://internal/discovery', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('Failed to send discovery:', error);
  }
}
