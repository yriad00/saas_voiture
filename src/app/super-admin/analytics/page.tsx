import { PageHeader } from "@/components/layout/stat-card";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Analytics — FleetHub Admin" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader title="Global Analytics" description="Growth, revenue and churn across all agencies." />
      <ComingSoon title="Platform analytics" phase="a later phase (after reservations & payments exist)" />
    </>
  );
}
