"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveOwnerSettlement } from "./owner-settlement-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

function Submit() { const { pending } = useFormStatus(); return <Button type="submit" size="sm" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer le règlement"}</Button>; }
export function OwnerSettlementForm({ contractId, currentOwnerAmount = 0, currentPaidAmount = 0 }: { contractId: string; currentOwnerAmount?: number; currentPaidAmount?: number }) {
  const [state, action] = useActionState<{ error?: string; success?: boolean }, FormData>(saveOwnerSettlement, {});
  return <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-4"><input type="hidden" name="contract_id" value={contractId} readOnly /><div className="space-y-1"><Label htmlFor="owner_amount">Montant dû propriétaire</Label><Input id="owner_amount" name="owner_amount" type="number" step="0.01" min={0} defaultValue={currentOwnerAmount} required /></div><div className="space-y-1"><Label htmlFor="paid_amount">Déjà réglé</Label><Input id="paid_amount" name="paid_amount" type="number" step="0.01" min={0} defaultValue={currentPaidAmount} required /></div><div className="space-y-1"><Label htmlFor="payment_method">Mode de règlement</Label><Select id="payment_method" name="payment_method" defaultValue="CASH"><option value="CASH">Espèces</option><option value="TRANSFER">Virement</option><option value="CARD">Carte</option><option value="CHECK">Chèque</option></Select></div><div className="space-y-1"><Label htmlFor="owner_notes">Notes</Label><Input id="owner_notes" name="notes" placeholder="Règlement fournisseur" /></div><div className="sm:col-span-4"><Submit />{state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}{state.success && <p className="mt-2 text-sm text-emerald-600">Règlement propriétaire enregistré.</p>}</div></form>;
}
