import type { WriteNarrativeMessage, WriteProjectMessage, BuildSiteMessage } from '@autobiography/types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  BUILD_QUEUE: Queue;
  PROGRESS_TRACKER: DurableObjectNamespace;
  CLAUDE_API_KEY: string;
  GEMINI_API_KEY: string;
  ENVIRONMENT: string;
}

type WriteMessage = WriteNarrativeMessage | WriteProjectMessage;

interface QueueBatch {
  messages: Message<WriteMessage>[];
}

interface ContentWithAnalysis {
  id: string;
  content_type: string;
  extracted_text: string | null;
  metadata: string | null;
  analysis: string | null;
  chapter_id: string | null;
  original_name: string;
}

interface ChapterData {
  id: string;
  title: string;
  intro_text: string | null;
  sort_order: number;
  theme: string | null;
}

export default {
  async queue(batch: QueueBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const msg = message.body;

        if (msg.type === 'write_project') {
          // Handle project-level write request (from /process endpoint)
          await writeNarrativesForProject(msg.projectId, env);
        } else if (msg.type === 'write_narrative') {
          // Handle individual content write request
          await writeNarrativesForProject(msg.projectId, env);
        }

        message.ack();
      } catch (error) {
        console.error('Failed to write narratives:', error);
        message.retry();
      }
    }
  },
};

async function writeNarrativesForProject(
  projectId: string,
  env: Env
): Promise<void> {
  // Update progress
  await updateProgress(env, projectId, {
    stage: 'write',
    progress: 0,
    message: 'Generating narratives...',
  });

  // Get all selected content for the project
  const selectedContent = await env.DB.prepare(`
    SELECT c.id, c.content_type, c.extracted_text, c.metadata, c.analysis, c.chapter_id,
           f.original_name
    FROM content c
    JOIN files f ON f.id = c.file_id
    WHERE c.project_id = ? AND c.is_selected = 1
    ORDER BY c.chapter_id, c.sort_order
  `)
    .bind(projectId)
    .all<ContentWithAnalysis>();

  if (!selectedContent.results || selectedContent.results.length === 0) {
    await updateProgress(env, projectId, {
      stage: 'write',
      progress: 100,
      message: 'No content selected for narrative generation',
    });
    return;
  }

  // Get chapters
  const chapters = await env.DB.prepare(`
    SELECT id, title, intro_text, sort_order, theme
    FROM chapters
    WHERE project_id = ?
    ORDER BY sort_order
  `)
    .bind(projectId)
    .all<ChapterData>();

  // Group content by chapter
  const contentByChapter = new Map<string | null, ContentWithAnalysis[]>();
  for (const content of selectedContent.results) {
    const chapterId = content.chapter_id;
    if (!contentByChapter.has(chapterId)) {
      contentByChapter.set(chapterId, []);
    }
    contentByChapter.get(chapterId)!.push(content);
  }

  // Process each chapter
  const totalChapters = chapters.results?.length || 1;
  let processedChapters = 0;

  for (const chapter of chapters.results || []) {
    const chapterContent = contentByChapter.get(chapter.id) || [];

    if (chapterContent.length === 0) {
      processedChapters++;
      continue;
    }

    await updateProgress(env, projectId, {
      stage: 'write',
      progress: Math.round((processedChapters / totalChapters) * 80),
      message: `Writing chapter: ${chapter.title}...`,
    });

    // Generate chapter intro if not already set
    if (!chapter.intro_text) {
      const introNarrative = await generateChapterIntro(
        chapter,
        chapterContent,
        env.CLAUDE_API_KEY
      );

      await env.DB.prepare(
        'UPDATE chapters SET intro_text = ? WHERE id = ?'
      )
        .bind(introNarrative, chapter.id)
        .run();
    }

    // Generate narratives for each content piece
    for (const content of chapterContent) {
      const narrative = await generateContentNarrative(
        content,
        chapter,
        env
      );

      // Insert or update narrative
      const narrativeId = `nar_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

      await env.DB.prepare(`
        INSERT INTO narratives (id, content_id, chapter_id, project_id, narrative_text, version, created_at)
        VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
        ON CONFLICT(content_id) DO UPDATE SET
          narrative_text = excluded.narrative_text,
          version = narratives.version + 1
      `)
        .bind(narrativeId, content.id, chapter.id, projectId, narrative)
        .run();
    }

    processedChapters++;
  }

  // Handle uncategorized content
  const uncategorizedContent = contentByChapter.get(null) || [];
  if (uncategorizedContent.length > 0) {
    await updateProgress(env, projectId, {
      stage: 'write',
      progress: 85,
      message: 'Writing uncategorized content...',
    });

    for (const content of uncategorizedContent) {
      const narrative = await generateContentNarrative(content, null, env);

      const narrativeId = `nar_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

      await env.DB.prepare(`
        INSERT INTO narratives (id, content_id, project_id, narrative_text, version, created_at)
        VALUES (?, ?, ?, ?, 1, datetime('now'))
        ON CONFLICT(content_id) DO UPDATE SET
          narrative_text = excluded.narrative_text,
          version = narratives.version + 1
      `)
        .bind(narrativeId, content.id, projectId, narrative)
        .run();
    }
  }

  // Update project status
  await env.DB.prepare(
    "UPDATE projects SET status = 'building' WHERE id = ?"
  )
    .bind(projectId)
    .run();

  await updateProgress(env, projectId, {
    stage: 'write',
    progress: 100,
    message: 'Narrative generation complete!',
  });

  // Send discovery
  await sendDiscovery(env, projectId, {
    type: 'narrative',
    preview: `Generated narratives for ${selectedContent.results.length} pieces of content`,
  });
}

