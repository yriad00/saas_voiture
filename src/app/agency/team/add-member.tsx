"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus, Loader2, CheckCircle2, X } from "lucide-react";
import { addMember, type MemberFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";

type BranchOption = { id: string; name: string; code: string };

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
      Créer le compte
    </Button>
  );
}

export function AddMember({ branches = [] }: { branches?: BranchOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<MemberFormState, FormData>(addMember, {});
  const fe = state.fieldErrors ?? {};

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <UserPlus /> Ajouter un membre
      </Button>
    );
  }

  if (state.success) {
    return (
      <Card className="mb-6">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-6 text-green-600" />
            <h3 className="font-semibold">Invitation envoyée</h3>
          </div>
          <p className="text-sm text-muted-foreground">Un lien d&apos;invitation a été envoyé à <strong>{state.success.email}</strong>. Le membre choisira son propre mot de passe à l&apos;activation.</p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)} type="button">Fermer</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Nouveau membre</CardTitle>
        <button onClick={() => setOpen(false)} aria-label="Fermer"><X className="size-4 text-muted-foreground" /></button>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nom complet" name="full_name" error={fe.full_name}>
              <Input id="full_name" name="full_name" placeholder="Sara El Amrani" required />
            </Field>
            <Field label="Email" name="email" error={fe.email}>
              <Input id="email" name="email" type="email" placeholder="sara@agence.ma" required />
            </Field>
            <Field label="Téléphone" name="phone" error={fe.phone}>
              <Input id="phone" name="phone" placeholder="+212 6 00 00 00 00" />
            </Field>
            <Field label="Rôle" name="role_key" error={fe.role_key}>
              <Select id="role_key" name="role_key" defaultValue="AGENT">
                <option value="MANAGER">Gérant</option>
                <option value="AGENT">Agent</option>
                <option value="ACCOUNTANT">Comptable</option>
              </Select>
            </Field>
            {branches.length > 0 && (
              <Field label="Branche" name="branch_id" error={fe.branch_id}>
                <Select id="branch_id" name="branch_id" defaultValue="">
                  <option value="">Toutes les branches</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>)}
                </Select>
              </Field>
            )}
          </div>
          {state.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">{state.error}</p>
          )}
          <Submit />
        </form>
      </CardContent>
    </Card>
  );
}
