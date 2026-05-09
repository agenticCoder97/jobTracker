import { PlaceholderApp } from '@/components/jobtracker/JobTrackerApp';

export default async function CompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  return (
    <PlaceholderApp
      title={`Company detail ships in Plan 2 (${companyId})`}
      description="Plan 2 implements the company detail modal with hero, KPI cards, open roles, pipeline section, reviews, and demo-data labels."
    />
  );
}
