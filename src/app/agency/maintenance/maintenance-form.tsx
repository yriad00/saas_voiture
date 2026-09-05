"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createMaintenance, type MaintenanceFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

type VehicleOption = { id: string; brand: string; model: string; license_plate: string };

function Field({ label, name, error, children }: { label: string; name: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Enregistrer
    </Button>
  );
}

export function MaintenanceForm({
  vehicles,
  defaultVehicleId,
}: {
  vehicles: VehicleOption[];
  defaultVehicleId?: string;
}) {
  const [state, action] = useActionState<MaintenanceFormState, FormData>(createMaintenance, {});
  const fe = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  if (state.success) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <h2 className="text-lg font-semibold">Intervention enregistrée</h2>
          <div className="flex gap-3">
            <Button asChild><Link href="/agency/maintenance">Retour à la maintenance</Link></Button>
            <Button asChild variant="outline"><Link href="/agency/maintenance/new">Ajouter une autre</Link></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (vehicles.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Ajoutez d'abord un <Link href="/agency/fleet/new" className="text-primary underline">véhicule</Link>.
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Intervention</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Véhicule" name="vehicle_id" error={fe.vehicle_id}>
            <Select id="vehicle_id" name="vehicle_id" defaultValue={defaultVehicleId ?? vehicles[0]?.id} required>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.license_plate})</option>)}
            </Select>
          </Field>
          <Field label="Type d'intervention" name="type" error={fe.type}>
            <Select id="type" name="type" defaultValue="OIL_CHANGE">
              <option value="OIL_CHANGE">Vidange</option>
              <option value="TIRES">Pneus</option>
              <option value="INSPECTION">Contrôle technique</option>
              <option value="REPAIR">Réparation</option>
              <option value="CLEANING">Nettoyage</option>
              <option value="OTHER">Autre</option>
            </Select>
          </Field>
          <Field label="Date de l'intervention" name="service_date" error={fe.service_date}>
            <Input id="service_date" name="service_date" type="date" defaultValue={today} required />
          </Field>
          <Field label="Prochaine échéance" name="next_service_date" error={fe.next_service_date}>
            <Input id="next_service_date" name="next_service_date" type="date" />
          </Field>
          <Field label="Coût (MAD)" name="cost" error={fe.cost}>
            <Input id="cost" name="cost" type="number" step="0.01" min={0} defaultValue={0} />
          </Field>
          <Field label="Kilométrage" name="mileage_at_service" error={fe.mileage_at_service}>
            <Input id="mileage_at_service" name="mileage_at_service" type="number" min={0} />
          </Field>
          <Field label="Garage / prestataire" name="garage_name" error={fe.garage_name}>
            <Input id="garage_name" name="garage_name" placeholder="Nom du garage" />
          </Field>
          <Field label="Statut" name="status" error={fe.status}>
            <Select id="status" name="status" defaultValue="COMPLETED">
              <option value="COMPLETED">Terminée</option>
              <option value="SCHEDULED">Planifiée</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="CANCELLED">Annulée</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" name="description" error={fe.description}>
              <Textarea id="description" name="description" placeholder="Détails de l'intervention…" />
            </Field>
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input id="set_vehicle_maintenance" name="set_vehicle_maintenance" type="checkbox" value="true" className="size-4 rounded border-input" />
            <Label htmlFor="set_vehicle_maintenance" className="font-normal">
              Marquer le véhicule « En maintenance » (si planifiée ou en cours)
            </Label>
          </div>
        </CardContent>
      </Card>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">{state.error}</p>
      )}

      <div className="flex items-center gap-3">
        <Submit />
        <Button asChild variant="ghost"><Link href="/agency/maintenance">Annuler</Link></Button>
      </div>
    </form>
  );
}
