"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus, Loader2, Copy, CheckCircle2, X } from "lucide-react";
import { addMember, type MemberFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";

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

export function AddMember() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<MemberFormState, FormData>(addMember, {});
  const [copied, setCopied] = useState(false);
  const fe = state.fieldErrors ?? {};

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <UserPlus /> Ajouter un membre
      </Button>
    );
  }

  if (state.success) {
    const copy = async () => {
      await navigator.clipboard.writeText(`Email : ${state.success!.email}\nMot de passe : ${state.success!.tempPassword}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    return (
      <Card className="mb-6">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-6 text-green-600" />
            <h3 className="font-semibold">Membre ajouté</h3>
          </div>
          <p className="text-sm text-muted-foreground">Communiquez ces identifiants au membre. Il devra changer son mot de passe.</p>
          <div className="rounded-lg border border-border bg-muted/50 p-4 font-mono text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Email</span><span>{state.success.email}</span></div>
            <div className="mt-2 flex justify-between gap-4"><span className="text-muted-foreground">Mot de passe</span><span className="font-semibold">{state.success.tempPassword}</span></div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={copy} type="button"><Copy /> {copied ? "Copié" : "Copier"}</Button>
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
