import { PageHeader } from "@/components/layout/stat-card";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Audit Logs — FleetHub Admin" };

export default function AuditLogsPage() {
  return (
    <>
      <PageHeader title="Audit Logs" description="Every sensitive action across the platform." />
      <ComingSoon title="Audit log" phase="Phase 11 (Reports, Audit logs & Search)" />
    </>
  );
}
