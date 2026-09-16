"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FileUp, Loader2 } from "lucide-react";
import { uploadVehicleDocument, type VehicleDocumentState } from "./document-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <FileUp />} Ajouter le document</Button>;
}

export function VehicleDocumentForm({ vehicleId }: { vehicleId: string }) {
  const [state, action] = useActionState<VehicleDocumentState, FormData>(uploadVehicleDocument.bind(null, vehicleId), {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5"><Label htmlFor="vehicle_document_type">Type</Label><Select id="vehicle_document_type" name="document_type" defaultValue="REGISTRATION"><option value="REGISTRATION">Carte grise</option><option value="INSURANCE">Assurance</option><option value="TECHNICAL_INSPECTION">Visite technique</option><option value="LEASE">Location longue durée</option><option value="PURCHASE">Achat</option><option value="OTHER">Autre</option></Select></div>
        <div className="space-y-1.5"><Label htmlFor="vehicle_document_number">Référence</Label><Input id="vehicle_document_number" name="document_number" placeholder="N° police / document" /></div>
        <div className="space-y-1.5"><Label htmlFor="vehicle_document_issued">Émis le</Label><Input id="vehicle_document_issued" name="issued_at" type="date" /></div>
        <div className="space-y-1.5"><Label htmlFor="vehicle_document_expires">Expire le</Label><Input id="vehicle_document_expires" name="expires_at" type="date" /></div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4"><Label htmlFor="vehicle_document_file">Fichier</Label><Input id="vehicle_document_file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required /></div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">Document ajouté.</p>}
      <Submit />
    </form>
  );
}
