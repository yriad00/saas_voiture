import { PageHeader } from "@/components/layout/stat-card";
import { requireSuperAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Audit Logs — FleetHub Admin" };

export default async function AuditLogsPage() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, agency_id, actor_id, action, entity_type, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return (
    <>
      <PageHeader title="Audit Logs" description="Every sensitive action across the platform." />
      <Card className="overflow-x-auto">
        {logs && logs.length > 0 ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-4 py-3">Date</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entité</th><th className="px-4 py-3">Agence</th><th className="px-4 py-3">Détails</th></tr></thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3">{log.entity_type}{log.entity_id ? <span className="ml-1 font-mono text-xs text-muted-foreground">{log.entity_id.slice(0, 8)}</span> : null}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{log.agency_id?.slice(0, 8) ?? "plateforme"}</td>
                  <td className="max-w-sm truncate px-4 py-3 text-xs text-muted-foreground">{JSON.stringify(log.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="p-8 text-center text-sm text-muted-foreground">Aucune action enregistrée.</p>}
      </Card>
    </>
  );
}
