import { Suspense } from 'react';
import { JobListingPreviewDialog } from '@/components/jobs/JobListingPreviewDialog';
import { JobsView } from '@/components/jobs/JobsView';

export default async function ListingPage({ params }: { params: Promise<{ displayId: string }> }) {
  const { displayId } = await params;
  return (
    <>
      <Suspense fallback={null}>
        <JobsView />
      </Suspense>
      <JobListingPreviewDialog displayId={displayId} />
    </>
  );
}
