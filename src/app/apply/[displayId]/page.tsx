import { PlaceholderApp } from '@/components/jobtracker/JobTrackerApp';

export default async function ApplyPage({ params }: { params: Promise<{ displayId: string }> }) {
  const { displayId } = await params;
  return (
    <PlaceholderApp
      title={`Apply flow ships in Plan 2 (${displayId})`}
      description="Plan 2 implements the Resume Picker modal and completes the Wishlist to Applied flow with linked resume and cover letter metadata."
    />
  );
}
