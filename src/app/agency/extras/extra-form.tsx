"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { createExtra, type ExtraState } from "./actions";

function Submit() { const { pending } = useFormStatus(); return <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Ajouter l&apos;extra</Button>; }
export function ExtraForm({ branches }: { branches: Array<{ id: string; name: string; code: string }> }) {
  const [state, action] = useActionState<ExtraState, FormData>(createExtra, {});
  return <form action={action} className="space-y-4">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="extra_code">Code</Label><Input id="extra_code" name="code" placeholder="GPS" required /></div>
      <div className="space-y-1.5"><Label htmlFor="extra_name">Nom</Label><Input id="extra_name" name="name" placeholder="GPS / siège bébé" required /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="extra_description">Description</Label><Input id="extra_description" name="description" placeholder="Description affichée à l&apos;agent" /></div>
      <div className="space-y-1.5"><Label htmlFor="extra_branch">Branche</Label><Select id="extra_branch" name="branch_id" defaultValue=""><option value="">Toutes les branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</Select></div>
      <div className="space-y-1.5"><Label htmlFor="extra_type">Tarification</Label><Select id="extra_type" name="pricing_type" defaultValue="PER_DAY"><option value="PER_DAY">Par jour</option><option value="PER_UNIT">Par unité</option><option value="FLAT">Forfait</option></Select></div>
      <div className="space-y-1.5"><Label htmlFor="extra_price">Prix (MAD)</Label><Input id="extra_price" name="price" type="number" min="0" step="0.01" required /></div>
      <div className="space-y-1.5"><Label htmlFor="extra_min">Quantité minimum</Label><Input id="extra_min" name="min_quantity" type="number" min="1" defaultValue="1" required /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="extra_max">Quantité maximum (optionnel)</Label><Input id="extra_max" name="max_quantity" type="number" min="1" /></div>
    </div>
    {state.error && <p className="text-sm text-destructive">{state.error}</p>}{state.success && <p className="text-sm text-emerald-600">Extra ajouté.</p>}
    <Submit />
  </form>;
}
