import type { ParseFileMessage } from '@autobiography/types';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  ANALYZE_QUEUE: Queue;
  PROGRESS_TRACKER: DurableObjectNamespace;
  ENVIRONMENT: string;
  GEMINI_API_KEY: string;
}

// Constants
const MAX_PDF_SIZE_MB = 32;
const MAX_TEXT_LENGTH = 10000;

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface QueueBatch {
  messages: Message<ParseFileMessage>[];
}

export default {
  async queue(batch: QueueBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processFile(message.body, env);
        message.ack();
      } catch (error) {
        console.error('Failed to process file:', message.body.fileId, error);
        // Will be retried or sent to DLQ
        message.retry();
      }
    }
  },
};

async function processFile(msg: ParseFileMessage, env: Env): Promise<void> {
  const { fileId, projectId, userId, fileType } = msg;

  // Update progress
  await updateProgress(env, projectId, {
    stage: 'parse',
    progress: 0,
    message: `Processing file ${fileId}...`,
  });

  // Get file info from database
  const file = await env.DB.prepare(
    'SELECT id, r2_key, original_name FROM files WHERE id = ?'
  )
    .bind(fileId)
    .first();

  if (!file) {
    throw new Error(`File not found: ${fileId}`);
  }

  // Fetch file from R2
  const r2Object = await env.STORAGE.get(file.r2_key as string);
  if (!r2Object) {
    await updateFileStatus(env, fileId, 'failed', 'File not found in storage');
    return;
  }

  // Update progress
  await updateProgress(env, projectId, {
    stage: 'parse',
    progress: 20,
    message: `Parsing ${file.original_name}...`,
  });

  // Parse based on file type
  let parsedContent: ParsedResult[];

  try {
    if (fileType === 'application/zip') {
      parsedContent = await parseZipFile(r2Object, env, projectId);
    } else if (fileType.startsWith('image/')) {
      parsedContent = await parseImage(r2Object, file.original_name as string);
    } else if (fileType === 'application/pdf') {
      parsedContent = await parsePdf(r2Object, file.original_name as string, env);
    } else if (
      fileType === 'application/msword' ||
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      parsedContent = await parseDocx(r2Object, file.original_name as string);
    } else if (fileType === 'text/plain' || fileType === 'text/rtf') {
      parsedContent = await parseText(r2Object, file.original_name as string);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error('Parse error:', error);
    await updateFileStatus(
      env,
      fileId,
      'failed',
      error instanceof Error ? error.message : 'Unknown parse error'
    );
    return;
  }

  // Update progress
  await updateProgress(env, projectId, {
    stage: 'parse',
    progress: 60,
    message: `Found ${parsedContent.length} items in ${file.original_name}`,
  });

  // Insert content records
  for (const content of parsedContent) {
    const contentId = `cnt_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

    await env.DB.prepare(`
      INSERT INTO content (id, file_id, project_id, content_type, extracted_text, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)
      .bind(
        contentId,
        fileId,
        projectId,
        content.type,
        content.text,
        JSON.stringify(content.metadata)
      )
      .run();

    // Send discovery notification
    await sendDiscovery(env, projectId, {
      type: content.type,
      preview: content.text?.slice(0, 100) || content.metadata.filename || 'New content',
    });

    // Queue for analysis
    await env.ANALYZE_QUEUE.send({
      type: 'analyze_content',
      contentId,
      projectId,
      userId,
      timestamp: Date.now(),
    });
  }

  // Update file status
  await updateFileStatus(env, fileId, 'parsed', null);

  // Update progress
  await updateProgress(env, projectId, {
    stage: 'parse',
    progress: 100,
    message: `Completed parsing ${file.original_name}`,
  });
}

interface ParsedResult {
  type: 'text' | 'image' | 'video' | 'audio';
  text?: string;
  metadata: {
    filename: string;
    extracted_date?: string;
    people?: string[];
    places?: string[];
    events?: string[];
    emotional_tone?: string;
    confidence_score?: number;
  };
  r2Key?: string; // For extracted images
}

// Parse ZIP file - extract and process contents
async function parseZipFile(
  r2Object: R2ObjectBody,
  env: Env,
  projectId: string
): Promise<ParsedResult[]> {
  // Note: Full JSZip implementation would be needed
  // For MVP, we'll do basic extraction
  const JSZip = (await import('jszip')).default;

  const buffer = await r2Object.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const results: ParsedResult[] = [];
  const entries = Object.entries(zip.files);

  for (const [path, file] of entries) {
    if (file.dir) continue;

    // Skip hidden files and system files
    if (path.startsWith('__MACOSX') || path.startsWith('.')) continue;

    const ext = path.split('.').pop()?.toLowerCase();

    try {
      if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) {
        const imageData = await file.async('arraybuffer');
        // For MVP, just record the image
        results.push({
          type: 'image',
          metadata: {
            filename: path,
            confidence_score: 0.9,
          },
        });
      } else if (['txt', 'md'].includes(ext || '')) {
        const text = await file.async('string');
        results.push({
          type: 'text',
          text: text.slice(0, 10000), // Limit text length
          metadata: {
            filename: path,
            confidence_score: 0.95,
          },
        });
      } else if (ext === 'pdf') {
        // Parse PDF using Gemini 2.0 Flash (cheap & fast)
        const pdfData = await file.async('arraybuffer');
        const pdfSizeMB = pdfData.byteLength / (1024 * 1024);

        if (pdfSizeMB > MAX_PDF_SIZE_MB) {
          results.push({
            type: 'text',
            text: `[PDF in archive too large: ${path} (${pdfSizeMB.toFixed(2)}MB)]`,
            metadata: {
              filename: path,
              confidence_score: 0.3,
            },
          });
        } else {
          try {
            const useAdvanced = isComplexPdf(path, pdfSizeMB);
            const modelName = useAdvanced ? 'gemini-2.0-flash' : 'gemini-2.0-flash';
            console.log(`Processing PDF ${path} (${pdfSizeMB.toFixed(2)}MB) from archive with ${modelName}...`);

            const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: modelName });
            const base64Data = arrayBufferToBase64(pdfData);

            const result = await model.generateContent([
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: base64Data,
                },
              },
              { text: 'Extract all text content from this document. Return ONLY the extracted text content.' },
            ]);

            const extractedText = result.response.text();
            console.log(`Extracted ${extractedText.length} chars from ${path}`);

            results.push({
              type: 'text',
              text: extractedText.slice(0, MAX_TEXT_LENGTH),
              metadata: {
                filename: path,
                confidence_score: useAdvanced ? 0.95 : 0.9,
              },
            });
          } catch (error) {
            console.error(`Error processing PDF ${path} from archive:`, error);
            results.push({
              type: 'text',
              text: `[PDF: ${path} - extraction failed]`,
              metadata: {
                filename: path,
                confidence_score: 0.4,
              },
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error processing ${path}:`, error);
    }
  }

  return results;
}

// Parse image file
async function parseImage(
  r2Object: R2ObjectBody,
  filename: string
): Promise<ParsedResult[]> {
  // For MVP, we'll create a basic content record
  // Full implementation would use OCR and image description APIs
  return [
    {
      type: 'image',
      metadata: {
        filename,
        confidence_score: 0.9,
      },
    },
  ];
}

// Determine if PDF needs advanced processing (Gemini 3 Flash) or basic (Gemini 2.0 Flash)
function isComplexPdf(filename: string, sizeMB: number): boolean {
  const complexIndicators = [
    'scan', 'handwrit', 'letter', 'journal', 'diary', 'note',
    'contract', 'legal', 'form', 'certificate', 'photo'
  ];
  const lowerName = filename.toLowerCase();

  // Complex if: large file, or filename suggests scanned/handwritten content
  if (sizeMB > 5) return true;
  if (complexIndicators.some(ind => lowerName.includes(ind))) return true;

  return false;
}

// Parse PDF using Gemini - routes to 2.0 Flash (cheap) or 3 Flash (complex docs)
async function parsePdf(
  r2Object: R2ObjectBody,
  filename: string,
  env: Env
): Promise<ParsedResult[]> {
  const arrayBuffer = await r2Object.arrayBuffer();
  const sizeMB = arrayBuffer.byteLength / (1024 * 1024);

  if (sizeMB > MAX_PDF_SIZE_MB) {
    console.warn(`PDF ${filename} exceeds ${MAX_PDF_SIZE_MB}MB limit (${sizeMB.toFixed(2)}MB)`);
    return [{
      type: 'text',
      text: `[PDF too large to process: ${filename} (${sizeMB.toFixed(2)}MB). Maximum size is 32MB.]`,
      metadata: {
        filename,
        confidence_score: 0.3,
      },
    }];
  }

  // Route to appropriate model
  const useAdvanced = isComplexPdf(filename, sizeMB);
  const modelName = useAdvanced ? 'gemini-2.0-flash' : 'gemini-2.0-flash';
  // Note: Using 2.0 Flash for both initially since 3 Flash may not be in API yet
  // Change to 'gemini-3-flash' when available

  console.log(`Processing PDF ${filename} (${sizeMB.toFixed(2)}MB) with ${modelName}...`);

  try {
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    // Convert to base64 for Gemini
    const base64Data = arrayBufferToBase64(arrayBuffer);

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data,
        },
      },
      { text: 'Extract all text content from this document. Return ONLY the extracted text content, no commentary.' },
    ]);

    const response = result.response;
    const extractedText = response.text();

    console.log(`Extracted ${extractedText.length} chars from ${filename} using ${modelName}`);

    // Determine confidence based on response characteristics
    let confidence = useAdvanced ? 0.95 : 0.9;
    if (extractedText.toLowerCase().includes('illegible') ||
        extractedText.toLowerCase().includes('cannot read')) {
      confidence = 0.6;
    }
    if (extractedText.length < 100) {
      confidence = 0.5;
    }

    return [{
      type: 'text',
      text: extractedText.slice(0, MAX_TEXT_LENGTH),
      metadata: {
        filename,
        confidence_score: confidence,
      },
    }];
  } catch (error) {
    console.error(`Failed to parse PDF ${filename}:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific error types
    if (errorMessage.toLowerCase().includes('password') ||
        errorMessage.toLowerCase().includes('encrypted')) {
      return [{
        type: 'text',
        text: `[Password-protected PDF: ${filename} - Please remove password protection and re-upload]`,
        metadata: {
          filename,
          confidence_score: 0.2,
        },
      }];
    }

    // Graceful fallback
    return [{
      type: 'text',
      text: `[PDF Document: ${filename} - Unable to extract content: ${errorMessage}]`,
      metadata: {
        filename,
        confidence_score: 0.4,
      },
    }];
  }
}

// Parse DOCX file
async function parseDocx(
  r2Object: R2ObjectBody,
  filename: string
): Promise<ParsedResult[]> {
  // Full implementation would use mammoth
  // For MVP, create a placeholder
  return [
    {
      type: 'text',
      text: `[Word Document: ${filename}]`,
      metadata: {
        filename,
        confidence_score: 0.7,
      },
    },
  ];
}

// Parse plain text file
async function parseText(
  r2Object: R2ObjectBody,
  filename: string
): Promise<ParsedResult[]> {
  const text = await r2Object.text();

  return [
    {
      type: 'text',
      text: text.slice(0, 10000), // Limit text length
      metadata: {
        filename,
        confidence_score: 0.95,
      },
    },
  ];
}

// Helper to update file status
async function updateFileStatus(
  env: Env,
  fileId: string,
  status: string,
  errorMessage: string | null
): Promise<void> {
  await env.DB.prepare(
    'UPDATE files SET status = ?, error_message = ? WHERE id = ?'
  )
    .bind(status, errorMessage, fileId)
    .run();
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
