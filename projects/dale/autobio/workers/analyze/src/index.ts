import type { AnalyzeContentMessage, AnalyzeProjectMessage } from '@autobiography/types';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  PROGRESS_TRACKER: DurableObjectNamespace;
  CLAUDE_API_KEY: string;
  GEMINI_API_KEY: string;
  ENVIRONMENT: string;
}

type AnalyzeMessage = AnalyzeContentMessage | AnalyzeProjectMessage;

interface QueueBatch {
  messages: Message<AnalyzeMessage>[];
}

export default {
  async queue(batch: QueueBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const msg = message.body;

        if (msg.type === 'analyze_project') {
          // Project-level analysis: create chapters and assign content
          await analyzeProjectAndCreateChapters(msg.projectId, env);
        } else if (msg.type === 'analyze_content') {
          // Individual content analysis
          await analyzeContent(msg, env);
        }

        message.ack();
      } catch (error) {
        console.error('Failed to analyze:', error);
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

// Analyze all content for a project and create chapters automatically
async function analyzeProjectAndCreateChapters(
  projectId: string,
  env: Env
): Promise<void> {
  await updateProgress(env, projectId, {
    stage: 'analyze',
    progress: 70,
    message: 'Organizing content into chapters...',
  });

  // Get all selected content with their analysis
  const contentResult = await env.DB.prepare(`
    SELECT c.id, c.extracted_text, c.analysis, c.content_type, f.original_name
    FROM content c
    JOIN files f ON f.id = c.file_id
    WHERE c.project_id = ? AND c.is_selected = 1
    ORDER BY c.created_at
  `)
    .bind(projectId)
    .all();

  if (!contentResult.results || contentResult.results.length === 0) {
    await updateProgress(env, projectId, {
      stage: 'analyze',
      progress: 100,
      message: 'No selected content to organize',
    });
    return;
  }

  // Check if chapters already exist
  const existingChapters = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM chapters WHERE project_id = ?'
  )
    .bind(projectId)
    .first();

  if ((existingChapters?.count as number) > 0) {
    // Chapters already exist, just assign content to suggested chapters
    await assignContentToExistingChapters(projectId, contentResult.results, env);
    return;
  }

  // Collect all themes and suggested chapters from content
  const contentSummaries: Array<{
    id: string;
    themes: string[];
    suggestedChapter: string | null;
    lifePhase: string | null;
    text: string;
  }> = [];

  for (const content of contentResult.results) {
    const analysis = content.analysis
      ? JSON.parse(content.analysis as string)
      : {};

    contentSummaries.push({
      id: content.id as string,
      themes: analysis.themes || [],
      suggestedChapter: analysis.suggested_chapter || null,
      lifePhase: analysis.timeline_placement?.life_phase || null,
      text: ((content.extracted_text as string) || '').slice(0, 200),
    });
  }

  // Use Gemini to create a chapter structure based on content
  const chapters = await generateChapterStructure(contentSummaries, env);

  // Create chapters in database
  const chapterMap = new Map<string, string>(); // title -> id

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const chapterId = `ch_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

    await env.DB.prepare(`
      INSERT INTO chapters (id, project_id, title, intro_text, sort_order, theme, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)
      .bind(
        chapterId,
        projectId,
        chapter.title,
        chapter.intro || null,
        i + 1,
        chapter.theme || null
      )
      .run();

    chapterMap.set(chapter.title.toLowerCase(), chapterId);

    // Also map any alternative names
    if (chapter.matches) {
      for (const match of chapter.matches) {
        chapterMap.set(match.toLowerCase(), chapterId);
      }
    }
  }

  // Assign content to chapters
  for (const content of contentSummaries) {
    let assignedChapterId: string | null = null;

    // Try to match by suggested chapter
    if (content.suggestedChapter) {
      const key = content.suggestedChapter.toLowerCase();
      for (const [chapterKey, chapterId] of chapterMap) {
        if (
          key.includes(chapterKey) ||
          chapterKey.includes(key) ||
          levenshteinSimilarity(key, chapterKey) > 0.6
        ) {
          assignedChapterId = chapterId;
          break;
        }
      }
    }

    // Try to match by life phase
    if (!assignedChapterId && content.lifePhase) {
      const phaseKey = content.lifePhase.toLowerCase();
      for (const [chapterKey, chapterId] of chapterMap) {
        if (chapterKey.includes(phaseKey) || phaseKey.includes(chapterKey)) {
          assignedChapterId = chapterId;
          break;
        }
      }
    }

    // Try to match by themes
    if (!assignedChapterId && content.themes.length > 0) {
      for (const theme of content.themes) {
        const themeKey = theme.toLowerCase();
        for (const [chapterKey, chapterId] of chapterMap) {
          if (chapterKey.includes(themeKey) || themeKey.includes(chapterKey)) {
            assignedChapterId = chapterId;
            break;
          }
        }
        if (assignedChapterId) break;
      }
    }

    // If still no match, assign to first chapter
    if (!assignedChapterId && chapters.length > 0) {
      assignedChapterId = chapterMap.get(chapters[0].title.toLowerCase()) || null;
    }

    if (assignedChapterId) {
      await env.DB.prepare('UPDATE content SET chapter_id = ? WHERE id = ?')
        .bind(assignedChapterId, content.id)
        .run();
    }
  }

  await sendDiscovery(env, projectId, {
    type: 'chapters',
    preview: `Created ${chapters.length} chapters: ${chapters.map((c) => c.title).join(', ')}`,
  });

  await updateProgress(env, projectId, {
    stage: 'analyze',
    progress: 100,
    message: `Organized content into ${chapters.length} chapters`,
  });
}

