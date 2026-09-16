"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { decideEarlyReturn } from "../actions";

type EarlyReturnState = { error?: string; success?: boolean };

export function EarlyReturnForm({ contractId, policy, decision }: { contractId: string; policy: string; decision?: string | null }) {
  const [state, action] = useActionState<EarlyReturnState, FormData>(decideEarlyReturn, {});
  return <form action={action} className="space-y-3 rounded-md border border-dashed p-3">
    <input type="hidden" name="contract_id" value={contractId}  readOnly />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><Label htmlFor={`early-return-decision-${contractId}`}>Décision</Label><Select id={`early-return-decision-${contractId}`} name="decision" defaultValue={decision ?? (policy === "MANAGER_DECISION" ? "NO_REFUND" : policy)}><option value="NO_REFUND">Pas de remboursement</option><option value="RECALCULATE">Recalculer la location</option><option value="PARTIAL_REFUND">Remboursement partiel</option></Select></div>
      <div><Label htmlFor={`early-return-refund-${contractId}`}>Montant remboursé (MAD, si partiel)</Label><Input id={`early-return-refund-${contractId}`} name="refund_amount" type="number" min="0" step="0.01" placeholder="0,00" /></div>
      <div className="sm:col-span-2"><Label htmlFor={`early-return-note-${contractId}`}>Note (facultatif)</Label><Input id={`early-return-note-${contractId}`} name="note" placeholder="Motif de la décision" /></div>
    </div>
    <Button type="submit" size="sm">Enregistrer la décision</Button>
    {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    {state.success && <p className="text-sm text-emerald-600">Décision enregistrée.</p>}
  </form>;
}
