import { Suspense } from 'react';
import { JobsView } from '@/components/jobs/JobsView';

export default function JobsPage() {
  return (
    <Suspense fallback={null}>
      <JobsView />
    </Suspense>
  );
}
