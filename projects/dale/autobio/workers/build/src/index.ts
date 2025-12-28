import type { BuildSiteMessage } from '@autobiography/types';

interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  PROGRESS_TRACKER: DurableObjectNamespace;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  PAGES_PROJECT_NAME: string;
  ENVIRONMENT: string;
}

interface QueueBatch {
  messages: Message<BuildSiteMessage>[];
}

interface ProjectData {
  id: string;
  name: string;
  config: string | null;
}

interface ChapterData {
  id: string;
  title: string;
  intro_text: string | null;
  sort_order: number;
  theme: string | null;
}

interface ContentWithNarrative {
  id: string;
  content_type: string;
  extracted_text: string | null;
  metadata: string | null;
  chapter_id: string | null;
  sort_order: number | null;
  original_name: string;
  narrative_text: string | null;
  r2_key: string;
}

export default {
  async queue(batch: QueueBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await buildSite(message.body, env);
        message.ack();
      } catch (error) {
        console.error('Failed to build site:', message.body.projectId, error);
        message.retry();
      }
    }
  },
};

async function buildSite(msg: BuildSiteMessage, env: Env): Promise<void> {
  const { projectId, jobId, config } = msg;

  // Update job status
  await env.DB.prepare(
    "UPDATE jobs SET status = 'running', started_at = datetime('now') WHERE id = ?"
  )
    .bind(jobId)
    .run();

  await updateProgress(env, projectId, {
    stage: 'build',
    progress: 0,
    message: 'Starting site generation...',
  });

  // Get project details
  const project = await env.DB.prepare(
    'SELECT id, name, config FROM projects WHERE id = ?'
  )
    .bind(projectId)
    .first<ProjectData>();

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  // Get chapters with content
  const chapters = await env.DB.prepare(`
    SELECT id, title, intro_text, sort_order, theme
    FROM chapters
    WHERE project_id = ?
    ORDER BY sort_order
  `)
    .bind(projectId)
    .all<ChapterData>();

  // Get selected content with narratives
  const content = await env.DB.prepare(`
    SELECT c.id, c.content_type, c.extracted_text, c.metadata, c.chapter_id, c.sort_order,
           f.original_name, f.r2_key, n.narrative_text
    FROM content c
    JOIN files f ON f.id = c.file_id
    LEFT JOIN narratives n ON n.content_id = c.id
    WHERE c.project_id = ? AND c.is_selected = 1
    ORDER BY c.chapter_id, c.sort_order
  `)
    .bind(projectId)
    .all<ContentWithNarrative>();

  await updateProgress(env, projectId, {
    stage: 'build',
    progress: 20,
    message: 'Generating HTML...',
  });

  // Build the site HTML
  const siteHtml = generateSiteHtml(
    project,
    chapters.results || [],
    content.results || [],
    config
  );

  // Build CSS
  const siteCss = generateSiteCss();

  await updateProgress(env, projectId, {
    stage: 'build',
    progress: 50,
    message: 'Uploading assets...',
  });

  // Create a unique site key
  const siteKey = `sites/${projectId}`;

  // Upload HTML to R2
  await env.STORAGE.put(`${siteKey}/index.html`, siteHtml, {
    httpMetadata: { contentType: 'text/html' },
  });

  // Upload CSS to R2
  await env.STORAGE.put(`${siteKey}/styles.css`, siteCss, {
    httpMetadata: { contentType: 'text/css' },
  });

  await updateProgress(env, projectId, {
    stage: 'build',
    progress: 80,
    message: 'Finalizing site...',
  });

  // Generate the published URL (for MVP, we'll use R2 public access or a worker proxy)
  // In production, this would deploy to Cloudflare Pages
  const publishedUrl = `https://autobio.app/view/${projectId}`;

  // Update project with published URL
  await env.DB.prepare(
    "UPDATE projects SET status = 'published', published_url = ? WHERE id = ?"
  )
    .bind(publishedUrl, projectId)
    .run();

  // Update job as complete
  await env.DB.prepare(
    "UPDATE jobs SET status = 'completed', progress = 100, completed_at = datetime('now') WHERE id = ?"
  )
    .bind(jobId)
    .run();

  await updateProgress(env, projectId, {
    stage: 'build',
    progress: 100,
    message: 'Site published successfully!',
  });

  await sendDiscovery(env, projectId, {
    type: 'published',
    preview: `Your autobiography is live at ${publishedUrl}`,
  });
}