// Assign content to existing chapters based on analysis
async function assignContentToExistingChapters(
  projectId: string,
  contentList: D1Result<Record<string, unknown>>['results'],
  env: Env
): Promise<void> {
  // Get existing chapters
  const chaptersResult = await env.DB.prepare(
    'SELECT id, title, theme FROM chapters WHERE project_id = ? ORDER BY sort_order'
  )
    .bind(projectId)
    .all();

  if (!chaptersResult.results || chaptersResult.results.length === 0) {
    return;
  }

  const chapterMap = new Map<string, string>();
  for (const chapter of chaptersResult.results) {
    chapterMap.set((chapter.title as string).toLowerCase(), chapter.id as string);
    if (chapter.theme) {
      chapterMap.set((chapter.theme as string).toLowerCase(), chapter.id as string);
    }
  }

  // Assign each content piece
  for (const content of contentList) {
    if (content.chapter_id) continue; // Already assigned

    const analysis = content.analysis
      ? JSON.parse(content.analysis as string)
      : {};

    let assignedChapterId: string | null = null;

    // Try suggested chapter
    if (analysis.suggested_chapter) {
      const key = analysis.suggested_chapter.toLowerCase();
      for (const [chapterKey, chapterId] of chapterMap) {
        if (key.includes(chapterKey) || chapterKey.includes(key)) {
          assignedChapterId = chapterId;
          break;
        }
      }
    }

    // Try life phase
    if (!assignedChapterId && analysis.timeline_placement?.life_phase) {
      const phaseKey = analysis.timeline_placement.life_phase.toLowerCase();
      for (const [chapterKey, chapterId] of chapterMap) {
        if (chapterKey.includes(phaseKey) || phaseKey.includes(chapterKey)) {
          assignedChapterId = chapterId;
          break;
        }
      }
    }

    // Try themes
    if (!assignedChapterId && analysis.themes) {
      for (const theme of analysis.themes) {
        const themeKey = theme.toLowerCase();
        for (const [chapterKey, chapterId] of chapterMap) {
          if (chapterKey.includes(themeKey) || themeKey.includes(chapterKey)) {
            assignedChapterId = chapterId;
            break;
          }
        }
        if (assignedChapterId) break;
      }
    }

    if (assignedChapterId) {
      await env.DB.prepare('UPDATE content SET chapter_id = ? WHERE id = ?')
        .bind(assignedChapterId, content.id)
        .run();
    }
  }

  await updateProgress(env, projectId, {
    stage: 'analyze',
    progress: 100,
    message: 'Content assigned to chapters',
  });
}

