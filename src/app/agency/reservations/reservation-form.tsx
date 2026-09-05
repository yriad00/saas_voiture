"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createReservation, type ReservationFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

type CustomerOption = { id: string; first_name: string; last_name: string; phone: string | null };
type VehicleOption = { id: string; brand: string; model: string; license_plate: string; daily_rate: number };

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
      Créer la réservation
    </Button>
  );
}

function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export function ReservationForm({
  customers,
  vehicles,
  defaultCustomerId,
}: {
  customers: CustomerOption[];
  vehicles: VehicleOption[];
  defaultCustomerId?: string;
}) {
  const [state, action] = useActionState<ReservationFormState, FormData>(createReservation, {});
  const fe = state.fieldErrors ?? {};

  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [dailyRate, setDailyRate] = useState(vehicles[0]?.daily_rate ?? 0);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [discount, setDiscount] = useState(0);

  const days = useMemo(() => daysBetween(start, end), [start, end]);
  const total = Math.max(0, days * dailyRate - discount);

  const onVehicleChange = (id: string) => {
    setVehicleId(id);
    const v = vehicles.find((x) => x.id === id);
    if (v) setDailyRate(v.daily_rate);
  };

  if (state.success) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <h2 className="text-lg font-semibold">Réservation créée</h2>
          <div className="flex gap-3">
            <Button asChild><Link href={`/agency/reservations/${state.success.id}`}>Ouvrir la réservation</Link></Button>
            <Button asChild variant="outline"><Link href="/agency/reservations">Voir toutes</Link></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (customers.length === 0 || vehicles.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          {customers.length === 0 && <p>Vous devez d'abord ajouter au moins un <Link href="/agency/customers/new" className="text-primary underline">client</Link>.</p>}
          {vehicles.length === 0 && <p>Vous devez d'abord ajouter au moins un <Link href="/agency/fleet/new" className="text-primary underline">véhicule</Link>.</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Client & véhicule</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Client" name="customer_id" error={fe.customer_id}>
            <Select id="customer_id" name="customer_id" defaultValue={defaultCustomerId ?? customers[0]?.id} required>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.phone ? ` — ${c.phone}` : ""}</option>
              ))}
            </Select>
          </Field>
          <Field label="Véhicule" name="vehicle_id" error={fe.vehicle_id}>
            <Select id="vehicle_id" name="vehicle_id" value={vehicleId} onChange={(e) => onVehicleChange(e.target.value)} required>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.license_plate})</option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Période & tarif</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date de début" name="start_date" error={fe.start_date}>
            <Input id="start_date" name="start_date" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label="Date de fin" name="end_date" error={fe.end_date}>
            <Input id="end_date" name="end_date" type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </Field>
          <Field label="Tarif journalier (MAD)" name="daily_rate" error={fe.daily_rate}>
            <Input id="daily_rate" name="daily_rate" type="number" step="0.01" min={0} value={dailyRate} onChange={(e) => setDailyRate(Number(e.target.value))} />
          </Field>
          <Field label="Remise (MAD)" name="discount" error={fe.discount}>
            <Input id="discount" name="discount" type="number" step="0.01" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </Field>
          <Field label="Lieu de prise en charge" name="pickup_location" error={fe.pickup_location}>
            <Input id="pickup_location" name="pickup_location" placeholder="Agence, aéroport…" />
          </Field>
          <Field label="Lieu de restitution" name="return_location" error={fe.return_location}>
            <Input id="return_location" name="return_location" placeholder="Agence, aéroport…" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="text-sm text-muted-foreground">
            {days > 0 ? <>{days} jour(s) × {formatCurrency(dailyRate)}{discount > 0 ? ` − ${formatCurrency(discount)} de remise` : ""}</> : "Sélectionnez les dates"}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total estimé</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(total)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
        <CardContent>
          <Field label="Notes internes" name="notes" error={fe.notes}>
            <Textarea id="notes" name="notes" placeholder="Informations complémentaires…" />
          </Field>
        </CardContent>
      </Card>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">{state.error}</p>
      )}

      <div className="flex items-center gap-3">
        <Submit />
        <Button asChild variant="ghost"><Link href="/agency/reservations">Annuler</Link></Button>
      </div>
    </form>
  );
}