function generateSiteHtml(
  project: ProjectData,
  chapters: ChapterData[],
  content: ContentWithNarrative[],
  config: { privacy: string; passwordHash?: string }
): string {
  // Group content by chapter
  const contentByChapter = new Map<string | null, ContentWithNarrative[]>();
  for (const c of content) {
    const chapterId = c.chapter_id;
    if (!contentByChapter.has(chapterId)) {
      contentByChapter.set(chapterId, []);
    }
    contentByChapter.get(chapterId)!.push(c);
  }

  // Generate chapter sections
  const chapterSections = chapters
    .map((chapter) => {
      const chapterContent = contentByChapter.get(chapter.id) || [];
      const contentHtml = chapterContent
        .map((c) => generateContentHtml(c))
        .join('\n');

      return `
      <section class="chapter" id="chapter-${chapter.id}">
        <div class="chapter-header">
          <h2>${escapeHtml(chapter.title)}</h2>
          ${chapter.intro_text ? `<p class="chapter-intro">${escapeHtml(chapter.intro_text)}</p>` : ''}
        </div>
        <div class="chapter-content">
          ${contentHtml}
        </div>
      </section>
    `;
    })
    .join('\n');

  // Handle uncategorized content
  const uncategorizedContent = contentByChapter.get(null) || [];
  const uncategorizedSection =
    uncategorizedContent.length > 0
      ? `
    <section class="chapter" id="memories">
      <div class="chapter-header">
        <h2>More Memories</h2>
      </div>
      <div class="chapter-content">
        ${uncategorizedContent.map((c) => generateContentHtml(c)).join('\n')}
      </div>
    </section>
  `
      : '';

  // Generate table of contents
  const tocItems = chapters
    .map(
      (ch) => `<li><a href="#chapter-${ch.id}">${escapeHtml(ch.title)}</a></li>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(project.name)}</title>
  <link rel="stylesheet" href="styles.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body>
  <header class="site-header">
    <div class="container">
      <h1 class="site-title">${escapeHtml(project.name)}</h1>
    </div>
  </header>

  <nav class="toc" aria-label="Table of Contents">
    <div class="container">
      <h3>Chapters</h3>
      <ul>
        ${tocItems}
        ${uncategorizedContent.length > 0 ? '<li><a href="#memories">More Memories</a></li>' : ''}
      </ul>
    </div>
  </nav>

  <main class="site-content">
    <div class="container">
      ${chapterSections}
      ${uncategorizedSection}
    </div>
  </main>

  <footer class="site-footer">
    <div class="container">
      <p>Created with Autobiography Builder</p>
    </div>
  </footer>

  <script>
    // Smooth scroll for TOC links
    document.querySelectorAll('.toc a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Lazy load images
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.add('loaded');
            imageObserver.unobserve(img);
          }
        });
      });

      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  </script>
</body>
</html>`;
}

function generateContentHtml(content: ContentWithNarrative): string {
  const metadata = content.metadata ? JSON.parse(content.metadata) : {};

  if (content.content_type === 'image') {
    return `
      <article class="content-item content-image">
        <figure>
          <img data-src="/assets/${content.id}.jpg" alt="${escapeHtml(content.original_name)}" loading="lazy">
          <figcaption>
            ${content.narrative_text ? `<p>${escapeHtml(content.narrative_text)}</p>` : ''}
            ${metadata.extracted_date ? `<time>${metadata.extracted_date}</time>` : ''}
          </figcaption>
        </figure>
      </article>
    `;
  }

  return `
    <article class="content-item content-text">
      <div class="narrative">
        ${content.narrative_text ? `<p>${escapeHtml(content.narrative_text)}</p>` : ''}
      </div>
      ${metadata.extracted_date ? `<time class="content-date">${metadata.extracted_date}</time>` : ''}
    </article>
  `;
}

function generateSiteCss(): string {
  return `
/* Base Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Variables */
:root {
  --color-bg: #faf9f7;
  --color-text: #1a1a1a;
  --color-text-secondary: #666;
  --color-accent: #8b4513;
  --color-border: #e5e5e5;
  --font-serif: 'Crimson Pro', Georgia, serif;
  --font-sans: 'Inter', system-ui, sans-serif;
  --max-width: 800px;
  --spacing-xs: 0.5rem;
  --spacing-sm: 1rem;
  --spacing-md: 2rem;
  --spacing-lg: 4rem;
  --spacing-xl: 6rem;
}

/* Typography */
body {
  font-family: var(--font-serif);
  font-size: 1.125rem;
  line-height: 1.7;
  color: var(--color-text);
  background-color: var(--color-bg);
}

h1, h2, h3, h4 {
  font-family: var(--font-sans);
  font-weight: 600;
  line-height: 1.3;
}

h1 { font-size: 2.5rem; }
h2 { font-size: 1.75rem; }
h3 { font-size: 1.25rem; }

/* Layout */
.container {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 var(--spacing-sm);
}

/* Header */
.site-header {
  padding: var(--spacing-xl) 0 var(--spacing-lg);
  text-align: center;
  border-bottom: 1px solid var(--color-border);
}

.site-title {
  font-family: var(--font-serif);
  font-weight: 400;
  font-style: italic;
  font-size: 3rem;
  color: var(--color-accent);
}

/* Table of Contents */
.toc {
  padding: var(--spacing-md) 0;
  background: #f5f4f2;
  border-bottom: 1px solid var(--color-border);
}

.toc h3 {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
}

.toc ul {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm) var(--spacing-md);
}

.toc a {
  color: var(--color-text);
  text-decoration: none;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  transition: color 0.2s;
}

.toc a:hover {
  color: var(--color-accent);
}

/* Main Content */
.site-content {
  padding: var(--spacing-lg) 0;
}

/* Chapters */
.chapter {
  margin-bottom: var(--spacing-xl);
}

.chapter-header {
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 2px solid var(--color-accent);
}

.chapter-header h2 {
  color: var(--color-accent);
}

.chapter-intro {
  margin-top: var(--spacing-sm);
  font-style: italic;
  color: var(--color-text-secondary);
}

/* Content Items */
.content-item {
  margin-bottom: var(--spacing-md);
}

.content-image figure {
  margin: var(--spacing-md) 0;
}

.content-image img {
  width: 100%;
  height: auto;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.3s;
}

.content-image img.loaded {
  opacity: 1;
}

.content-image figcaption {
  margin-top: var(--spacing-sm);
  font-size: 0.95rem;
}

.content-image figcaption time {
  display: block;
  margin-top: var(--spacing-xs);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.content-text .narrative {
  margin-bottom: var(--spacing-sm);
}

.content-date {
  display: block;
  font-family: var(--font-sans);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

/* Footer */
.site-footer {
  padding: var(--spacing-lg) 0;
  text-align: center;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

/* Responsive */
@media (max-width: 600px) {
  :root {
    --spacing-lg: 2rem;
    --spacing-xl: 3rem;
  }

  .site-title {
    font-size: 2rem;
  }

  h2 { font-size: 1.5rem; }

  body {
    font-size: 1rem;
  }

  .toc ul {
    flex-direction: column;
    gap: var(--spacing-xs);
  }
}

/* Print styles */
@media print {
  .toc, .site-footer {
    display: none;
  }

  .chapter {
    page-break-inside: avoid;
  }
}
`;
}

function escapeHtml(text: string): string {
  const div = { textContent: text, innerHTML: '' };
  div.textContent = text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
