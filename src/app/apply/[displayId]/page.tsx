import { ResumePickerDialog } from '@/components/apply/ResumePickerDialog';
import { JobTrackerApp } from '@/components/jobtracker/JobTrackerApp';

export default async function ApplyPage({ params }: { params: Promise<{ displayId: string }> }) {
  const { displayId } = await params;
  return (
    <>
      <JobTrackerApp />
      <ResumePickerDialog displayId={displayId} />
    </>
  );
}
