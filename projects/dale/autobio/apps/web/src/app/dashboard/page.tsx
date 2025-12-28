'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import * as api from '@/lib/api';
import { getToken, logout } from '@/lib/auth';

const statusColors: Record<string, string> = {
  uploading: 'bg-gray-100 text-gray-800',
  parsing: 'bg-blue-100 text-blue-800',
  analyzing: 'bg-purple-100 text-purple-800',
  curating: 'bg-yellow-100 text-yellow-800',
  writing: 'bg-orange-100 text-orange-800',
  building: 'bg-pink-100 text-pink-800',
  published: 'bg-green-100 text-green-800',
};

export default function DashboardPage() {
  const router = useRouter();
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [projects, setProjects] = useState<api.Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch projects from API
  const fetchProjects = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.push('/');
      return;
    }

    try {
      const { projects: projectList } = await api.projects.list(token);
      setProjects(projectList);
      setError(null);
    } catch (err) {
      if (err instanceof api.ApiError && err.status === 401) {
        logout();
        router.push('/');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Create new project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const token = getToken();
    if (!token) {
      router.push('/');
      return;
    }

    setIsCreating(true);
    try {
      const project = await api.projects.create(newProjectName.trim(), token);
      setProjects((prev) => [project, ...prev]);
      setShowNewProjectModal(false);
      setNewProjectName('');
      // Navigate to the new project
      router.push(`/project/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    router.push('/');
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-serif font-bold text-primary-900">
              Autobiography Builder
            </Link>
            <div className="flex items-center gap-4">
              <button onClick={handleLogout} className="btn-secondary text-sm">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your Projects</h1>
            <p className="text-gray-600 mt-1">Manage your autobiographies</p>
          </div>
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="btn-primary"
          >
            + New Project
          </button>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📚</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No projects yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first autobiography to get started
            </p>
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="btn-primary"
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="card p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {project.name}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      statusColors[project.status] || statusColors.uploading
                    }`}
                  >
                    {project.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  {project.stats && (
                    <p>{project.stats.content_count} items</p>
                  )}
                  <p>Created {formatDate(project.created_at)}</p>
                </div>
                {project.published_url && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <span className="text-sm text-primary-600 hover:text-primary-700">
                      View published site →
                    </span>
                  </div>
                )}
              </Link>
            ))}

            {/* New Project Card */}
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="card p-6 border-2 border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50 transition-colors flex flex-col items-center justify-center min-h-[200px]"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl text-gray-400">+</span>
              </div>
              <span className="text-gray-600 font-medium">New Project</span>
            </button>
          </div>
        )}
      </main>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Create New Project
            </h2>
            <form onSubmit={handleCreateProject}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  id="name"
                  className="input"
                  placeholder="My Life Story"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                  disabled={isCreating}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewProjectModal(false);
                    setNewProjectName('');
                  }}
                  className="btn-secondary"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2"
                  disabled={isCreating}
                >
                  {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
