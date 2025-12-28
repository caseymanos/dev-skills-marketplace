'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  Grid3X3,
  BookOpen,
  Eye,
  Globe,
  Loader2,
  Play,
  RefreshCw,
  FileText,
  Image,
  FileArchive,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { FileUploader, ContentGrid, ProgressFeed } from '@autobiography/ui';
import type { ContentItem } from '@autobiography/ui';
import * as api from '@/lib/api';
import { getToken } from '@/lib/auth';

type Tab = 'upload' | 'content' | 'chapters' | 'preview' | 'publish';

interface ProjectFile {
  id: string;
  original_name: string;
  file_type: string;
  size_bytes: number;
  status: string;
  created_at: string;
}

// Estimate processing time for a single file (in seconds)
function estimateFileProcessingTime(file: ProjectFile): number {
  const sizeMB = file.size_bytes / (1024 * 1024);

  if (file.file_type === 'application/pdf') {
    return Math.max(15, Math.ceil(sizeMB * 20));
  } else if (file.file_type === 'application/zip') {
    return Math.max(10, Math.ceil(sizeMB * 10));
  } else if (file.file_type.startsWith('image/')) {
    return 8;
  } else if (file.file_type === 'text/plain') {
    return 4;
  }
  return Math.max(5, Math.ceil(sizeMB * 10));
}

function formatTimeShort(seconds: number): string {
  if (seconds < 60) {
    return `~${seconds}s`;
  }
  const mins = Math.ceil(seconds / 60);
  return `~${mins}m`;
}

interface ProjectClientProps {
  projectId: string;
}