async function generateChapterIntro(
  chapter: ChapterData,
  content: ContentWithAnalysis[],
  apiKey: string
): Promise<string> {
  const anthropic = new Anthropic({ apiKey });

  // Summarize content for context
  const contentSummary = content
    .slice(0, 5)
    .map((c) => {
      const text = c.extracted_text?.slice(0, 200) || c.original_name;
      return `- ${text}`;
    })
    .join('\n');

  const prompt = `You are writing the introduction to a chapter of someone's autobiography.

Chapter Title: ${chapter.title}
Chapter Theme: ${chapter.theme || 'general'}

Sample content in this chapter:
${contentSummary}

Write a warm, engaging 2-3 sentence introduction that sets the stage for this chapter.
Write in first person ("I remember...", "This was the time when...").
Be authentic and personal, avoiding cliches.
Output ONLY the introduction text, no quotes or labels.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : '';
  } catch (error) {
    console.error('Failed to generate chapter intro:', error);
    return `Welcome to ${chapter.title}.`;
  }
}

async function generateContentNarrative(
  content: ContentWithAnalysis,
  chapter: ChapterData | null,
  env: Env
): Promise<string> {
  const metadata = content.metadata ? JSON.parse(content.metadata) : {};
  const analysis = content.analysis ? JSON.parse(content.analysis) : {};

  // Use Gemini 2.5 Flash for summarization (faster, cheaper, great at summarization)
  const prompt = `You are a skilled memoir writer. Transform this source material into a compelling, concise narrative summary for someone's autobiography.

SOURCE MATERIAL:
${content.extracted_text?.slice(0, 3000) || `[${content.content_type}: ${content.original_name}]`}

CONTEXT:
- Chapter: ${chapter?.title || 'Life Stories'}
- Theme: ${chapter?.theme || analysis.themes?.join(', ') || 'personal journey'}

INSTRUCTIONS:
1. Distill the key insights, lessons, or memorable moments from this material
2. Write in engaging first-person voice ("I learned...", "What struck me...", "This taught me...")
3. Focus on the MEANING and SIGNIFICANCE, not just facts
4. Create a flowing narrative paragraph, not bullet points
5. Keep it concise but impactful: 3-5 sentences maximum
6. If this is a long article/document, extract the most personally relevant takeaways
7. Make it feel like a genuine reflection, not a dry summary

OUTPUT ONLY the narrative paragraph. No titles, labels, or quotes.`;

  // Try Gemini first (faster and better at summarization)
  if (env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      if (text && text.length > 20) {
        return text.trim();
      }
    } catch (error) {
      console.error('Gemini narrative generation failed, falling back to Claude:', error);
    }
  }

  // Fallback to Claude
  if (env.CLAUDE_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: env.CLAUDE_API_KEY });
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });

      return response.content[0].type === 'text'
        ? response.content[0].text.trim()
        : '';
    } catch (error) {
      console.error('Claude narrative generation failed:', error);
    }
  }

  // Final fallback
  if (content.content_type === 'image') {
    return `This photograph captures a meaningful moment from my journey.`;
  }
  return content.extracted_text?.slice(0, 200) || 'A meaningful memory.';
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
