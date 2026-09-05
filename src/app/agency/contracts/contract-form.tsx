"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createContract, type ContractFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

type CustomerOption = { id: string; first_name: string; last_name: string };
type VehicleOption = { id: string; brand: string; model: string; license_plate: string };

export type ContractPrefill = {
  reservation_id?: string;
  customer_id?: string;
  vehicle_id?: string;
  start_date?: string;
  end_date?: string;
  daily_rate?: number;
  total_amount?: number;
};

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
      Créer le contrat
    </Button>
  );
}

const DEFAULT_TERMS = `1. Le locataire s'engage à restituer le véhicule dans l'état où il l'a reçu.
2. Le carburant est à la charge du locataire.
3. Toute infraction au code de la route est à la charge du locataire.
4. La caution sera restituée après vérification du véhicule.`;

export function ContractForm({
  customers,
  vehicles,
  prefill,
}: {
  customers: CustomerOption[];
  vehicles: VehicleOption[];
  prefill?: ContractPrefill;
}) {
  const [state, action] = useActionState<ContractFormState, FormData>(createContract, {});
  const fe = state.fieldErrors ?? {};
  const [deposit, setDeposit] = useState(0);

  if (state.success) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <h2 className="text-lg font-semibold">Contrat créé</h2>
          <div className="flex gap-3">
            <Button asChild><Link href={`/agency/contracts/${state.success.id}`}>Ouvrir le contrat</Link></Button>
            <Button asChild variant="outline"><Link href="/agency/contracts">Voir tous</Link></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (customers.length === 0 || vehicles.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Vous devez avoir au moins un client et un véhicule pour créer un contrat.
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={action} className="space-y-6">
      {prefill?.reservation_id && <input type="hidden" name="reservation_id" value={prefill.reservation_id} />}

      <Card>
        <CardHeader><CardTitle className="text-base">Client & véhicule</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Client" name="customer_id" error={fe.customer_id}>
            <Select id="customer_id" name="customer_id" defaultValue={prefill?.customer_id ?? customers[0]?.id} required>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </Select>
          </Field>
          <Field label="Véhicule" name="vehicle_id" error={fe.vehicle_id}>
            <Select id="vehicle_id" name="vehicle_id" defaultValue={prefill?.vehicle_id ?? vehicles[0]?.id} required>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.license_plate})</option>)}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Période & état du véhicule</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date de début" name="start_date" error={fe.start_date}>
            <Input id="start_date" name="start_date" type="date" defaultValue={prefill?.start_date ?? ""} required />
          </Field>
          <Field label="Date de fin" name="end_date" error={fe.end_date}>
            <Input id="end_date" name="end_date" type="date" defaultValue={prefill?.end_date ?? ""} required />
          </Field>
          <Field label="Kilométrage au départ" name="start_mileage" error={fe.start_mileage}>
            <Input id="start_mileage" name="start_mileage" type="number" min={0} placeholder="Ex. 45000" />
          </Field>
          <Field label="Niveau carburant au départ (0–8)" name="fuel_level_start" error={fe.fuel_level_start}>
            <Input id="fuel_level_start" name="fuel_level_start" type="number" min={0} max={8} placeholder="8 = plein" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Montants</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Tarif journalier (MAD)" name="daily_rate" error={fe.daily_rate}>
            <Input id="daily_rate" name="daily_rate" type="number" step="0.01" min={0} defaultValue={prefill?.daily_rate ?? 0} />
          </Field>
          <Field label="Montant total (MAD)" name="total_amount" error={fe.total_amount}>
            <Input id="total_amount" name="total_amount" type="number" step="0.01" min={0} defaultValue={prefill?.total_amount ?? 0} />
          </Field>
          <Field label="Caution (MAD)" name="deposit_amount" error={fe.deposit_amount}>
            <Input id="deposit_amount" name="deposit_amount" type="number" step="0.01" min={0} value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Conditions</CardTitle></CardHeader>
        <CardContent>
          <Field label="Termes du contrat" name="terms" error={fe.terms}>
            <Textarea id="terms" name="terms" rows={6} defaultValue={DEFAULT_TERMS} />
          </Field>
        </CardContent>
      </Card>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">{state.error}</p>
      )}

      <div className="flex items-center gap-3">
        <Submit />
        <Button asChild variant="ghost"><Link href="/agency/contracts">Annuler</Link></Button>
      </div>
    </form>
  );
}
