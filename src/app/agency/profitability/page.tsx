import { Coins, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { getProfitabilitySummary } from "@/lib/services/payments";
import { PageHeader, StatCard } from "@/components/layout/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Rentabilité — FleetHub" };

export default async function ProfitabilityPage() {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"]);
  const summary = await getProfitabilitySummary(ctx.membership.agencyId);
  return (
    <>
      <PageHeader title="Rentabilité" description="Encaissements de location moins coûts de maintenance sur les 12 derniers mois." />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Revenus nets" value={formatCurrency(summary.income)} icon={TrendingUp} accent="text-green-600" />
        <StatCard label="Charges" value={formatCurrency(summary.totalCost)} icon={TrendingDown} accent="text-amber-600" />
        <StatCard label="Résultat estimé" value={formatCurrency(summary.net)} icon={WalletCards} accent={summary.net >= 0 ? "text-primary" : "text-destructive"} />
      </div>
      {summary.expensesUnavailable && <Card className="mb-6 border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Les dépenses générales ne sont pas encore disponibles : appliquez la migration Supabase <code>0006_expenses.sql</code> pour inclure toutes les charges.</Card>}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Coins className="size-4" /> Évolution mensuelle</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {summary.months.map((month, index) => (
            <div key={`${month.key}-${index}`} className="grid grid-cols-[minmax(90px,1fr)_repeat(3,minmax(90px,auto))] items-center gap-3 border-b pb-3 text-sm last:border-b-0 last:pb-0">
              <span className="capitalize text-muted-foreground">{month.label}</span>
              <span className="text-right tabular-nums">{formatCurrency(month.income)}</span>
              <span className="text-right tabular-nums text-amber-700 dark:text-amber-300">− {formatCurrency(month.totalCost)}</span>
              <span className={`text-right font-medium tabular-nums ${month.net < 0 ? "text-destructive" : ""}`}>{formatCurrency(month.net)}</span>
            </div>
          ))}
          {summary.months.length === 0 && <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>}
        </CardContent>
      </Card>
      <p className="mt-4 text-xs text-muted-foreground">Les cautions et restitutions de caution sont exclues. Les charges comprennent la maintenance terminée et les dépenses générales. Les revenus sont basés sur les paiements marqués « Payé ».</p>
    </>
  );
}
