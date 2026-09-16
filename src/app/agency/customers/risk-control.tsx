"use client";

import { useActionState, useTransition } from "react";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { addCustomerRiskFlag, resolveCustomerRiskFlag, type RiskActionState } from "./risk-actions";
import type { CustomerRiskFlag } from "@/lib/services/customer-risk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select, Textarea } from "@/components/ui/input";

const REASONS = [
  ["UNPAID_DEBT", "Dette impayée"],
  ["FRAUD", "Fraude"],
  ["SERIOUS_DAMAGE", "Dommage important"],
  ["REPEATED_FINES", "Amendes répétées"],
  ["LATE_RETURNS", "Retours tardifs répétés"],
  ["DOCUMENT_FRAUD", "Fraude documentaire"],
  ["OTHER", "Autre"],
] as const;

export function CustomerRiskControl({ customerId, flag }: { customerId: string; flag: CustomerRiskFlag | null }) {
  const [state, action] = useActionState<RiskActionState, FormData>(addCustomerRiskFlag.bind(null, customerId), {});
  const [pending, startTransition] = useTransition();

  if (flag) {
    return (
      <Card className="border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base text-red-700 dark:text-red-300"><AlertTriangle className="size-4" /> Client sous surveillance</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-red-800 dark:text-red-200">Motif : {REASONS.find(([key]) => key === flag.reason)?.[1] ?? flag.reason}</p>
          {flag.notes && <p className="whitespace-pre-wrap text-sm text-red-800/80 dark:text-red-200/80">{flag.notes}</p>}
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => startTransition(() => { void resolveCustomerRiskFlag(flag.id, customerId); })}>
            {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Résoudre le signalement
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Risque client</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="risk_reason">Motif</Label><Select id="risk_reason" name="reason" defaultValue="UNPAID_DEBT"><option value="UNPAID_DEBT">Dette impayée</option>{REASONS.slice(1).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
            <div className="space-y-1.5"><Label htmlFor="risk_notes">Détails</Label><Textarea id="risk_notes" name="notes" placeholder="Contexte interne (non partagé avec d'autres agences)…" /></div>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" size="sm" variant="outline"><AlertTriangle /> Signaler ce client</Button>
        </form>
      </CardContent>
    </Card>
  );
}
