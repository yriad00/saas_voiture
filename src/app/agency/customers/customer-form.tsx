"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createCustomer, updateCustomer, type CustomerFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { Tables } from "@/lib/database.types";

type Customer = Tables<"customers">;

function Field({ label, name, error, children }: { label: string; name: string; error?: string; children: React.ReactNode }) {
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

export function CustomerForm({ customer }: { customer?: Customer }) {
  const isEdit = !!customer;
  const boundAction = isEdit ? updateCustomer.bind(null, customer.id) : createCustomer;
  const [state, action] = useActionState<CustomerFormState, FormData>(boundAction, {});
  const fe = state.fieldErrors ?? {};

  if (state.success && !isEdit) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <h2 className="text-lg font-semibold">Client ajouté</h2>
          <div className="flex gap-3">
            <Button asChild><Link href="/agency/customers">Retour aux clients</Link></Button>
            <Button asChild variant="outline"><Link href="/agency/customers/new">Ajouter un autre</Link></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Prénom" name="first_name" error={fe.first_name}>
            <Input id="first_name" name="first_name" defaultValue={customer?.first_name} placeholder="Ahmed" required />
          </Field>
          <Field label="Nom" name="last_name" error={fe.last_name}>
            <Input id="last_name" name="last_name" defaultValue={customer?.last_name} placeholder="Bennani" required />
          </Field>
          <Field label="Email" name="email" error={fe.email}>
            <Input id="email" name="email" type="email" defaultValue={customer?.email ?? ""} placeholder="ahmed@exemple.ma" />
          </Field>
          <Field label="Téléphone" name="phone" error={fe.phone}>
            <Input id="phone" name="phone" defaultValue={customer?.phone ?? ""} placeholder="+212 6 00 00 00 00" />
          </Field>
          <Field label="Date de naissance" name="date_of_birth" error={fe.date_of_birth}>
            <Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={customer?.date_of_birth ?? ""} />
          </Field>
          <Field label="Nationalité" name="nationality" error={fe.nationality}>
            <Input id="nationality" name="nationality" defaultValue={customer?.nationality ?? ""} placeholder="Marocaine" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pièce d'identité & permis</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type de pièce" name="id_type" error={fe.id_type}>
            <Select id="id_type" name="id_type" defaultValue={customer?.id_type ?? "CIN"}>
              <option value="CIN">CIN</option>
              <option value="PASSPORT">Passeport</option>
              <option value="DRIVER_LICENSE">Permis de conduire</option>
              <option value="RESIDENCE_CARD">Carte de séjour</option>
            </Select>
          </Field>
          <Field label="N° de la pièce" name="id_number" error={fe.id_number}>
            <Input id="id_number" name="id_number" defaultValue={customer?.id_number ?? ""} placeholder="AB123456" />
          </Field>
          <Field label="N° permis de conduire" name="driver_license_number" error={fe.driver_license_number}>
            <Input id="driver_license_number" name="driver_license_number" defaultValue={customer?.driver_license_number ?? ""} />
          </Field>
          <Field label="Expiration du permis" name="driver_license_expiry" error={fe.driver_license_expiry}>
            <Input id="driver_license_expiry" name="driver_license_expiry" type="date" defaultValue={customer?.driver_license_expiry ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adresse & notes</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Adresse" name="address" error={fe.address}>
            <Input id="address" name="address" defaultValue={customer?.address ?? ""} placeholder="123 Bd Mohammed V" />
          </Field>
          <Field label="Ville" name="city" error={fe.city}>
            <Input id="city" name="city" defaultValue={customer?.city ?? ""} placeholder="Casablanca" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes internes" name="notes" error={fe.notes}>
              <Textarea id="notes" name="notes" defaultValue={customer?.notes ?? ""} placeholder="Informations complémentaires..." />
            </Field>
          </div>
        </CardContent>
      </Card>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Submit label={isEdit ? "Enregistrer" : "Ajouter le client"} />
        <Button asChild variant="ghost"><Link href="/agency/customers">Annuler</Link></Button>
      </div>
    </form>
  );
}
