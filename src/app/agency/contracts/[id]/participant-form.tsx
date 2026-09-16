"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveRentalParticipants } from "./participant-actions";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";

function Submit() { const { pending } = useFormStatus(); return <Button type="submit" size="sm" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer les rôles"}</Button>; }

export function ParticipantForm({ contractId, customers, payerId, driverId, additionalDriverIds }: { contractId: string; customers: Array<{ id: string; first_name: string; last_name: string }>; payerId?: string | null; driverId?: string | null; additionalDriverIds: string[] }) {
  const [state, action] = useActionState<{ error?: string; success?: boolean }, FormData>(saveRentalParticipants, {});
  return <form action={action} className="space-y-3">
    <input type="hidden" name="contract_id" value={contractId}  readOnly />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1"><Label htmlFor="payer_customer_id">Payeur</Label><Select id="payer_customer_id" name="payer_customer_id" defaultValue={payerId ?? ""}><option value="">Même que le client</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</Select></div>
      <div className="space-y-1"><Label htmlFor="principal_driver_customer_id">Conducteur principal</Label><Select id="principal_driver_customer_id" name="principal_driver_customer_id" defaultValue={driverId ?? ""}><option value="">Client principal</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</Select></div>
    </div>
    <div className="space-y-1"><Label htmlFor="additional_driver_ids">Conducteurs additionnels</Label><Select id="additional_driver_ids" name="additional_driver_ids" multiple size={Math.min(5, Math.max(2, customers.length))} defaultValue={additionalDriverIds}><option disabled value="">Ctrl/Cmd + clic pour plusieurs</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</Select></div>
    {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    {state.success && <p className="text-sm text-emerald-600">Rôles enregistrés.</p>}
    <Submit />
  </form>;
}
