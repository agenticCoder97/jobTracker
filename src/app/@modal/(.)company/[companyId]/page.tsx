import { CompanyDetailDialog } from '@/components/companies/CompanyDetailDialog';

export default async function CompanyModal({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  return <CompanyDetailDialog companyId={companyId} />;
}
