"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, Plus, UserRound } from "lucide-react";
import { createReservation, type ReservationFormState } from "./actions";
import { createQuickCustomer, type QuickCustomerFormState } from "@/app/agency/customers/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { formatCurrency, roundMoney } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

type CustomerOption = { id: string; first_name: string; last_name: string; phone: string | null };
type VehicleOption = { id: string; brand: string; model: string; license_plate: string; daily_rate: number; category?: string | null };
type BranchOption = Pick<Tables<"branches">, "id" | "name" | "code">;

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

function QuickCustomerSubmit({ action }: { action: (formData: FormData) => void }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" formAction={action} formNoValidate disabled={pending} size="sm">
      {pending && <Loader2 className="animate-spin" />}
      Ajouter et sélectionner
    </Button>
  );
}

function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? Math.max(1, diff) : 0;
}

export function ReservationForm({
  customers,
  vehicles,
  branches = [],
  defaultCustomerId,
}: {
  customers: CustomerOption[];
  vehicles: VehicleOption[];
  branches?: BranchOption[];
  defaultCustomerId?: string;
}) {
  const [state, action] = useActionState<ReservationFormState, FormData>(createReservation, {});
  const [quickState, quickAction] = useActionState<QuickCustomerFormState, FormData>(createQuickCustomer, {});
  const fe = state.fieldErrors ?? {};

  const [customerOptions, setCustomerOptions] = useState(customers);
  const [selectedCustomerId, setSelectedCustomerId] = useState(defaultCustomerId ?? customers[0]?.id ?? "");
  const [showQuickCustomer, setShowQuickCustomer] = useState(customers.length === 0);
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const categories = useMemo(() => Array.from(new Set(vehicles.map((v) => v.category).filter(Boolean) as string[])).sort(), [vehicles]);
  const [dailyRate, setDailyRate] = useState(vehicles[0]?.daily_rate ?? 0);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [discount, setDiscount] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [oneWayFee, setOneWayFee] = useState(0);

  useEffect(() => {
    const customer = quickState.success;
    if (!customer) return;
    queueMicrotask(() => {
      setCustomerOptions((current) => [customer, ...current.filter((item) => item.id !== customer.id)]);
      setSelectedCustomerId(customer.id);
      setShowQuickCustomer(false);
    });
  }, [quickState.success]);

  const days = useMemo(() => daysBetween(start, end), [start, end]);
  const total = roundMoney(Math.max(0, days * dailyRate - discount) + oneWayFee);

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

  if (vehicles.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
           <p>Vous devez d&apos;abord ajouter au moins un <Link href="/agency/fleet/new" className="text-primary underline">véhicule</Link>.</p>
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
            <div className="flex items-start gap-2">
              <Select id="customer_id" name="customer_id" value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)} required disabled={customerOptions.length === 0}>
                {customerOptions.length === 0 && <option value="">Ajoutez un client ci-dessous</option>}
                {customerOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.phone ? ` — ${c.phone}` : ""}</option>
                ))}
              </Select>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setShowQuickCustomer((open) => !open)}>
                <Plus /> Client rapide
              </Button>
            </div>
            {showQuickCustomer && (
              <div className="mt-3 space-y-3 rounded-md border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium"><UserRound className="size-4 text-primary" /> Ajouter un client en 30 secondes</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label htmlFor="quick_first_name">Prénom</Label><Input id="quick_first_name" name="quick_first_name" placeholder="Ahmed" /></div>
                  <div className="space-y-1"><Label htmlFor="quick_last_name">Nom</Label><Input id="quick_last_name" name="quick_last_name" placeholder="Bennani" /></div>
                  <div className="space-y-1"><Label htmlFor="quick_phone">Téléphone</Label><Input id="quick_phone" name="quick_phone" type="tel" placeholder="+212 6 00 00 00 00" /></div>
                  <div className="space-y-1"><Label htmlFor="quick_email">Email (optionnel)</Label><Input id="quick_email" name="quick_email" type="email" placeholder="ahmed@exemple.ma" /></div>
                </div>
                {quickState.error && <p className="text-xs text-destructive">{quickState.error}</p>}
                <QuickCustomerSubmit action={quickAction} />
              </div>
            )}
            {customerOptions.length === 0 && <p className="text-xs text-muted-foreground">Le client sera automatiquement sélectionné après son ajout.</p>}
          </Field>
          <Field label="Véhicule (ou catégorie à attribuer plus tard)" name="vehicle_id" error={fe.vehicle_id}>
            <Select id="vehicle_id" name="vehicle_id" value={vehicleId} onChange={(e) => onVehicleChange(e.target.value)} onInput={(e) => onVehicleChange(e.currentTarget.value)}>
              <option value="">Attribuer le véhicule plus tard</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.license_plate})</option>
              ))}
            </Select>
          </Field>
          <Field label="Catégorie demandée" name="vehicle_category" error={fe.vehicle_category}>
            <Select id="vehicle_category" name="vehicle_category" defaultValue="">
              <option value="">Choisir une catégorie si besoin</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </Select>
          </Field>
          {branches.length > 0 && <Field label="Branche de départ" name="pickup_branch_id" error={fe.pickup_branch_id}>
            <Select id="pickup_branch_id" name="pickup_branch_id" defaultValue=""><option value="">Agence entière</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>)}</Select>
          </Field>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Période & tarif</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date de début" name="start_date" error={fe.start_date}>
            <Input id="start_date" name="start_date" type="date" value={start} onChange={(e) => setStart(e.target.value)} onInput={(e) => setStart(e.currentTarget.value)} required />
          </Field>
          <Field label="Date de fin" name="end_date" error={fe.end_date}>
            <Input id="end_date" name="end_date" type="date" value={end} onChange={(e) => setEnd(e.target.value)} onInput={(e) => setEnd(e.currentTarget.value)} required />
          </Field>
          <Field label="Heure de départ" name="pickup_time" error={fe.pickup_time}>
            <Input id="pickup_time" name="pickup_time" type="time" defaultValue="10:00" required />
          </Field>
          <Field label="Heure de retour" name="return_time" error={fe.return_time}>
            <Input id="return_time" name="return_time" type="time" defaultValue="10:00" required />
          </Field>
          <Field label="Tarif journalier (MAD)" name="daily_rate" error={fe.daily_rate}>
            <Input id="daily_rate" name="daily_rate" type="number" step="0.01" min={0} value={dailyRate} onChange={(e) => setDailyRate(Number(e.target.value))} />
          </Field>
          <Field label="Remise (MAD)" name="discount" error={fe.discount}>
            <Input id="discount" name="discount" type="number" step="0.01" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </Field>
          <Field label="Code promotion" name="promotion_code" error={fe.promotion_code}>
            <Input id="promotion_code" name="promotion_code" placeholder="RAMADAN26" className="uppercase" />
          </Field>
          <Field label="Motif tarif exceptionnel" name="pricing_override_reason" error={fe.pricing_override_reason}>
            <Input id="pricing_override_reason" name="pricing_override_reason" placeholder="Client fidélité, compensation…" />
          </Field>
          <Field label="Lieu de prise en charge" name="pickup_location" error={fe.pickup_location}>
            <Input id="pickup_location" name="pickup_location" placeholder="Agence, aéroport…" />
          </Field>
          <Field label="Lieu de restitution" name="return_location" error={fe.return_location}>
            <Input id="return_location" name="return_location" placeholder="Agence, aéroport…" />
          </Field>
          {branches.length > 0 && <Field label="Branche de retour" name="return_branch_id" error={fe.return_branch_id}>
            <Select id="return_branch_id" name="return_branch_id" defaultValue=""><option value="">Même branche que le départ</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>)}</Select>
          </Field>}
          <Field label="Frais aller simple (MAD)" name="one_way_fee" error={fe.one_way_fee}><Input id="one_way_fee" name="one_way_fee" type="number" step="0.01" min={0} value={oneWayFee} onChange={(e) => setOneWayFee(Math.max(0, Number(e.target.value)))} /></Field>
          <Field label="Source" name="source" error={fe.source}><Select id="source" name="source" defaultValue="OTHER"><option value="WHATSAPP">WhatsApp</option><option value="PHONE">Téléphone</option><option value="INSTAGRAM">Instagram</option><option value="FACEBOOK">Facebook</option><option value="WEBSITE">Site web</option><option value="WALK_IN">Agence</option><option value="PARTNER">Partenaire</option><option value="OTHER">Autre</option></Select></Field>
          <Field label="Caution prévue (MAD)" name="deposit_amount" error={fe.deposit_amount}><Input id="deposit_amount" name="deposit_amount" type="number" step="0.01" min={0} value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} /></Field>
          <Field label="Avance prévue (MAD)" name="advance_amount" error={fe.advance_amount}><Input id="advance_amount" name="advance_amount" type="number" step="0.01" min={0} value={advance} onChange={(e) => setAdvance(Number(e.target.value))} /></Field>
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
