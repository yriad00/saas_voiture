"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { updateDamageRepair } from "./actions";

export function DamageRepairForm({ damageId, status }: { damageId: string; status: string }) {
  const [state, action] = useActionState<{ error?: string; success?: boolean }, FormData>(updateDamageRepair, {});
  return <form action={action} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4"><input type="hidden" name="damage_id" value={damageId} readOnly /><Select name="status" defaultValue={status}><option value="REPORTED">Signalé</option><option value="UNDER_REVIEW">À examiner</option><option value="APPROVED">Approuvé</option><option value="REPAIRING">En réparation</option><option value="REPAIRED">Réparé</option><option value="CLOSED">Clos</option></Select><Input name="garage_name" placeholder="Garage" /><Input name="final_repair_cost" type="number" min={0} step="0.01" placeholder="Coût final MAD" /><Textarea name="repair_notes" placeholder="Note de réparation" className="sm:col-span-4" rows={2} /><Button size="sm" variant="outline" className="sm:col-span-4">Mettre à jour la réparation</Button>{state.error && <p className="text-xs text-destructive sm:col-span-4">{state.error}</p>}{state.success && <p className="text-xs text-emerald-600 sm:col-span-4">Réparation mise à jour.</p>}</form>;
}
