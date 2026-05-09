import { CardDetailDialog } from '@/components/jobtracker/JobTrackerApp';

export default async function InterceptedCardPage({
  params,
}: {
  params: Promise<{ displayId: string }>;
}) {
  const { displayId } = await params;
  return <CardDetailDialog displayId={displayId} />;
}
