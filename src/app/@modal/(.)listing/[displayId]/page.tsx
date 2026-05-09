import { JobListingPreviewDialog } from '@/components/jobs/JobListingPreviewDialog';

export default async function ListingModal({ params }: { params: Promise<{ displayId: string }> }) {
  const { displayId } = await params;
  return <JobListingPreviewDialog displayId={displayId} />;
}
