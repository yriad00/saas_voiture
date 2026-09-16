"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { addContractExtra, addReservationExtra, type ExtraState } from "./actions";

function Submit() { const { pending } = useFormStatus(); return <Button type="submit" size="sm" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Plus />}Ajouter</Button>; }
export function ExtraAssignmentForm({ target, parentId, extras }: { target: "reservation" | "contract"; parentId: string; extras: Array<{ id: string; name: string; code: string; price: number; pricing_type: string; min_quantity: number; max_quantity: number | null }> }) {
  const actionFn = target === "reservation" ? addReservationExtra : addContractExtra;
  const [state, action] = useActionState<ExtraState, FormData>(actionFn, {});
  return <form action={action} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_100px_auto] sm:items-end">
      <input type="hidden" name="parent_id" value={parentId} readOnly />
    <div className="space-y-1"><Label htmlFor={`${target}-extra-id`}>Extra</Label><Select id={`${target}-extra-id`} name="extra_id" required defaultValue=""><option value="">Sélectionner…</option>{extras.map((e) => <option key={e.id} value={e.id}>{e.name} · {Number(e.price).toFixed(2)} MAD {e.pricing_type === "PER_DAY" ? "/ jour" : ""}</option>)}</Select></div>
    <div className="space-y-1"><Label htmlFor={`${target}-extra-qty`}>Qté</Label><Input id={`${target}-extra-qty`} name="quantity" type="number" min="1" defaultValue="1" required /></div>
    <Submit />
    {state.error && <p className="text-sm text-destructive sm:col-span-3">{state.error}</p>}{state.success && <p className="text-sm text-emerald-600 sm:col-span-3">Extra ajouté.</p>}
  </form>;
}
