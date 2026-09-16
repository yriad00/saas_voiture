/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CaisseForms } from "./forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MOVEMENT_LABEL: Record<string, string> = {
  PAYMENT: "Encaissement",
  REFUND: "Remboursement",
  EXPENSE: "Dépense",
  ADJUSTMENT: "Ajustement",
};

const SESSION_LABEL: Record<string, string> = {
  OPEN: "Ouverte",
  CLOSED: "Clôturée",
};

export default async function CaissePage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"]);
  const params = await searchParams;
  const s = await createClient();
  const { data: branches } = await s.from("branches").select("id,name,code").eq("agency_id", ctx.membership.agencyId).eq("active", true).order("name");
  const branchId = ctx.membership.branchId ?? (params.branch && (branches ?? []).some((b) => b.id === params.branch) ? params.branch : branches?.[0]?.id) ?? null;
  const { data: sessions } = branchId ? await (s as any).from("cash_sessions").select("id,status,opening_balance,expected_closing_balance,actual_closing_balance,difference,opened_at,closed_at").eq("agency_id", ctx.membership.agencyId).eq("branch_id", branchId).order("opened_at", { ascending: false }).limit(20) : { data: [] };
  const open = (sessions ?? []).find((row: any) => row.status === "OPEN");
  const { data: movements } = open ? await (s as any).from("cash_movements").select("id,movement_type,amount,reason,created_at").eq("session_id", open.id).order("created_at", { ascending: false }) : { data: [] };
  const expectedNow = open ? Number(open.opening_balance) + (movements ?? []).reduce((sum: number, m: any) => sum + (m.movement_type === "PAYMENT" ? Number(m.amount) : -Number(m.amount)), 0) : 0;
  const cashIn = (movements ?? []).filter((m: any) => m.movement_type === "PAYMENT").reduce((sum: number, m: any) => sum + Number(m.amount), 0);
  const cashOut = (movements ?? []).filter((m: any) => m.movement_type !== "PAYMENT").reduce((sum: number, m: any) => sum + Number(m.amount), 0);

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Caisse</h1><p className="text-sm text-muted-foreground">Suivi simple de la caisse de votre agence.</p></div>
    {!ctx.membership.branchId && (branches ?? []).length > 0 && <form method="get" className="flex flex-wrap items-end gap-2 rounded-md border p-3"><div className="space-y-1"><label htmlFor="branch" className="text-sm font-medium">Agence</label><select id="branch" name="branch" defaultValue={branchId ?? ""} className="h-10 rounded border bg-background px-2 text-sm">{(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ""}</option>)}</select></div><button className="h-10 rounded bg-primary px-3 text-sm text-primary-foreground">Afficher</button></form>}
    {branchId ? <CaisseForms branchId={branchId} session={open} /> : <p className="rounded-md border p-4 text-sm">Créez d’abord une agence pour ouvrir une caisse.</p>}
    <Card><CardHeader><CardTitle className="text-base">Session actuelle</CardTitle></CardHeader><CardContent>{open ? <div className="space-y-3 text-sm"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div><p className="text-xs text-muted-foreground">Ouverture</p><strong>{Number(open.opening_balance).toFixed(2)} MAD</strong></div><div><p className="text-xs text-muted-foreground">Encaissements</p><strong>{cashIn.toFixed(2)} MAD</strong></div><div><p className="text-xs text-muted-foreground">Sorties</p><strong>{cashOut.toFixed(2)} MAD</strong></div><div><p className="text-xs text-muted-foreground">Solde attendu</p><strong>{expectedNow.toFixed(2)} MAD</strong></div></div>{(movements ?? []).map((m: any)=><div key={m.id} className="flex justify-between border-b py-1"><span>{MOVEMENT_LABEL[m.movement_type] ?? "Mouvement"} · {m.reason}</span><strong>{Number(m.amount).toFixed(2)} MAD</strong></div>)}</div> : <p className="text-sm text-muted-foreground">Aucune session ouverte.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Historique</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{(sessions ?? []).map((row: any)=><div key={row.id} className="flex flex-wrap justify-between rounded border p-2"><span>{SESSION_LABEL[row.status] ?? "Session"} · {new Date(row.opened_at).toLocaleString("fr-MA")}</span><span>{row.difference === null ? "—" : `Écart ${Number(row.difference).toFixed(2)} MAD`}</span></div>)}</CardContent></Card>
  </div>;
}
