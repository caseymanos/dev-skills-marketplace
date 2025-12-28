import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../index';

export const publishingRouter = new Hono<{ Bindings: Env }>();

// Validation schemas
const publishSchema = z.object({
  privacy: z.enum(['public', 'unlisted', 'password']),
  password: z.string().min(8).optional(),
  custom_domain: z.string().optional(),
});

// POST /publish - Publish the autobiography site
publishingRouter.post('/publish', zValidator('json', publishSchema), async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId')!;
  const { privacy, password, custom_domain } = c.req.valid('json');

  // Verify project ownership
  const project = await c.env.DB.prepare(
    'SELECT id, name, status FROM projects WHERE id = ? AND user_id = ?'
  )
    .bind(projectId, userId)
    .first();

  if (!project) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      },
      404
    );
  }

  // Validate password requirement
  if (privacy === 'password' && !password) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password is required for password-protected sites',
        },
      },
      400
    );
  }

  // Check if there's curated content to publish
  const contentCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM content WHERE project_id = ? AND is_selected = 1'
  )
    .bind(projectId)
    .first();

  if ((contentCount?.count as number) === 0) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No content selected for publishing. Please curate content first.',
        },
      },
      400
    );
  }

  // Create publish job
  const jobId = `job_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

  // Hash password if provided
  let passwordHash: string | null = null;
  if (password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    passwordHash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  }

  // Update project config
  const config = {
    privacy,
    password_hash: passwordHash,
    custom_domain: custom_domain || null,
  };

  await c.env.DB.prepare('UPDATE projects SET config = ? WHERE id = ?')
    .bind(JSON.stringify(config), projectId)
    .run();

  // Create job record
  await c.env.DB.prepare(`
    INSERT INTO jobs (id, project_id, job_type, status, metadata, created_at)
    VALUES (?, ?, 'publish', 'pending', ?, datetime('now'))
  `)
    .bind(
      jobId,
      projectId,
      JSON.stringify({ privacy, has_password: !!password })
    )
    .run();

  // Queue build job
  await c.env.BUILD_QUEUE.send({
    type: 'build_and_publish',
    jobId,
    projectId,
    userId,
    config: { privacy, passwordHash },
    timestamp: Date.now(),
  });

  // Generate estimated URL
  const projectSlug = (project.name as string)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 20);
  const estimatedUrl = `https://${projectSlug}-${projectId.slice(-8)}.autobio.pages.dev`;

  return c.json(
    {
      job_id: jobId,
      status: 'building',
      estimated_url: estimatedUrl,
    },
    202
  );
});

// GET /site - Get published site info
publishingRouter.get('/site', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');

  // Verify project ownership
  const project = await c.env.DB.prepare(
    'SELECT id, name, config, published_url FROM projects WHERE id = ? AND user_id = ?'
  )
    .bind(projectId, userId)
    .first();

  if (!project) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      },
      404
    );
  }

  if (!project.published_url) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Site has not been published yet',
        },
      },
      404
    );
  }

  const config = project.config ? JSON.parse(project.config as string) : {};

  // Get latest publish job for timing
  const publishJob = await c.env.DB.prepare(`
    SELECT completed_at
    FROM jobs
    WHERE project_id = ? AND job_type = 'publish' AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1
  `)
    .bind(projectId)
    .first();

  // TODO: Get analytics from Cloudflare Analytics API
  const analytics = {
    views: 0,
    unique_visitors: 0,
  };

  return c.json({
    url: project.published_url,
    privacy: config.privacy || 'public',
    published_at: publishJob?.completed_at || null,
    custom_domain: config.custom_domain || null,
    analytics,
  });
});

// DELETE /site - Unpublish site
publishingRouter.delete('/site', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');

  // Verify project ownership
  const project = await c.env.DB.prepare(
    'SELECT id, published_url FROM projects WHERE id = ? AND user_id = ?'
  )
    .bind(projectId, userId)
    .first();

  if (!project) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      },
      404
    );
  }

  if (!project.published_url) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Site is not published',
        },
      },
      404
    );
  }

  // TODO: Delete from Cloudflare Pages via API
  // For now, just clear the published_url

  await c.env.DB.prepare(
    'UPDATE projects SET published_url = NULL, status = \'writing\' WHERE id = ?'
  )
    .bind(projectId)
    .run();

  return c.body(null, 204);
});

