import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExtraForm } from "./extra-form";
import { toggleExtra } from "./actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Extras — FleetHub" };

export default async function ExtrasPage() {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER"]);
  const supabase = await createClient();
  const [{ data: extras }, { data: branches }] = await Promise.all([
    supabase.from("extras_catalog").select("id, code, name, description, pricing_type, price, min_quantity, max_quantity, active, branch_id").eq("agency_id", ctx.membership.agencyId).order("active", { ascending: false }).order("name"),
    supabase.from("branches").select("id, name, code").eq("agency_id", ctx.membership.agencyId).eq("active", true).order("name"),
  ]);
  const branchMap = new Map((branches ?? []).map((b) => [b.id, `${b.name} (${b.code})`]));
  return <>
    <PageHeader title="Extras" description="Catalogue d’options et services ajoutés aux réservations et contrats." />
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Card><CardHeader><CardTitle className="text-base">Nouvel extra</CardTitle></CardHeader><CardContent><ExtraForm branches={branches ?? []} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Catalogue ({extras?.length ?? 0})</CardTitle></CardHeader><CardContent className="space-y-2">
        {(extras ?? []).length ? (extras ?? []).map((extra) => <div key={extra.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{extra.name}</span><Badge variant={extra.active ? "success" : "secondary"}>{extra.active ? "Actif" : "Archivé"}</Badge></div><p className="text-xs text-muted-foreground">{extra.code} · {Number(extra.price).toFixed(2)} MAD · {extra.pricing_type === "PER_DAY" ? "par jour" : extra.pricing_type === "PER_UNIT" ? "par unité" : "forfait"}{extra.branch_id ? ` · ${branchMap.get(extra.branch_id) ?? "Branche"}` : " · toutes branches"}</p></div>
          <form action={async () => { "use server"; await toggleExtra(extra.id, !extra.active); }}><Button size="sm" variant="outline">{extra.active ? "Archiver" : "Réactiver"}</Button></form>
        </div>) : <p className="text-sm text-muted-foreground">Aucun extra configuré.</p>}
      </CardContent></Card>
    </div>
  </>;
}
