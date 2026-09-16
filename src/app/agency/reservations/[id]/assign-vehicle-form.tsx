"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { assignReservationVehicle } from "../actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" disabled={pending}>{pending ? "Attribution…" : "Attribuer ce véhicule"}</Button>;
}

export function AssignVehicleForm({ reservationId, vehicles }: { reservationId: string; vehicles: Array<{ id: string; brand: string; model: string; license_plate: string }> }) {
  const [state, action] = useActionState<{ error?: string; success?: boolean }, FormData>(assignReservationVehicle, {});
  return <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
    <input type="hidden" name="reservation_id" value={reservationId}  readOnly />
    <Select name="vehicle_id" defaultValue="" required aria-label="Véhicule à attribuer">
      <option value="">Sélectionner un véhicule disponible…</option>
      {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model} · {vehicle.license_plate}</option>)}
    </Select>
    <Submit />
    {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    {state.success && <p className="text-xs text-emerald-600">Véhicule attribué.</p>}
  </form>;
}
