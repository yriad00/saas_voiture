"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteVehicleDocument } from "./document-actions";
import { Button } from "@/components/ui/button";

export function VehicleDocumentDelete({ vehicleId, documentId }: { vehicleId: string; documentId: string }) {
  const [pending, startTransition] = useTransition();
  return <Button type="button" size="sm" variant="ghost" disabled={pending} aria-label="Supprimer le document" onClick={() => {
    if (!window.confirm("Supprimer ce document ?")) return;
    startTransition(async () => {
      const result = await deleteVehicleDocument(vehicleId, documentId);
      if (result?.error) window.alert(result.error);
    });
  }}>{pending ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3.5" />}</Button>;
}
