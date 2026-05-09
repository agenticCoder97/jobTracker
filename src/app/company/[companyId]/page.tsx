import { CompanyDetailDialog } from '@/components/companies/CompanyDetailDialog';
import { CompaniesView } from '@/components/companies/CompaniesView';

export default async function CompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  return (
    <>
      <CompaniesView />
      <CompanyDetailDialog companyId={companyId} />
    </>
  );
}
