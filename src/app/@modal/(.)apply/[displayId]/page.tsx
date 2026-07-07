import { ResumePickerDialog } from '@/components/apply/ResumePickerDialog';

export default async function ApplyModal({ params }: { params: Promise<{ displayId: string }> }) {
  const { displayId } = await params;
  return <ResumePickerDialog displayId={displayId} />;
}
