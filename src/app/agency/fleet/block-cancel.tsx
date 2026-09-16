"use client";

import { useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { cancelVehicleBlock } from "./block-actions";
import { Button } from "@/components/ui/button";

export function VehicleBlockCancel({ vehicleId, blockId }: { vehicleId: string; blockId: string }) {
  const [pending, startTransition] = useTransition();
  return <Button type="button" size="sm" variant="ghost" disabled={pending} aria-label="Annuler le blocage" onClick={() => startTransition(async () => {
    const result = await cancelVehicleBlock(vehicleId, blockId);
    if (result?.error) window.alert(result.error);
  })}>{pending ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3.5" />}</Button>;
}
