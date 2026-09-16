import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PricingRuleForm, PromotionForm } from "./pricing-form";

export const metadata = { title: "Tarifs — FleetHub" };

export default async function PricingPage() {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER"]);
  const supabase = await createClient();
  const [{ data: rules }, { data: promotions }, { data: branches }, { data: vehicles }, { data: overrides }] = await Promise.all([
    supabase.from("pricing_rules").select("id, name, category, vehicle_id, daily_rate, weekly_rate, monthly_rate, minimum_daily_rate, valid_from, valid_to, active, branch_id").eq("agency_id", ctx.membership.agencyId).order("created_at", { ascending: false }),
    supabase.from("promotions").select("id, code, name, discount_type, discount_value, minimum_days, valid_from, valid_to, active, branch_id").eq("agency_id", ctx.membership.agencyId).order("created_at", { ascending: false }),
    supabase.from("branches").select("id, name, code").eq("agency_id", ctx.membership.agencyId).eq("active", true).order("name"),
    supabase.from("vehicles").select("id, brand, model, license_plate").eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).order("brand"),
    supabase.from("pricing_override_history").select("id, branch_id, reservation_id, contract_id, actor_id, original_daily_rate, requested_daily_rate, minimum_daily_rate, discount_amount, reason, created_at").eq("agency_id", ctx.membership.agencyId).order("created_at", { ascending: false }).limit(50),
  ]);
  const vehicleOptions = (vehicles ?? []).map((vehicle) => ({ id: vehicle.id, name: `${vehicle.brand} ${vehicle.model} · ${vehicle.license_plate}` }));
  return <><PageHeader title="Tarifs & promotions" description="Règles journalières, semaine/mois, saisonnalité, minimum autorisé et promotions." />
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Nouvelle règle tarifaire</CardTitle></CardHeader><CardContent><PricingRuleForm branches={branches ?? []} vehicles={vehicleOptions} /></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Nouvelle promotion</CardTitle></CardHeader><CardContent><PromotionForm branches={branches ?? []} /></CardContent></Card></div>
    <Card className="mt-6"><CardHeader><CardTitle className="text-base">Règles actives</CardTitle></CardHeader><CardContent className="space-y-2">{(rules ?? []).length ? (rules ?? []).map((rule) => <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"><div><p className="font-medium">{rule.name}</p><p className="text-xs text-muted-foreground">{rule.category ?? (rule.vehicle_id ? "Véhicule" : "Agence entière")} · {Number(rule.daily_rate).toFixed(2)} MAD/jour · minimum {Number(rule.minimum_daily_rate).toFixed(2)} MAD</p></div><Badge variant={rule.active ? "success" : "secondary"}>{rule.active ? "Active" : "Inactive"}</Badge></div>) : <p className="text-sm text-muted-foreground">Aucune règle personnalisée. Le tarif véhicule est utilisé.</p>}</CardContent></Card>
    <Card className="mt-6"><CardHeader><CardTitle className="text-base">Promotions</CardTitle></CardHeader><CardContent className="space-y-2">{(promotions ?? []).length ? (promotions ?? []).map((promotion) => <div key={promotion.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"><div><p className="font-medium">{promotion.code} · {promotion.name}</p><p className="text-xs text-muted-foreground">{promotion.discount_type === "PERCENT" ? `${promotion.discount_value}%` : `${promotion.discount_value} MAD`} · minimum {promotion.minimum_days} jour(s) · {promotion.valid_from} → {promotion.valid_to}</p></div><Badge variant={promotion.active ? "success" : "secondary"}>{promotion.active ? "Active" : "Inactive"}</Badge></div>) : <p className="text-sm text-muted-foreground">Aucune promotion.</p>}</CardContent></Card>
    <Card className="mt-6"><CardHeader><CardTitle className="text-base">Historique des overrides</CardTitle></CardHeader><CardContent className="space-y-2">{(overrides ?? []).length ? (overrides ?? []).map((override) => <div key={override.id} className="rounded-lg border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{Number(override.requested_daily_rate).toFixed(2)} MAD/jour · minimum {Number(override.minimum_daily_rate).toFixed(2)} MAD</p><span className="text-xs text-muted-foreground">{new Date(override.created_at).toLocaleString("fr-MA")}</span></div><p className="mt-1 text-xs text-muted-foreground">Motif : {override.reason}</p></div>) : <p className="text-sm text-muted-foreground">Aucun override enregistré.</p>}</CardContent></Card>
  </>;
}
