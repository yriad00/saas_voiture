"use client";

import { useActionState, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { saveRentalParticipants } from "./participant-actions";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";

function Submit() { const { pending } = useFormStatus(); return <Button type="submit" size="sm" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer les rôles"}</Button>; }

export function ParticipantForm({ contractId, customers, payerId, driverId, additionalDriverIds }: { contractId: string; customers: Array<{ id: string; first_name: string; last_name: string }>; payerId?: string | null; driverId?: string | null; additionalDriverIds: string[] }) {
  const [state, action] = useActionState<{ error?: string; success?: boolean }, FormData>(saveRentalParticipants, {});
  const [transportState, setTransportState] = useState<{ error?: string; success?: boolean; pending?: boolean }>({});
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTransportState({ pending: true });
    try {
      const response = await fetch("/api/contracts/participants", { method: "POST", body: new FormData(event.currentTarget), cache: "no-store" });
      const result = await response.json().catch(() => ({ error: "Impossible d'enregistrer les rôles. Réessayez." }));
      setTransportState(result?.error ? { error: result.error } : { success: true });
    } catch {
      setTransportState({ error: "Impossible d'enregistrer les rôles. Réessayez." });
    }
  };
  const error = transportState.error ?? state.error;
  const success = transportState.success || state.success;
  return <form action={action} onSubmit={handleSubmit} className="space-y-3">
    <input type="hidden" name="contract_id" value={contractId}  readOnly />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1"><Label htmlFor="payer_customer_id">Payeur</Label><Select id="payer_customer_id" name="payer_customer_id" defaultValue={payerId ?? ""}><option value="">Même que le client</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</Select></div>
      <div className="space-y-1"><Label htmlFor="principal_driver_customer_id">Conducteur principal</Label><Select id="principal_driver_customer_id" name="principal_driver_customer_id" defaultValue={driverId ?? ""}><option value="">Client principal</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</Select></div>
    </div>
    <div className="space-y-1"><Label htmlFor="additional_driver_ids">Conducteurs additionnels</Label><Select id="additional_driver_ids" name="additional_driver_ids" multiple size={Math.min(5, Math.max(2, customers.length))} defaultValue={additionalDriverIds}><option disabled value="">Ctrl/Cmd + clic pour plusieurs</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</Select></div>
    {error && <p className="text-sm text-destructive">{error}</p>}
    {success && <p className="text-sm text-emerald-600">Rôles enregistrés.</p>}
    {transportState.pending ? <Button type="submit" size="sm" disabled>Enregistrement…</Button> : <Submit />}
  </form>;
}
