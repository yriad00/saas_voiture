"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Ban, Loader2 } from "lucide-react";
import { createVehicleBlock, type VehicleBlockState } from "./block-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Ban />} Bloquer le véhicule</Button>;
}

export function VehicleBlockForm({ vehicleId }: { vehicleId: string }) {
  const [state, action] = useActionState<VehicleBlockState, FormData>(createVehicleBlock.bind(null, vehicleId), {});
  return <form action={action} className="space-y-3">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5"><Label htmlFor="block_type">Type</Label><Select id="block_type" name="block_type" defaultValue="MAINTENANCE"><option value="MAINTENANCE">Maintenance</option><option value="ADMIN">Blocage administratif</option><option value="TRANSFER">Transfert</option><option value="DAMAGE">Dommage</option></Select></div>
      <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="block_reason">Motif</Label><Input id="block_reason" name="reason" placeholder="Révision, sinistre…" required /></div>
      <div className="space-y-1.5"><Label htmlFor="block_start">Du</Label><Input id="block_start" name="start_date" type="date" required /></div>
      <div className="space-y-1.5"><Label htmlFor="block_end">Au</Label><Input id="block_end" name="end_date" type="date" required /></div>
    </div>
    {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    {state.success && <p className="text-sm text-emerald-600">Véhicule bloqué.</p>}
    <Submit />
  </form>;
}
