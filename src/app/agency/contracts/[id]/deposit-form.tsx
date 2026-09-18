"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

const makeDepositKey = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `deposit-${Date.now()}-${Math.random().toString(36).slice(2)}`;

type DepositState = { error?: string; success?: boolean };

function Submit({ hydrated, pending }: { hydrated: boolean; pending: boolean }) {
  return <Button className="w-full" disabled={!hydrated || pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>;
}

export function DepositForm({ depositId, branchId, requiredAmount, receivedAmount, heldAmount }: { depositId: string; branchId: string; requiredAmount: number; receivedAmount: number; heldAmount: number }) {
  const [state, setState] = useState<DepositState>({});
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [initialKey] = useState(makeDepositKey);
  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const remaining = Math.max(0, requiredAmount - receivedAmount);
  const available = Math.max(0, heldAmount);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hydrated || pending) return;
    setState({});
    setPending(true);
    void fetch("/api/deposits/transaction", { method: "POST", body: new FormData(event.currentTarget), credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const next = await response.json().catch(() => ({}));
        setState(response.ok ? next : { error: next.error ?? "Impossible d’enregistrer l’opération de caution. Réessayez." });
      })
      .catch(() => setState({ error: "Impossible d’enregistrer l’opération de caution. Réessayez." }))
      .finally(() => setPending(false));
  };
  return <form onSubmit={submit} className="space-y-3"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"><input type="text" className="hidden" name="deposit_id" defaultValue={depositId}/><input type="text" className="hidden" name="branch_id" defaultValue={branchId}/><div><Label htmlFor="transaction_type">Opération</Label><Select id="transaction_type" name="transaction_type" defaultValue="RECEIVED"><option value="RECEIVED">Reçue (reste {remaining.toFixed(2)} MAD)</option><option value="DEDUCTION">Déduction (disponible {available.toFixed(2)} MAD)</option><option value="REFUND">Remboursement (disponible {available.toFixed(2)} MAD)</option></Select></div><div><Label htmlFor="deposit_payment_method">Mode de caution</Label><Select id="deposit_payment_method" name="payment_method" defaultValue="CASH"><option value="CASH">Espèces</option><option value="CARD">Carte bancaire</option><option value="TRANSFER">Virement bancaire</option><option value="CHECK">Chèque</option></Select></div><div><Label htmlFor="deposit_cheque_status">État du chèque (si chèque)</Label><Select id="deposit_cheque_status" name="cheque_status" defaultValue=""><option value="">Non applicable</option><option value="RECEIVED">Reçu</option><option value="HELD">Détenu</option><option value="RETURNED">Retourné au client</option><option value="DEPOSITED_USED">Déposé / utilisé</option><option value="CANCELLED_PROBLEM">Annulé / problème</option></Select></div><div><Label htmlFor="deposit_amount_tx">Montant</Label><Input id="deposit_amount_tx" name="amount" type="number" min="0.01" max={Math.max(remaining, available) || undefined} step="0.01" required/></div><div className="sm:col-span-2"><Label htmlFor="deposit_reason">Motif</Label><Input id="deposit_reason" name="reason" required/></div><div className="flex items-end"><Input type="text" className="hidden" name="idempotency_key" defaultValue={initialKey} readOnly/><Submit hydrated={hydrated} pending={pending}/></div></div>{state.error && <p className="text-xs text-destructive">{state.error}</p>}{state.success && <p className="text-xs text-emerald-700">Opération de caution enregistrée.</p>}</form>;
}
