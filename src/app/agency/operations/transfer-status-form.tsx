"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { startTransfer, completeTransfer } from "./actions";

type Transfer = {
  id: string;
  status: string;
  mileage_departure?: number | null;
  fuel_departure?: number | null;
  mileage_arrival?: number | null;
  fuel_arrival?: number | null;
};

export function TransferStatusForm({ transfer }: { transfer: Transfer }) {
  const [startState, startAction] = useActionState<any, FormData>(startTransfer, {});
  const [completeState, completeAction] = useActionState<any, FormData>(completeTransfer, {});
  if (transfer.status === "PLANNED") {
    return <form action={startAction} className="mt-2 grid grid-cols-2 gap-2 rounded border bg-muted/20 p-2 text-xs">
      <input type="hidden" name="transfer_id" value={transfer.id} readOnly />
      <div><Label htmlFor={`transfer-start-mileage-${transfer.id}`}>Km départ</Label><Input id={`transfer-start-mileage-${transfer.id}`} name="mileage_departure" type="number" min={0} required /></div>
      <div><Label htmlFor={`transfer-start-fuel-${transfer.id}`}>Carburant</Label><Input id={`transfer-start-fuel-${transfer.id}`} name="fuel_departure" type="number" min={0} max={8} defaultValue={8} required /></div>
      <Button type="submit" size="sm" className="col-span-2">Démarrer le transfert</Button>
      {startState?.error && <p className="col-span-2 text-destructive">{startState.error}</p>}
    </form>;
  }
  if (transfer.status === "IN_TRANSIT") {
    return <form action={completeAction} className="mt-2 grid grid-cols-2 gap-2 rounded border bg-amber-50/60 p-2 text-xs dark:bg-amber-950/20">
      <input type="hidden" name="transfer_id" value={transfer.id} readOnly />
      <div><Label htmlFor={`transfer-end-mileage-${transfer.id}`}>Km arrivée</Label><Input id={`transfer-end-mileage-${transfer.id}`} name="mileage_arrival" type="number" min={transfer.mileage_departure ?? 0} required /></div>
      <div><Label htmlFor={`transfer-end-fuel-${transfer.id}`}>Carburant</Label><Input id={`transfer-end-fuel-${transfer.id}`} name="fuel_arrival" type="number" min={0} max={8} defaultValue={8} required /></div>
      <Button type="submit" size="sm" className="col-span-2">Confirmer l’arrivée</Button>
      {completeState?.error && <p className="col-span-2 text-destructive">{completeState.error}</p>}
    </form>;
  }
  return <p className="mt-1 text-xs text-muted-foreground">Transfert terminé.</p>;
}
