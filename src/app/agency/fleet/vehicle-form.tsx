"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createVehicle, updateVehicle, type VehicleFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { Tables } from "@/lib/database.types";

type Vehicle = Tables<"vehicles">;

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  );
}

export function VehicleForm({ vehicle }: { vehicle?: Vehicle }) {
  const isEdit = !!vehicle;
  const boundAction = isEdit ? updateVehicle.bind(null, vehicle.id) : createVehicle;
  const [state, action] = useActionState<VehicleFormState, FormData>(boundAction, {});
  const fe = state.fieldErrors ?? {};

  if (state.success && !isEdit) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <h2 className="text-lg font-semibold">Véhicule ajouté</h2>
          <p className="text-sm text-muted-foreground">
            Le véhicule a été ajouté à votre flotte.
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/agency/fleet">Retour à la flotte</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/agency/fleet/new">Ajouter un autre</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identité du véhicule</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Marque" name="brand" error={fe.brand}>
            <Input id="brand" name="brand" defaultValue={vehicle?.brand} placeholder="Toyota" required />
          </Field>
          <Field label="Modèle" name="model" error={fe.model}>
            <Input id="model" name="model" defaultValue={vehicle?.model} placeholder="Corolla" required />
          </Field>
          <Field label="Année" name="year" error={fe.year}>
            <Input id="year" name="year" type="number" defaultValue={vehicle?.year ?? new Date().getFullYear()} min={1990} max={2100} required />
          </Field>
          <Field label="Couleur" name="color" error={fe.color}>
            <Input id="color" name="color" defaultValue={vehicle?.color ?? ""} placeholder="Blanc" />
          </Field>
          <Field label="Immatriculation" name="license_plate" error={fe.license_plate}>
            <Input id="license_plate" name="license_plate" defaultValue={vehicle?.license_plate} placeholder="12345-A-67" required />
          </Field>
          <Field label="N° de châssis (VIN)" name="vin" error={fe.vin}>
            <Input id="vin" name="vin" defaultValue={vehicle?.vin ?? ""} placeholder="Optionnel" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Caractéristiques</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Catégorie" name="category" error={fe.category}>
            <Select id="category" name="category" defaultValue={vehicle?.category ?? "sedan"}>
              <option value="sedan">Berline</option>
              <option value="suv">SUV</option>
              <option value="hatchback">Citadine</option>
              <option value="minivan">Monospace</option>
              <option value="pickup">Pick-up</option>
              <option value="coupe">Coupé</option>
              <option value="convertible">Cabriolet</option>
              <option value="van">Fourgon</option>
              <option value="truck">Camion</option>
              <option value="luxury">Luxe</option>
              <option value="economy">Économique</option>
            </Select>
          </Field>
          <Field label="Places" name="seats" error={fe.seats}>
            <Input id="seats" name="seats" type="number" defaultValue={vehicle?.seats ?? 5} min={1} max={50} />
          </Field>
          <Field label="Portes" name="doors" error={fe.doors}>
            <Input id="doors" name="doors" type="number" defaultValue={vehicle?.doors ?? 4} min={1} max={10} />
          </Field>
          <Field label="Carburant" name="fuel_type" error={fe.fuel_type}>
            <Select id="fuel_type" name="fuel_type" defaultValue={vehicle?.fuel_type ?? "GASOLINE"}>
              <option value="GASOLINE">Essence</option>
              <option value="DIESEL">Diesel</option>
              <option value="ELECTRIC">Électrique</option>
              <option value="HYBRID">Hybride</option>
              <option value="LPG">GPL</option>
            </Select>
          </Field>
          <Field label="Boîte de vitesses" name="transmission" error={fe.transmission}>
            <Select id="transmission" name="transmission" defaultValue={vehicle?.transmission ?? "MANUAL"}>
              <option value="MANUAL">Manuelle</option>
              <option value="AUTOMATIC">Automatique</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarif & kilométrage</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tarif journalier (MAD)" name="daily_rate" error={fe.daily_rate}>
            <Input id="daily_rate" name="daily_rate" type="number" step="0.01" min={0} defaultValue={vehicle?.daily_rate ?? 0} />
          </Field>
          <Field label="Kilométrage actuel (km)" name="mileage" error={fe.mileage}>
            <Input id="mileage" name="mileage" type="number" min={0} defaultValue={vehicle?.mileage ?? 0} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents & échéances</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Expiration assurance" name="insurance_expiry" error={fe.insurance_expiry}>
            <Input id="insurance_expiry" name="insurance_expiry" type="date" defaultValue={vehicle?.insurance_expiry ?? ""} />
          </Field>
          <Field label="Expiration visite technique" name="technical_inspection_expiry" error={fe.technical_inspection_expiry}>
            <Input id="technical_inspection_expiry" name="technical_inspection_expiry" type="date" defaultValue={vehicle?.technical_inspection_expiry ?? ""} />
          </Field>
          <Field label="Date d'immatriculation" name="registration_date" error={fe.registration_date}>
            <Input id="registration_date" name="registration_date" type="date" defaultValue={vehicle?.registration_date ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Notes internes" name="notes" error={fe.notes}>
            <Textarea id="notes" name="notes" defaultValue={vehicle?.notes ?? ""} placeholder="Notes sur ce véhicule..." />
          </Field>
        </CardContent>
      </Card>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Submit label={isEdit ? "Enregistrer" : "Ajouter le véhicule"} />
        <Button asChild variant="ghost">
          <Link href="/agency/fleet">Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