export default function ProjectClient({ projectId }: ProjectClientProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [project, setProject] = useState<api.Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [content, setContent] = useState<api.Content[]>([]);
  const [chapters, setChapters] = useState<api.Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chapter modal state
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<api.Chapter | null>(null);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterIntro, setChapterIntro] = useState('');
  const [chapterTheme, setChapterTheme] = useState('');
  const [isSubmittingChapter, setIsSubmittingChapter] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch project data
  const fetchProject = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.push('/');
      return;
    }

    try {
      const projectData = await api.projects.get(projectId, token);
      setProject(projectData);

      // Check if processing
      const processingStatuses = ['parsing', 'analyzing', 'curating', 'writing', 'building'];
      setIsProcessing(processingStatuses.includes(projectData.status));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    }
  }, [projectId, router]);

  // Fetch content
  const fetchContent = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const { content: contentData } = await api.content.list(
        projectId,
        { limit: 100 },
        token
      );
      setContent(contentData);
    } catch (err) {
      console.error('Failed to fetch content:', err);
    }
  }, [projectId]);

  // Fetch chapters
  const fetchChapters = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const { chapters: chaptersData } = await api.chapters.list(projectId, token);
      setChapters(chaptersData);
    } catch (err) {
      console.error('Failed to fetch chapters:', err);
    }
  }, [projectId]);

  // Fetch uploaded files
  const fetchFiles = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const { files: filesData } = await api.uploads.list(projectId, token);
      setFiles(filesData);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  }, [projectId]);

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchProject();
      await fetchFiles();
      await fetchContent();
      await fetchChapters();
      setIsLoading(false);
    };
    loadData();
  }, [fetchProject, fetchFiles, fetchContent, fetchChapters]);

  // Handle file upload
  const handleUpload = async (uploadFiles: File[]) => {
    const token = getToken();
    if (!token) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

    for (const file of uploadFiles) {
      try {
        // Get presigned URL
        const { file_id, upload_url } = await api.uploads.getUploadUrl(
          projectId,
          {
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          },
          token
        );

        // Upload to R2 - use full API URL since upload_url is a relative path
        const fullUploadUrl = upload_url.startsWith('http') ? upload_url : `${API_URL}${upload_url}`;
        await fetch(fullUploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'Authorization': `Bearer ${token}`,
          },
        });

        // Notify upload complete
        await api.uploads.complete(projectId, file_id, token);
      } catch (err) {
        console.error('Upload failed:', err);
        throw err;
      }
    }

    // Refresh project, files, and content data
    await fetchProject();
    await fetchFiles();
    await fetchContent();
  };

  // Start processing pipeline
  const handleStartProcessing = async () => {
    const token = getToken();
    if (!token) return;

    try {
      await api.processing.start(projectId, ['parse', 'analyze'], token);
      setIsProcessing(true);
      await fetchProject();
    } catch (err) {
      console.error('Failed to start processing:', err);
      setError(err instanceof Error ? err.message : 'Failed to start processing');
    }
  };

  // Handle content selection
  const handleContentSelect = async (id: string, selected: boolean) => {
    const token = getToken();
    if (!token) return;

    try {
      await api.content.update(projectId, id, { is_selected: selected }, token);
      setContent((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_selected: selected } : c))
      );
    } catch (err) {
      console.error('Failed to update content:', err);
    }
  };

  // Handle content rating
  const handleContentRate = async (id: string, rating: number) => {
    const token = getToken();
    if (!token) return;

    try {
      await api.content.update(projectId, id, { user_rating: rating }, token);
      setContent((prev) =>
        prev.map((c) => (c.id === id ? { ...c, user_rating: rating } : c))
      );
    } catch (err) {
      console.error('Failed to rate content:', err);
    }
  };

  // Generate narratives
  const handleGenerateNarratives = async () => {
    const token = getToken();
    if (!token) return;

    try {
      await api.processing.start(projectId, ['write', 'build'], token);
      setIsProcessing(true);
      await fetchProject();
    } catch (err) {
      console.error('Failed to generate narratives:', err);
    }
  };

  // Publish site
  const handlePublish = async (privacy: string, password?: string) => {
    const token = getToken();
    if (!token) return;

    try {
      await api.publishing.publish(projectId, { privacy, password }, token);
      setIsProcessing(true);
      await fetchProject();
    } catch (err) {
      console.error('Failed to publish:', err);
    }
  };

  // Processing complete handler
  const handleProcessingComplete = () => {
    setIsProcessing(false);
    fetchProject();
    fetchContent();
  };

  // Chapter handlers
  const openChapterModal = (chapter?: api.Chapter) => {
    if (chapter) {
      setEditingChapter(chapter);
      setChapterTitle(chapter.title);
      setChapterIntro(chapter.intro_text || '');
      setChapterTheme(chapter.theme || '');
    } else {
      setEditingChapter(null);
      setChapterTitle('');
      setChapterIntro('');
      setChapterTheme('');
    }
    setShowChapterModal(true);
  };

  const closeChapterModal = () => {
    setShowChapterModal(false);
    setEditingChapter(null);
    setChapterTitle('');
    setChapterIntro('');
    setChapterTheme('');
  };

  const handleSaveChapter = async () => {
    const token = getToken();
    if (!token || !chapterTitle.trim()) return;

    setIsSubmittingChapter(true);
    try {
      if (editingChapter) {
        // Update existing chapter
        await api.chapters.update(
          projectId,
          editingChapter.id,
          {
            title: chapterTitle.trim(),
            intro_text: chapterIntro || undefined,
          },
          token
        );
      } else {
        // Create new chapter
        await api.chapters.create(
          projectId,
          [{
            title: chapterTitle.trim(),
            intro_text: chapterIntro || undefined,
          }],
          token
        );
      }
      closeChapterModal();
      await fetchChapters();
    } catch (err) {
      console.error('Failed to save chapter:', err);
    } finally {
      setIsSubmittingChapter(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    const token = getToken();
    if (!token) return;

    try {
      await api.chapters.delete(projectId, chapterId, token);
      setDeleteConfirmId(null);
      await fetchChapters();
    } catch (err) {
      console.error('Failed to delete chapter:', err);
    }
  };

  // Handle assigning content to a chapter
  const handleChapterAssign = async (contentId: string, chapterId: string | null) => {
    const token = getToken();
    if (!token) return;

    try {
      await api.content.update(projectId, contentId, { chapter_id: chapterId || undefined }, token);
      setContent((prev) =>
        prev.map((c) => (c.id === contentId ? { ...c, chapter_id: chapterId || undefined } : c))
      );
      // Also refresh chapters to update content counts
      await fetchChapters();
    } catch (err) {
      console.error('Failed to assign content to chapter:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Project not found'}</p>
          <Link href="/dashboard" className="btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'upload', label: 'Upload', icon: <Upload className="w-4 h-4" /> },
    { id: 'content', label: 'Content', icon: <Grid3X3 className="w-4 h-4" /> },
    { id: 'chapters', label: 'Chapters', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'preview', label: 'Preview', icon: <Eye className="w-4 h-4" /> },
    { id: 'publish', label: 'Publish', icon: <Globe className="w-4 h-4" /> },
  ];

  const selectedCount = content.filter((c) => c.is_selected).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-sm text-gray-500 capitalize">
                  Status: {project.status}
                  {project.stats && (
                    <span className="ml-2">
                      • {project.stats.content_count} items
                      • {project.stats.selected_count} selected
                    </span>
                  )}
                </p>
              </div>
            </div>
            {project.published_url && (
              <a
                href={project.published_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-sm"
              >
                View Published Site
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Processing Progress */}
      {isProcessing && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <ProgressFeed
            projectId={projectId}
            apiUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}
            token={getToken() || undefined}
            files={files.map(f => ({
              id: f.id,
              name: f.original_name,
              size_bytes: f.size_bytes,
              file_type: f.file_type,
            }))}
            onComplete={handleProcessingComplete}
          />
        </div>
      )}

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Upload Your Files
              </h2>
              <p className="text-gray-600 mb-6">
                Upload a ZIP file containing your photos, documents, and memories.
                We support images (JPG, PNG), documents (PDF, Word, TXT), and more.
              </p>
              <FileUploader onUpload={handleUpload} />
            </div>

            {/* Uploaded Files List */}
            {files.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900">
                    Uploaded Files ({files.length})
                  </h3>
                  <button
                    onClick={fetchFiles}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                </div>
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {file.file_type.startsWith('image/') ? (
                          <Image className="w-5 h-5 text-blue-500" />
                        ) : file.file_type === 'application/zip' ? (
                          <FileArchive className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <FileText className="w-5 h-5 text-gray-500" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {file.original_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(file.size_bytes / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.status === 'parsed' || file.status === 'analyzed' ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            Complete
                          </span>
                        ) : file.status === 'error' || file.status === 'failed' ? (
                          <span className="flex items-center gap-1 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            Error
                          </span>
                        ) : file.status === 'parsing' || file.status === 'analyzing' ? (
                          <span className="flex flex-col items-end gap-0.5">
                            <span className="flex items-center gap-1 text-yellow-600 text-sm">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing...
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatTimeShort(estimateFileProcessingTime(file))}
                            </span>
                          </span>
                        ) : file.status === 'uploaded' ? (
                          <span className="flex flex-col items-end gap-0.5">
                            <span className="flex items-center gap-1 text-blue-600 text-sm">
                              <Clock className="w-4 h-4" />
                              Queued
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatTimeShort(estimateFileProcessingTime(file))}
                            </span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-500 text-sm">
                            <Clock className="w-4 h-4" />
                            {file.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {content.length > 0 && !isProcessing && (
              <div className="card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      Ready to analyze {content.length} items
                    </h3>
                    <p className="text-sm text-gray-500">
                      Start the AI analysis to score and categorize your content
                    </p>
                  </div>
                  <button
                    onClick={handleStartProcessing}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Start Processing
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Tab */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Curate Your Content
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedCount} of {content.length} items selected for your autobiography
                </p>
              </div>
              <button
                onClick={fetchContent}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {content.length === 0 ? (
              <div className="card p-12 text-center">
                <p className="text-gray-500">
                  No content yet. Upload files to get started.
                </p>
              </div>
            ) : (
              <ContentGrid
                items={content as ContentItem[]}
                chapters={chapters}
                onSelect={handleContentSelect}
                onRate={handleContentRate}
                onChapterAssign={handleChapterAssign}
              />
            )}

            {/* Show chapter assignment hint if content selected but no chapters */}
            {selectedCount > 0 && chapters.length === 0 && (
              <div className="card p-4 bg-amber-50 border-amber-200">
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      Organize your content with chapters
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      Create chapters in the Chapters tab to organize your selected content into meaningful sections.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedCount > 0 && (
              <div className="card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      Generate narratives for {selectedCount} items
                    </h3>
                    <p className="text-sm text-gray-500">
                      AI will write compelling stories for your selected content
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateNarratives}
                    disabled={isProcessing}
                    className="btn-primary"
                  >
                    Generate Narratives
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chapters Tab */}
        {activeTab === 'chapters' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Organize Chapters
                </h2>
                <p className="text-sm text-gray-500">
                  Create chapters to organize your story into meaningful sections
                </p>
              </div>
              <button
                onClick={() => openChapterModal()}
                className="btn-primary"
              >
                Add Chapter
              </button>
            </div>

            {chapters.length === 0 ? (
              <div className="card p-12 text-center">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="font-medium text-gray-900 mb-2">No chapters yet</h3>
                <p className="text-gray-500 mb-4">
                  Create your first chapter to start organizing your story.
                </p>
                <button
                  onClick={() => openChapterModal()}
                  className="btn-primary"
                >
                  Create First Chapter
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {chapters.map((chapter, index) => (
                  <div
                    key={chapter.id}
                    className="card p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 text-gray-400 cursor-grab">
                        <GripVertical className="w-5 h-5" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400 font-medium">
                            Chapter {index + 1}
                          </span>
                          {chapter.theme && (
                            <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">
                              {chapter.theme}
                            </span>
                          )}
                        </div>
                        <h3 className="font-medium text-gray-900 mt-1">
                          {chapter.title}
                        </h3>
                        {chapter.intro_text && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {chapter.intro_text}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          {chapter.content_count || 0} content item{(chapter.content_count || 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1">
                        {deleteConfirmId === chapter.id ? (
                          <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-lg">
                            <span className="text-sm text-red-700">Delete?</span>
                            <button
                              onClick={() => handleDeleteChapter(chapter.id)}
                              className="text-red-600 hover:text-red-800 font-medium text-sm"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-gray-500 hover:text-gray-700 text-sm"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => openChapterModal(chapter)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Edit chapter"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(chapter.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete chapter"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Chapter Modal */}
            {showChapterModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                  <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingChapter ? 'Edit Chapter' : 'New Chapter'}
                    </h3>
                    <button
                      onClick={closeChapterModal}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Chapter Title *
                      </label>
                      <input
                        type="text"
                        value={chapterTitle}
                        onChange={(e) => setChapterTitle(e.target.value)}
                        placeholder="e.g., Early Years, Career Beginnings..."
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Introduction (optional)
                      </label>
                      <textarea
                        value={chapterIntro}
                        onChange={(e) => setChapterIntro(e.target.value)}
                        placeholder="A brief intro to set the scene for this chapter..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Theme (optional)
                      </label>
                      <select
                        value={chapterTheme}
                        onChange={(e) => setChapterTheme(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Select a theme...</option>
                        <option value="childhood">Childhood</option>
                        <option value="family">Family</option>
                        <option value="education">Education</option>
                        <option value="career">Career</option>
                        <option value="relationships">Relationships</option>
                        <option value="travel">Travel & Adventure</option>
                        <option value="milestones">Life Milestones</option>
                        <option value="hobbies">Hobbies & Passions</option>
                        <option value="reflections">Reflections</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                    <button
                      onClick={closeChapterModal}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveChapter}
                      disabled={!chapterTitle.trim() || isSubmittingChapter}
                      className="btn-primary flex items-center gap-2"
                    >
                      {isSubmittingChapter && <Loader2 className="w-4 h-4 animate-spin" />}
                      {editingChapter ? 'Save Changes' : 'Create Chapter'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === 'preview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Preview Your Autobiography
              </h2>
              <button
                onClick={handleGenerateNarratives}
                disabled={isProcessing}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
            </div>

            <div className="card overflow-hidden">
              {(() => {
                const token = getToken();
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
                const previewUrl = token
                  ? `${apiUrl}/api/projects/${projectId}/preview?token=${encodeURIComponent(token)}`
                  : `${apiUrl}/api/projects/${projectId}/preview`;
                return (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[600px] border-0"
                    title="Preview"
                  />
                );
              })()}
            </div>
          </div>
        )}

        {/* Publish Tab */}
        {activeTab === 'publish' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Publish Your Autobiography
            </h2>

            <div className="card p-6 space-y-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Privacy Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="privacy"
                      value="public"
                      className="w-4 h-4"
                      defaultChecked
                    />
                    <div>
                      <span className="font-medium">Public</span>
                      <p className="text-sm text-gray-500">
                        Anyone with the link can view
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="privacy"
                      value="unlisted"
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="font-medium">Unlisted</span>
                      <p className="text-sm text-gray-500">
                        Only people with the direct link can view
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="privacy"
                      value="password"
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="font-medium">Password Protected</span>
                      <p className="text-sm text-gray-500">
                        Requires a password to view
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <button
                onClick={() => handlePublish('public')}
                disabled={isProcessing}
                className="btn-primary w-full"
              >
                Publish Autobiography
              </button>

              {project.published_url && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800 font-medium">
                    Published at:
                  </p>
                  <a
                    href={project.published_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:underline break-all"
                  >
                    {project.published_url}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
