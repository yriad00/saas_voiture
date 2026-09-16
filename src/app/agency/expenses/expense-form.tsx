"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { createExpense, type ExpenseFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

type Vehicle = { id: string; brand: string; model: string; license_plate: string };

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Enregistrer la dépense</Button>;
}

function Field({ label, name, error, children }: { label: string; name: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={name}>{label}</Label>{children}{error && <p className="text-xs text-destructive">{error}</p>}</div>;
}

export function ExpenseForm({ vehicles }: { vehicles: Vehicle[] }) {
  const [state, action] = useActionState<ExpenseFormState, FormData>(createExpense, {});
  const [idempotencyKey] = useState(() => typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `expense-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const fe = state.fieldErrors ?? {};
  if (state.success) return <Card><CardContent className="space-y-4 p-8 text-center"><p className="font-medium">Dépense enregistrée.</p><Button asChild variant="outline"><a href="/agency/expenses">Voir les dépenses</a></Button></CardContent></Card>;
  return <form action={action} className="space-y-6">
    <input type="hidden" name="idempotency_key" value={idempotencyKey} readOnly />
    <Card><CardHeader><CardTitle className="text-base">Détails de la dépense</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Catégorie" name="category" error={fe.category}><Select id="category" name="category" defaultValue="OTHER"><option value="FUEL">Carburant</option><option value="INSURANCE">Assurance</option><option value="TAX">Taxes et vignettes</option><option value="RENT">Loyer</option><option value="SALARY">Salaires</option><option value="MARKETING">Marketing</option><option value="SUPPLIES">Fournitures</option><option value="OTHER">Autre</option></Select></Field>
      <Field label="Montant (MAD)" name="amount" error={fe.amount}><Input id="amount" name="amount" type="number" step="0.01" min="0.01" required /></Field>
      <Field label="Date" name="expense_date" error={fe.expense_date}><Input id="expense_date" name="expense_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field>
      <Field label="Méthode" name="payment_method" error={fe.payment_method}><Select id="payment_method" name="payment_method" defaultValue="CASH"><option value="CASH">Espèces</option><option value="CARD">Carte bancaire</option><option value="TRANSFER">Virement</option><option value="CHECK">Chèque</option></Select></Field>
      <Field label="Véhicule (optionnel)" name="vehicle_id" error={fe.vehicle_id}><Select id="vehicle_id" name="vehicle_id" defaultValue=""><option value="">Dépense agence</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model} ({vehicle.license_plate})</option>)}</Select></Field>
      <Field label="Fournisseur" name="vendor" error={fe.vendor}><Input id="vendor" name="vendor" /></Field>
      <div className="sm:col-span-2"><Field label="Description" name="description" error={fe.description}><Textarea id="description" name="description" rows={3} /></Field></div>
    </CardContent></Card>
    {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">{state.error}</p>}
    <Submit />
  </form>;
}
