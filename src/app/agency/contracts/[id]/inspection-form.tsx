"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { recordInspection, type InspectionFormState } from "../inspection-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  );
}

export function InspectionForm({
  contractId,
  inspectionType,
}: {
  contractId: string;
  inspectionType: "PICKUP" | "RETURN";
}) {
  const [state, action] = useActionState<InspectionFormState, FormData>(recordInspection, {});
  const fe = state.fieldErrors ?? {};
  const isPickup = inspectionType === "PICKUP";

  if (state.success) {
    return <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">Constat enregistré.</p>;
  }

  return (
    <form action={action} className="space-y-3 rounded-md border border-dashed p-4">
      <input type="text" className="hidden" name="contract_id" value={contractId}  readOnly />
      <input type="text" className="hidden" name="inspection_type" value={inspectionType}  readOnly />
      <p className="text-xs text-muted-foreground">Signature client ou agent confirmant le constat.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${inspectionType}-signature`}>Nom de signature</Label>
          <Input id={`${inspectionType}-signature`} name="signature_name" required />
          {fe.signature_name && <p className="text-xs text-destructive">{fe.signature_name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${inspectionType}-mileage`}>Kilométrage</Label>
          <Input id={`${inspectionType}-mileage`} name="mileage" type="number" min={0} />
          {fe.mileage && <p className="text-xs text-destructive">{fe.mileage}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${inspectionType}-fuel`}>Carburant (0–8)</Label>
          <Input id={`${inspectionType}-fuel`} name="fuel_level" type="number" min={0} max={8} />
          {fe.fuel_level && <p className="text-xs text-destructive">{fe.fuel_level}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${inspectionType}-notes`}>Observations</Label>
          <Textarea id={`${inspectionType}-notes`} name="notes" rows={3} placeholder="État général, accessoires..." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${inspectionType}-damage`}>{isPickup ? "Dommages constatés au départ" : "Dommages constatés au retour"}</Label>
          <Textarea id={`${inspectionType}-damage`} name="damage_notes" rows={3} placeholder="Rayures, chocs, accessoires manquants..." />
        </div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Submit label={isPickup ? "Enregistrer la remise" : "Enregistrer la restitution"} />
    </form>
  );
}