interface GeneratedChapter {
  title: string;
  theme?: string;
  intro?: string;
  matches?: string[];
}

// Use Gemini to generate a chapter structure
async function generateChapterStructure(
  contentSummaries: Array<{
    id: string;
    themes: string[];
    suggestedChapter: string | null;
    lifePhase: string | null;
    text: string;
  }>,
  env: Env
): Promise<GeneratedChapter[]> {
  // Aggregate themes and suggested chapters
  const allThemes = new Set<string>();
  const allSuggestedChapters = new Set<string>();
  const allLifePhases = new Set<string>();

  for (const content of contentSummaries) {
    content.themes.forEach((t) => allThemes.add(t));
    if (content.suggestedChapter) allSuggestedChapters.add(content.suggestedChapter);
    if (content.lifePhase) allLifePhases.add(content.lifePhase);
  }

  const prompt = `You are organizing an autobiography. Based on the following themes, suggested chapters, and life phases from the content, create a logical chapter structure.

THEMES: ${Array.from(allThemes).slice(0, 20).join(', ')}
SUGGESTED CHAPTERS: ${Array.from(allSuggestedChapters).slice(0, 10).join(', ')}
LIFE PHASES: ${Array.from(allLifePhases).join(', ')}

SAMPLE CONTENT (first 5 items):
${contentSummaries.slice(0, 5).map((c) => `- ${c.text.slice(0, 100)}...`).join('\n')}

Create 3-7 chapters that would best organize this autobiography. Each chapter should have:
- A compelling, personal title (not generic like "Chapter 1")
- A brief theme description
- Alternative names/keywords that might match this chapter

Respond with valid JSON only:
{
  "chapters": [
    {
      "title": "Growing Up in the Midwest",
      "theme": "childhood and family origins",
      "intro": "A brief poetic introduction...",
      "matches": ["childhood", "early years", "family", "home"]
    }
  ]
}`;

  try {
    if (env.GEMINI_API_KEY) {
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.chapters && Array.isArray(parsed.chapters)) {
          return parsed.chapters;
        }
      }
    }
  } catch (error) {
    console.error('Gemini chapter generation failed:', error);
  }

  // Fallback: create chapters from life phases and top themes
  const fallbackChapters: GeneratedChapter[] = [];

  // Add life phase chapters
  const lifePhaseMap: Record<string, string> = {
    childhood: 'Early Years',
    school: 'School Days',
    college: 'College Years',
    early_career: 'Starting Out',
    career: 'Career Journey',
    family: 'Family Life',
    retirement: 'Later Years',
  };

  for (const phase of allLifePhases) {
    const title = lifePhaseMap[phase] || phase.replace(/_/g, ' ');
    fallbackChapters.push({
      title: title.charAt(0).toUpperCase() + title.slice(1),
      theme: phase,
      matches: [phase],
    });
  }

  // If no life phases, use top themes
  if (fallbackChapters.length === 0) {
    const topThemes = Array.from(allThemes).slice(0, 5);
    for (const theme of topThemes) {
      fallbackChapters.push({
        title: theme.charAt(0).toUpperCase() + theme.slice(1),
        theme: theme,
        matches: [theme],
      });
    }
  }

  // Ensure at least one chapter
  if (fallbackChapters.length === 0) {
    fallbackChapters.push({
      title: 'My Story',
      theme: 'general',
      matches: [],
    });
  }

  return fallbackChapters;
}

// Simple Levenshtein similarity (0-1)
function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0) return b.length === 0 ? 1 : 0;
  if (b.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}
