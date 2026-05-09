import { JobTrackerApp } from '@/components/jobtracker/JobTrackerApp';

export default async function CardPage({ params }: { params: Promise<{ displayId: string }> }) {
  const { displayId } = await params;
  return <JobTrackerApp initialCardDisplayId={displayId} />;
}
