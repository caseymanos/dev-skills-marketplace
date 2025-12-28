export const runtime = 'edge';

import ProjectClient from './ProjectClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;
  return <ProjectClient projectId={id} />;
}
