"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { updateAgencySettings, type SettingsFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { Tables } from "@/lib/database.types";

type Agency = Tables<"agencies">;
type Settings = Tables<"agency_settings">;

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
      Enregistrer les modifications
    </Button>
  );
}

export function SettingsForm({
  agency,
  settings,
  readOnly,
}: {
  agency: Agency;
  settings: Settings | null;
  readOnly: boolean;
}) {
  const [state, action] = useActionState<SettingsFormState, FormData>(updateAgencySettings, {});
  const fe = state.fieldErrors ?? {};

  const disabled = readOnly;

  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Informations générales</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Nom de l'agence" name="name" error={fe.name}>
              <Input id="name" name="name" defaultValue={agency.name} disabled={disabled} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email" name="email" error={fe.email}>
                <Input id="email" name="email" type="email" defaultValue={agency.email ?? ""} disabled={disabled} />
              </Field>
              <Field label="Téléphone" name="phone" error={fe.phone}>
                <Input id="phone" name="phone" defaultValue={agency.phone ?? ""} disabled={disabled} />
              </Field>
            </div>
            <Field label="Adresse" name="address" error={fe.address}>
              <Input id="address" name="address" defaultValue={agency.address ?? ""} disabled={disabled} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ville" name="city" error={fe.city}>
                <Input id="city" name="city" defaultValue={agency.city ?? ""} disabled={disabled} />
              </Field>
              <Field label="Pays" name="country" error={fe.country}>
                <Input id="country" name="country" defaultValue={agency.country ?? ""} disabled={disabled} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div><span className="block text-xs">Slug</span>/{agency.slug}</div>
              <div><span className="block text-xs">Devise</span>{agency.currency}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Politiques de location</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Taux de TVA (%)" name="tax_rate" error={fe.tax_rate}>
                <Input id="tax_rate" name="tax_rate" type="number" step="0.01" min={0} max={100} defaultValue={settings?.tax_rate ?? 20} disabled={disabled} />
              </Field>
              <Field label="Caution par défaut (MAD)" name="default_deposit" error={fe.default_deposit}>
                <Input id="default_deposit" name="default_deposit" type="number" step="0.01" min={0} defaultValue={settings?.default_deposit ?? 0} disabled={disabled} />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <input id="deposit_required" name="deposit_required" type="checkbox" value="true" defaultChecked={settings?.deposit_required ?? false} disabled={disabled} className="size-4 rounded border-input" />
              <Label htmlFor="deposit_required" className="font-normal">Caution obligatoire</Label>
            </div>
            <Field label="Politique d'annulation" name="cancellation_policy" error={fe.cancellation_policy}>
              <Textarea id="cancellation_policy" name="cancellation_policy" defaultValue={settings?.cancellation_policy ?? ""} disabled={disabled} rows={2} />
            </Field>
            <Field label="Politique de retour tardif" name="late_return_policy" error={fe.late_return_policy}>
              <Textarea id="late_return_policy" name="late_return_policy" defaultValue={settings?.late_return_policy ?? ""} disabled={disabled} rows={2} />
            </Field>
            <Field label="Politique de carburant" name="fuel_policy" error={fe.fuel_policy}>
              <Textarea id="fuel_policy" name="fuel_policy" defaultValue={settings?.fuel_policy ?? ""} disabled={disabled} rows={2} />
            </Field>
          </CardContent>
        </Card>
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/50 dark:text-green-400">
          <CheckCircle2 className="size-4" /> Modifications enregistrées.
        </p>
      )}

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Submit />
        </div>
      )}
      {readOnly && (
        <p className="text-sm text-muted-foreground">
          Seuls le propriétaire et les gérants peuvent modifier les paramètres.
        </p>
      )}
    </form>
  );
}