// GET /preview - Get preview HTML
publishingRouter.get('/preview', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');

  // Verify project ownership
  const project = await c.env.DB.prepare(
    'SELECT id, name FROM projects WHERE id = ? AND user_id = ?'
  )
    .bind(projectId, userId)
    .first();

  if (!project) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      },
      404
    );
  }

  // Get chapters with narratives
  const chapters = await c.env.DB.prepare(`
    SELECT
      ch.id,
      ch.title,
      ch.intro_text,
      ch.sort_order
    FROM chapters ch
    WHERE ch.project_id = ?
    ORDER BY ch.sort_order ASC
  `)
    .bind(projectId)
    .all();

  // Get selected content with narratives
  const content = await c.env.DB.prepare(`
    SELECT
      c.id,
      c.content_type,
      c.extracted_text,
      c.metadata,
      c.chapter_id,
      c.sort_order,
      n.narrative_text,
      f.r2_key
    FROM content c
    LEFT JOIN narratives n ON n.content_id = c.id
    LEFT JOIN files f ON f.id = c.file_id
    WHERE c.project_id = ? AND c.is_selected = 1
    ORDER BY c.chapter_id, c.sort_order
  `)
    .bind(projectId)
    .all();

  // Generate simple preview HTML
  const html = generatePreviewHtml(
    project.name as string,
    chapters.results,
    content.results
  );

  return c.html(html);
});

