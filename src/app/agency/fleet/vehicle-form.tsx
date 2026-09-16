"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

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
type Branch = Tables<"branches">;

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

export function VehicleForm({ vehicle, branches = [] }: { vehicle?: Vehicle; branches?: Branch[] }) {
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
          {branches.length > 0 && <Field label="Branche" name="branch_id" error={fe.branch_id}>
            <Select id="branch_id" name="branch_id" defaultValue={vehicle?.branch_id ?? ""}>
              <option value="">Toutes les branches / agence</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>)}
            </Select>
          </Field>}
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
          <Field label="Tarif hebdomadaire (MAD)" name="weekly_rate" error={fe.weekly_rate}><Input id="weekly_rate" name="weekly_rate" type="number" step="0.01" min={0} defaultValue={vehicle?.weekly_rate ?? 0} /></Field>
          <Field label="Tarif mensuel (MAD)" name="monthly_rate" error={fe.monthly_rate}><Input id="monthly_rate" name="monthly_rate" type="number" step="0.01" min={0} defaultValue={vehicle?.monthly_rate ?? 0} /></Field>
          <Field label="Caution par défaut (MAD)" name="deposit_amount" error={fe.deposit_amount}><Input id="deposit_amount" name="deposit_amount" type="number" step="0.01" min={0} defaultValue={vehicle?.deposit_amount ?? 0} /></Field>
          <Field label="Kilométrage actuel (km)" name="mileage" error={fe.mileage}>
            <Input id="mileage" name="mileage" type="number" min={0} defaultValue={vehicle?.mileage ?? 0} />
          </Field>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-base">Propriété & sous-location</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Type de propriété" name="ownership_type" error={fe.ownership_type}><Select id="ownership_type" name="ownership_type" defaultValue={vehicle?.ownership_type ?? "OWNED"}><option value="OWNED">Véhicule de l&apos;agence</option><option value="LEASING">Leasing / financé</option><option value="SUBLEASE">Sous-location / partenaire</option></Select></Field><Field label="Propriétaire / fournisseur" name="owner_name" error={fe.owner_name}><Input id="owner_name" name="owner_name" defaultValue={(vehicle as any)?.owner_name ?? ""} placeholder="Nom du propriétaire" /></Field><Field label="Contact propriétaire" name="owner_phone" error={fe.owner_phone}><Input id="owner_phone" name="owner_phone" defaultValue={(vehicle as any)?.owner_phone ?? ""} placeholder="Téléphone / WhatsApp" /></Field><Field label="Coût propriétaire par jour" name="owner_cost_per_day" error={fe.owner_cost_per_day}><Input id="owner_cost_per_day" name="owner_cost_per_day" type="number" step="0.01" min={0} defaultValue={(vehicle as any)?.owner_cost_per_day ?? 0} /></Field><Field label="Mode de règlement" name="owner_cost_type" error={fe.owner_cost_type}><Select id="owner_cost_type" name="owner_cost_type" defaultValue={(vehicle as any)?.owner_cost_type ?? "FIXED_DAILY"}><option value="FIXED_DAILY">Coût fixe / jour</option><option value="PERCENT_REVENUE">Pourcentage du revenu</option></Select></Field><Field label="Notes de règlement" name="owner_notes" error={fe.owner_notes}><Input id="owner_notes" name="owner_notes" defaultValue={(vehicle as any)?.owner_notes ?? ""} placeholder="Règles convenues" /></Field></CardContent></Card>

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
          <CardTitle className="text-base">GPS & suivi du véhicule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
            <input id="gps_enabled" name="gps_enabled" type="checkbox" value="true" defaultChecked={vehicle?.gps_enabled ?? false} className="mt-0.5 size-4 rounded border-input accent-primary" />
            <div>
              <Label htmlFor="gps_enabled" className="font-semibold">GPS activé pour ce véhicule</Label>
              <p className="mt-1 text-xs text-muted-foreground">Ajoutez les informations du boîtier ou du fournisseur GPS utilisé par votre agence.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fournisseur GPS" name="gps_provider" error={fe.gps_provider}>
              <Input id="gps_provider" name="gps_provider" defaultValue={vehicle?.gps_provider ?? ""} placeholder="Ex. Geotab, Track24…" />
            </Field>
            <Field label="Identifiant du boîtier" name="gps_device_id" error={fe.gps_device_id}>
              <Input id="gps_device_id" name="gps_device_id" defaultValue={vehicle?.gps_device_id ?? ""} placeholder="IMEI ou device ID" />
            </Field>
          </div>
          <Field label="Lien de suivi en direct" name="gps_tracking_url" error={fe.gps_tracking_url}>
            <Input id="gps_tracking_url" name="gps_tracking_url" type="url" defaultValue={vehicle?.gps_tracking_url ?? ""} placeholder="https://app.fournisseur.com/vehicle/…" />
          </Field>
          <p className="text-xs text-muted-foreground">La dernière position sera affichée ici lorsqu’un fournisseur GPS sera connecté par webhook/API.</p>
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
