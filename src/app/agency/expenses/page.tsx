import Link from "next/link";
import { Coins, Plus } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { listExpenses, getExpenseTotals } from "@/lib/services/expenses";
import { PageHeader, StatCard } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EXPENSE_CATEGORY, PAYMENT_METHOD } from "@/lib/labels";

export const metadata = { title: "Dépenses — FleetHub" };

export default async function ExpensesPage() {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"]);
  const [expenses, totals] = await Promise.all([listExpenses(ctx.membership.agencyId), getExpenseTotals(ctx.membership.agencyId)]);
  return <>
    <PageHeader title="Dépenses" description="Suivez les charges générales et celles rattachées à un véhicule." action={<Button asChild><Link href="/agency/expenses/new"><Plus /> Nouvelle dépense</Link></Button>} />
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3"><StatCard label="Dépenses" value={totals.count} icon={Coins} /><StatCard label="Total" value={formatCurrency(totals.total)} icon={Coins} accent="text-amber-600" /></div>
    {totals.unavailable && <Card className="mb-6 border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Le module Dépenses attend la migration Supabase <code>0006_expenses.sql</code>. Appliquez les migrations de staging avant d&apos;enregistrer des charges.</Card>}
    <Card className="overflow-x-auto">
      {expenses.length > 0 ? <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Catégorie</TableHead><TableHead>Véhicule</TableHead><TableHead>Fournisseur</TableHead><TableHead>Méthode</TableHead><TableHead>Montant</TableHead></TableRow></TableHeader><TableBody>{expenses.map((expense) => <TableRow key={expense.id}><TableCell className="text-sm text-muted-foreground">{formatDate(expense.expense_date)}</TableCell><TableCell className="text-sm">{EXPENSE_CATEGORY[expense.category] ?? expense.category}</TableCell><TableCell className="text-sm">{expense.vehicleLabel ?? "Agence"}</TableCell><TableCell className="text-sm text-muted-foreground">{expense.vendor ?? "—"}</TableCell><TableCell className="text-sm">{PAYMENT_METHOD[expense.payment_method]}</TableCell><TableCell className="text-sm font-medium tabular-nums">{formatCurrency(Number(expense.amount))}</TableCell></TableRow>)}</TableBody></Table> : <p className="p-10 text-center text-sm text-muted-foreground">Aucune dépense enregistrée.</p>}
    </Card>
  </>;
}