// Helper to generate preview HTML - Personal Memoir aesthetic
function generatePreviewHtml(
  projectName: string,
  chapters: D1Result<Record<string, unknown>>['results'],
  content: D1Result<Record<string, unknown>>['results']
): string {
  const contentByChapter = new Map<string | null, typeof content>();

  for (const item of content) {
    const chapterId = item.chapter_id as string | null;
    if (!contentByChapter.has(chapterId)) {
      contentByChapter.set(chapterId, []);
    }
    contentByChapter.get(chapterId)!.push(item);
  }

  // Build chapter navigation
  let chapterNavHtml = '';
  let chapterIndex = 1;
  for (const chapter of chapters) {
    chapterNavHtml += `
      <a href="#chapter-${chapter.id}"
         class="chapter-nav-item block py-3 px-4 rounded-lg hover:bg-amber-50 transition-colors text-stone-600 hover:text-amber-800 border-l-2 border-transparent hover:border-amber-400">
        <span class="text-xs uppercase tracking-wide text-stone-400">Chapter ${chapterIndex}</span>
        <span class="block font-medium mt-0.5">${chapter.title}</span>
      </a>
    `;
    chapterIndex++;
  }
  if (contentByChapter.get(null)?.length) {
    chapterNavHtml += `
      <a href="#uncategorized"
         class="chapter-nav-item block py-3 px-4 rounded-lg hover:bg-amber-50 transition-colors text-stone-600 hover:text-amber-800 border-l-2 border-transparent hover:border-amber-400">
        <span class="text-xs uppercase tracking-wide text-stone-400">More</span>
        <span class="block font-medium mt-0.5">Additional Stories</span>
      </a>
    `;
  }

  // Build chapter content
  let chaptersHtml = '';
  chapterIndex = 1;

  for (const chapter of chapters) {
    const chapterContent = contentByChapter.get(chapter.id as string) || [];

    let contentHtml = '';
    for (const item of chapterContent) {
      const narrative = (item.narrative_text as string) ||
        (item.extracted_text as string) ||
        '';

      if (item.content_type === 'image') {
        contentHtml += `
          <figure class="content-card my-12 group">
            <div class="relative overflow-hidden rounded-2xl shadow-xl transform rotate-1 group-hover:rotate-0 transition-all duration-500 ring-4 ring-white">
              <div class="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <img src="/api/projects/preview/image/${item.id}"
                   alt="Memory"
                   class="w-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-700"
                   onclick="openLightbox(this.src)" />
            </div>
            ${narrative ? `
              <figcaption class="mt-6 mx-4">
                <div class="relative bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 shadow-sm border border-amber-100">
                  <div class="absolute -top-3 left-6">
                    <span class="bg-amber-500 text-white text-xs font-medium px-3 py-1 rounded-full shadow-sm">Memory</span>
                  </div>
                  <p class="font-serif text-stone-700 italic text-lg leading-relaxed mt-2">
                    "${narrative.slice(0, 300)}${narrative.length > 300 ? '...' : ''}"
                  </p>
                </div>
              </figcaption>
            ` : ''}
          </figure>
        `;
      } else {
        // For text content, create a styled memoir card
        const hasNarrative = item.narrative_text && (item.narrative_text as string).length > 20;
        const displayText = hasNarrative ? item.narrative_text as string : narrative;
        const isRawText = !hasNarrative && displayText.length > 500;

        // Format text with proper paragraphs
        const paragraphs = displayText.split('\n').filter((p: string) => p.trim()).slice(0, isRawText ? 2 : 10).map((p: string) =>
          `<p class="mb-4 leading-relaxed">${isRawText ? p.slice(0, 200) + '...' : p}</p>`
        ).join('');

        contentHtml += `
          <article class="content-card my-10 group">
            <div class="relative bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-stone-100">
              <!-- Decorative top stripe -->
              <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400"></div>

              <!-- Quote mark decoration -->
              <div class="absolute top-6 right-6 text-amber-200 opacity-50">
                <svg class="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                </svg>
              </div>

              <div class="relative p-8">
                ${!hasNarrative ? `
                  <div class="inline-flex items-center gap-1.5 bg-stone-100 text-stone-500 text-xs font-medium px-3 py-1 rounded-full mb-4">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                    </svg>
                    Processing story...
                  </div>
                ` : ''}
                <div class="font-serif text-stone-700 text-xl leading-relaxed">
                  ${paragraphs || `<p class="leading-relaxed">${displayText.slice(0, 400)}${displayText.length > 400 ? '...' : ''}</p>`}
                </div>
              </div>

              <!-- Bottom decorative element -->
              <div class="h-12 bg-gradient-to-t from-amber-50/50 to-transparent flex items-center justify-center">
                <div class="flex gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-300"></span>
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-300"></span>
                </div>
              </div>
            </div>
          </article>
        `;
      }
    }

    chaptersHtml += `
      <section id="chapter-${chapter.id}" class="chapter-section mb-20 scroll-mt-8">
        <div class="chapter-header mb-10">
          <div class="flex items-center gap-4 mb-4">
            <div class="h-px flex-grow bg-gradient-to-r from-transparent via-amber-300 to-transparent"></div>
            <span class="text-amber-600 text-sm uppercase tracking-widest font-medium">Chapter ${chapterIndex}</span>
            <div class="h-px flex-grow bg-gradient-to-r from-transparent via-amber-300 to-transparent"></div>
          </div>
          <h2 class="text-4xl font-serif font-bold text-stone-800 text-center mb-4">
            ${chapter.title}
          </h2>
          ${chapter.intro_text ? `
            <p class="text-xl text-stone-500 text-center italic max-w-2xl mx-auto font-serif leading-relaxed">
              ${chapter.intro_text}
            </p>
          ` : ''}
        </div>
        <div class="chapter-content">
          ${contentHtml || '<p class="text-stone-400 text-center italic">This chapter is waiting for its stories...</p>'}
        </div>
      </section>
    `;
    chapterIndex++;
  }

  // Handle uncategorized content
  const uncategorized = contentByChapter.get(null) || [];
  if (uncategorized.length > 0) {
    let uncatHtml = '';
    for (const item of uncategorized) {
      const narrative = (item.narrative_text as string) ||
        (item.extracted_text as string) ||
        '';
      const hasNarrative = item.narrative_text && (item.narrative_text as string).length > 20;
      const displayText = hasNarrative ? item.narrative_text as string : narrative;
      const isRawText = !hasNarrative && displayText.length > 500;

      const paragraphs = displayText.split('\n').filter((p: string) => p.trim()).slice(0, isRawText ? 2 : 10).map((p: string) =>
        `<p class="mb-4 leading-relaxed">${isRawText ? p.slice(0, 200) + '...' : p}</p>`
      ).join('');

      uncatHtml += `
        <article class="content-card my-10 group">
          <div class="relative bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-stone-100">
            <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400"></div>
            <div class="absolute top-6 right-6 text-amber-200 opacity-50">
              <svg class="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
              </svg>
            </div>
            <div class="relative p-8">
              ${!hasNarrative ? `
                <div class="inline-flex items-center gap-1.5 bg-stone-100 text-stone-500 text-xs font-medium px-3 py-1 rounded-full mb-4">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                  </svg>
                  Processing story...
                </div>
              ` : ''}
              <div class="font-serif text-stone-700 text-xl leading-relaxed">
                ${paragraphs || `<p class="leading-relaxed">${displayText.slice(0, 400)}${displayText.length > 400 ? '...' : ''}</p>`}
              </div>
            </div>
            <div class="h-12 bg-gradient-to-t from-amber-50/50 to-transparent flex items-center justify-center">
              <div class="flex gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-300"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-amber-300"></span>
              </div>
            </div>
          </div>
        </article>
      `;
    }
    chaptersHtml += `
      <section id="uncategorized" class="chapter-section mb-20 scroll-mt-8">
        <div class="chapter-header mb-10">
          <div class="flex items-center gap-4 mb-4">
            <div class="h-px flex-grow bg-gradient-to-r from-transparent via-amber-300 to-transparent"></div>
            <span class="text-amber-600 text-sm uppercase tracking-widest font-medium">More Stories</span>
            <div class="h-px flex-grow bg-gradient-to-r from-transparent via-amber-300 to-transparent"></div>
          </div>
          <h2 class="text-4xl font-serif font-bold text-stone-800 text-center mb-4">
            Additional Memories
          </h2>
        </div>
        ${uncatHtml}
      </section>
    `;
  }

  const totalContent = content.length;
  const hasContent = chapters.length > 0 || uncategorized.length > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - A Personal Memoir</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --color-cream: #fdfbf7;
      --color-warm-white: #f8f6f0;
      --color-sepia: #8b7355;
      --color-amber: #b8860b;
    }

    body {
      font-family: 'Lora', Georgia, serif;
      background: linear-gradient(to bottom, var(--color-cream), var(--color-warm-white));
      min-height: 100vh;
    }

    .font-display {
      font-family: 'Cormorant Garamond', Georgia, serif;
    }

    .font-serif {
      font-family: 'Lora', Georgia, serif;
    }

    /* Decorative elements */
    .ornament::before {
      content: '❧';
      display: block;
      text-align: center;
      font-size: 2rem;
      color: #d4a574;
      margin: 2rem 0;
    }

    /* Smooth scrolling */
    html {
      scroll-behavior: smooth;
    }

    /* Chapter navigation active state */
    .chapter-nav-item.active {
      background-color: rgba(251, 191, 36, 0.1);
      border-left-color: #d97706;
      color: #92400e;
    }

    /* Content cards hover effect */
    .content-card {
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .content-card:hover {
      transform: translateY(-2px);
    }

    /* Image lightbox */
    .lightbox {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.9);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 2rem;
    }
    .lightbox.active {
      display: flex;
    }
    .lightbox img {
      max-width: 90%;
      max-height: 90vh;
      object-fit: contain;
      border-radius: 0.5rem;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    .lightbox-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      color: white;
      font-size: 2rem;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    .lightbox-close:hover {
      opacity: 1;
    }

    /* Hide scrollbar on nav */
    .nav-scroll::-webkit-scrollbar {
      display: none;
    }
    .nav-scroll {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }

    /* Reading progress bar */
    .progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(to right, #d97706, #f59e0b);
      z-index: 50;
      transition: width 0.1s ease-out;
    }
  </style>
</head>
<body class="text-stone-800">
  <!-- Reading progress bar -->
  <div class="progress-bar" style="width: 0%"></div>

  <!-- Image Lightbox -->
  <div class="lightbox" onclick="closeLightbox()">
    <span class="lightbox-close">&times;</span>
    <img src="" alt="Full size image" />
  </div>

  <!-- Hero Header -->
  <header class="relative py-24 overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-b from-amber-50/80 to-transparent"></div>
    <div class="absolute inset-0 opacity-10" style="background-image: url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M30 0L60 30L30 60L0 30z\" fill=\"none\" stroke=\"%238b7355\" stroke-width=\"0.5\"/%3E%3C/svg%3E');"></div>
    <div class="relative max-w-4xl mx-auto px-6 text-center">
      <div class="inline-block mb-6">
        <svg class="w-12 h-12 text-amber-600 mx-auto" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
        </svg>
      </div>
      <h1 class="font-display text-6xl md:text-7xl font-bold text-stone-800 leading-tight mb-6">
        ${projectName}
      </h1>
      <div class="h-1 w-24 bg-gradient-to-r from-amber-400 to-amber-600 mx-auto rounded-full mb-6"></div>
      <p class="font-serif text-xl text-stone-500 italic">A Personal Memoir</p>
      ${totalContent > 0 ? `
        <p class="mt-8 text-stone-400 text-sm">
          ${chapters.length} chapter${chapters.length !== 1 ? 's' : ''} • ${totalContent} memor${totalContent !== 1 ? 'ies' : 'y'}
        </p>
      ` : ''}
    </div>
  </header>

  <div class="max-w-7xl mx-auto px-4 flex gap-8">
    <!-- Chapter Navigation Sidebar -->
    ${chapters.length > 0 ? `
      <nav class="hidden lg:block w-64 flex-shrink-0">
        <div class="sticky top-8">
          <h3 class="text-sm font-medium uppercase tracking-wider text-stone-400 mb-4 px-4">Contents</h3>
          <div class="nav-scroll max-h-[calc(100vh-8rem)] overflow-y-auto">
            ${chapterNavHtml}
          </div>
        </div>
      </nav>
    ` : ''}

    <!-- Main Content -->
    <main class="flex-grow max-w-3xl pb-24">
      ${hasContent ? chaptersHtml : `
        <div class="text-center py-20">
          <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-50 flex items-center justify-center">
            <svg class="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            </svg>
          </div>
          <h2 class="font-display text-3xl font-bold text-stone-700 mb-4">Your Story Awaits</h2>
          <p class="text-stone-500 max-w-md mx-auto leading-relaxed">
            Create chapters and select content to begin crafting your personal memoir.
            Each memory you add becomes part of your unique story.
          </p>
        </div>
      `}
    </main>
  </div>

  <!-- Footer -->
  <footer class="border-t border-amber-100 bg-amber-50/30 py-12 mt-16">
    <div class="max-w-4xl mx-auto px-4 text-center">
      <div class="ornament"></div>
      <p class="text-stone-400 text-sm">
        Crafted with care using Autobiography Builder
      </p>
    </div>
  </footer>

  <script>
    // Lightbox functions
    function openLightbox(src) {
      const lightbox = document.querySelector('.lightbox');
      lightbox.querySelector('img').src = src;
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      document.querySelector('.lightbox').classList.remove('active');
      document.body.style.overflow = '';
    }

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });

    // Reading progress bar
    const progressBar = document.querySelector('.progress-bar');
    window.addEventListener('scroll', () => {
      const scrolled = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      progressBar.style.width = Math.min(scrolled, 100) + '%';
    });

    // Active chapter highlighting in nav
    const sections = document.querySelectorAll('.chapter-section');
    const navItems = document.querySelectorAll('.chapter-nav-item');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navItems.forEach(item => {
            item.classList.toggle('active', item.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { rootMargin: '-20% 0px -80% 0px' });

    sections.forEach(section => observer.observe(section));
  </script>
</body>
</html>`;
}
