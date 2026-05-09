import { PlaceholderApp } from '@/components/jobtracker/JobTrackerApp';

export default async function ListingPage({ params }: { params: Promise<{ displayId: string }> }) {
  const { displayId } = await params;
  return (
    <PlaceholderApp
      title={`Job listing preview ships in Plan 2 (${displayId})`}
      description="Plan 2 implements listing preview modals for untracked jobs and lets users add listings to the wishlist without silent state mutation."
    />
  );
}
