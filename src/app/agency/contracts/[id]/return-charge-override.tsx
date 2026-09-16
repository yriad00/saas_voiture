"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useActionState } from "react";
import { overrideReturnCharge } from "@/app/agency/operations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function ReturnChargeOverride({ chargeId, branchId, amount }: { chargeId: string; branchId: string; amount: number }) {
  const [state, action] = useActionState<any, FormData>(overrideReturnCharge, {});
  return <form action={action} className="mt-2 flex flex-wrap gap-2"><input type="text" className="hidden" name="charge_id" value={chargeId} readOnly /><input type="text" className="hidden" name="branch_id" value={branchId} readOnly /><Input name="amount" type="number" min={0} step="0.01" defaultValue={amount}/><Input name="reason" placeholder="Motif de l’override" required/><Button type="submit" size="sm" variant="outline">Valider override</Button>{state?.error && <span className="text-xs text-destructive">{state.error}</span>}</form>;
}
