import { Suspense } from 'react';
import { CompaniesView } from '@/components/companies/CompaniesView';

export default function CompaniesPage() {
  return (
    <Suspense fallback={null}>
      <CompaniesView />
    </Suspense>
  );
}
