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
type ChargeSettings = Settings & {
  mileage_allowance?: number | null;
  extra_mileage_rate?: number | null;
  fuel_shortfall_rate?: number | null;
  cleaning_fee?: number | null;
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
  const chargeSettings = settings as ChargeSettings | null;
  const [state, action] = useActionState<SettingsFormState, FormData>(updateAgencySettings, {});
  const fe = state.fieldErrors ?? {};
  const extra = (settings?.extra ?? {}) as Record<string, unknown>;
  const extraValue = (key: string) => typeof extra[key] === "string" ? extra[key] as string : "";

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
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm font-medium">Identifiants de facturation</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <Field label="Identifiant fiscal (IF)" name="tax_id" error={fe.tax_id}>
                  <Input id="tax_id" name="tax_id" defaultValue={extraValue("tax_id")} disabled={disabled} />
                </Field>
                <Field label="Taxe professionnelle (TP)" name="professional_tax_id" error={fe.professional_tax_id}>
                  <Input id="professional_tax_id" name="professional_tax_id" defaultValue={extraValue("professional_tax_id")} disabled={disabled} />
                </Field>
                <Field label="ICE" name="ice" error={fe.ice}>
                  <Input id="ice" name="ice" defaultValue={extraValue("ice")} disabled={disabled} />
                </Field>
                <Field label="RC" name="rc_number" error={fe.rc_number}><Input id="rc_number" name="rc_number" defaultValue={extraValue("rc_number")} disabled={disabled} /></Field>
              </div>
              <div className="mt-4">
                <Field label="Pied de facture" name="invoice_footer" error={fe.invoice_footer}>
                  <Textarea id="invoice_footer" name="invoice_footer" defaultValue={extraValue("invoice_footer")} disabled={disabled} rows={2} />
                </Field>
              </div>
            </div>
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm font-medium">Conditions par défaut du contrat</p>
              <Field label="Termes en français" name="contract_terms_fr" error={fe.contract_terms_fr}>
                <Textarea id="contract_terms_fr" name="contract_terms_fr" defaultValue={extraValue("contract_terms_fr")} disabled={disabled} rows={5} placeholder="Ces termes seront proposés automatiquement à la création d’un contrat." />
              </Field>
              <div className="mt-4" dir="rtl">
                <Field label="الشروط بالعربية" name="contract_terms_ar" error={fe.contract_terms_ar}>
                  <Textarea id="contract_terms_ar" name="contract_terms_ar" dir="rtl" defaultValue={extraValue("contract_terms_ar")} disabled={disabled} rows={5} placeholder="الشروط الافتراضية للعقد" />
                </Field>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Les textes restent modifiables sur chaque contrat et sont conservés dans son historique.</p>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Règle kilométrique" name="mileage_policy" error={fe.mileage_policy}>
                <select id="mileage_policy" name="mileage_policy" defaultValue={settings?.mileage_policy ?? "UNLIMITED"} disabled={disabled} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="UNLIMITED">Kilométrage illimité</option>
                  <option value="LIMITED">Kilométrage inclus limité</option>
                  <option value="UNSPECIFIED">À définir au contrat</option>
                </select>
              </Field>
              <Field label="Kilomètres inclus" name="mileage_allowance" error={fe.mileage_allowance}>
                <Input id="mileage_allowance" name="mileage_allowance" type="number" min={0} step={1} defaultValue={chargeSettings?.mileage_allowance ?? ""} disabled={disabled} />
              </Field>
              <Field label="Km supplémentaire (MAD)" name="extra_mileage_rate" error={fe.extra_mileage_rate}>
                <Input id="extra_mileage_rate" name="extra_mileage_rate" type="number" min={0} step="0.01" defaultValue={chargeSettings?.extra_mileage_rate ?? 2} disabled={disabled} />
              </Field>
              <Field label="Niveau carburant manquant (MAD)" name="fuel_shortfall_rate" error={fe.fuel_shortfall_rate}>
                <Input id="fuel_shortfall_rate" name="fuel_shortfall_rate" type="number" min={0} step="0.01" defaultValue={chargeSettings?.fuel_shortfall_rate ?? 100} disabled={disabled} />
              </Field>
              <Field label="Nettoyage (MAD)" name="cleaning_fee" error={fe.cleaning_fee}>
                <Input id="cleaning_fee" name="cleaning_fee" type="number" min={0} step="0.01" defaultValue={chargeSettings?.cleaning_fee ?? 200} disabled={disabled} />
              </Field>
            </div>
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
