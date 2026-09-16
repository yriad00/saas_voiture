"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus } from "lucide-react";
import { createBranch, type BranchFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Plus />} Ajouter la branche</Button>;
}

export function BranchForm() {
  const [state, action] = useActionState<BranchFormState, FormData>(createBranch, {});
  const errors = state.fieldErrors ?? {};
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Nouvelle branche</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nom" name="name" error={errors.name}><Input id="name" name="name" placeholder="Casablanca Aéroport" required /></Field>
            <Field label="Code" name="code" error={errors.code}><Input id="code" name="code" placeholder="AEROPORT" maxLength={16} required /></Field>
            <Field label="Ville" name="city" error={errors.city}><Input id="city" name="city" placeholder="Casablanca" /></Field>
            <Field label="Téléphone" name="phone" error={errors.phone}><Input id="phone" name="phone" placeholder="+212 5 22..." /></Field>
            <Field label="WhatsApp" name="whatsapp" error={errors.whatsapp}><Input id="whatsapp" name="whatsapp" placeholder="+212 6..." /></Field>
            <Field label="Email" name="email" error={errors.email}><Input id="email" name="email" type="email" placeholder="aeroport@agence.ma" /></Field>
            <Field label="Adresse" name="address" error={errors.address}><Input id="address" name="address" placeholder="Adresse de l'agence" /></Field>
          </div>
          {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">{state.error}</p>}
          {state.success && <p className="text-sm text-emerald-600">Branche créée.</p>}
          <Submit />
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, name, error, children }: { label: string; name: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={name}>{label}</Label>{children}{error && <p className="text-xs text-destructive">{error}</p>}</div>;
}
