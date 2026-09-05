"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { createAgency, type CreateAgencyState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { slugify } from "@/lib/utils";

type Plan = { id: string; name: string; price: number; max_vehicles: number | null; max_users: number | null; max_branches: number | null };

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
      Create agency
    </Button>
  );
}

export function NewAgencyForm({ plans }: { plans: Plan[] }) {
  const [state, action] = useActionState<CreateAgencyState, FormData>(createAgency, {});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [trial, setTrial] = useState(true);
  const fe = state.fieldErrors ?? {};

  if (state.success) {
    return <SuccessPanel data={state.success} />;
  }

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agency details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Agency name" name="name" error={fe.name}>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(slugify(e.target.value));
              }}
              placeholder="Atlas Car Rental"
              required
            />
          </Field>
          <Field label="Slug (public URL)" name="slug" error={fe.slug}>
            <Input id="slug" name="slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="atlas-car-rental" required />
          </Field>
          <Field label="Contact email" name="email" error={fe.email}>
            <Input id="email" name="email" type="email" placeholder="contact@atlas.ma" />
          </Field>
          <Field label="Phone" name="phone" error={fe.phone}>
            <Input id="phone" name="phone" placeholder="+212 6 00 00 00 00" />
          </Field>
          <Field label="City" name="city" error={fe.city}>
            <Input id="city" name="city" placeholder="Casablanca" />
          </Field>
          <Field label="Country" name="country" error={fe.country}>
            <Input id="country" name="country" defaultValue="Morocco" />
          </Field>
          <Field label="Currency" name="currency" error={fe.currency}>
            <Select id="currency" name="currency" defaultValue="MAD">
              <option value="MAD">MAD — Moroccan Dirham</option>
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — US Dollar</option>
            </Select>
          </Field>
          <Field label="Timezone" name="timezone" error={fe.timezone}>
            <Input id="timezone" name="timezone" defaultValue="Africa/Casablanca" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address" name="address" error={fe.address}>
              <Input id="address" name="address" placeholder="123 Bd Mohammed V" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Internal notes" name="notes" error={fe.notes}>
              <Textarea id="notes" name="notes" placeholder="Anything the platform team should know…" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Owner account</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Owner full name" name="ownerName" error={fe.ownerName}>
            <Input id="ownerName" name="ownerName" placeholder="Youssef Alaoui" required />
          </Field>
          <Field label="Owner email" name="ownerEmail" error={fe.ownerEmail}>
            <Input id="ownerEmail" name="ownerEmail" type="email" placeholder="owner@atlas.ma" required />
          </Field>
          <Field label="Owner phone" name="ownerPhone" error={fe.ownerPhone}>
            <Input id="ownerPhone" name="ownerPhone" placeholder="+212 6 00 00 00 00" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan & subscription</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Plan" name="planId" error={fe.planId}>
            <Select id="planId" name="planId" defaultValue={plans[0]?.id} required>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.price} / mo ({p.max_vehicles ?? "∞"} vehicles, {p.max_users ?? "∞"} users)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="End / renewal date" name="endsAt" error={fe.endsAt}>
            <Input id="endsAt" name="endsAt" type="date" />
          </Field>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="trial"
              name="trial"
              type="checkbox"
              checked={trial}
              onChange={(e) => setTrial(e.target.checked)}
              value="true"
              className="size-4 rounded border-input"
            />
            <Label htmlFor="trial" className="font-normal">
              Start as a trial (otherwise the agency is activated immediately)
            </Label>
          </div>
        </CardContent>
      </Card>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Submit />
        <Button asChild variant="ghost">
          <Link href="/super-admin/agencies">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

function SuccessPanel({ data }: { data: NonNullable<CreateAgencyState["success"]> }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(`Email: ${data.ownerEmail}\nTemporary password: ${data.tempPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Card>
      <CardContent className="space-y-5 p-8">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-8 text-green-600" />
          <div>
            <h2 className="text-lg font-semibold">Agency created</h2>
            <p className="text-sm text-muted-foreground">Share these credentials securely with the owner.</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/50 p-4 font-mono text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Email</span>
            <span>{data.ownerEmail}</span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-muted-foreground">Temporary password</span>
            <span className="font-semibold">{data.tempPassword}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          The owner should sign in and change this password immediately. (Email-based invitations
          will be sent automatically once SMTP is configured for the project.)
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={copy} type="button">
            <Copy /> {copied ? "Copied" : "Copy credentials"}
          </Button>
          <Button asChild>
            <Link href={`/super-admin/agencies/${data.agencyId}`}>Open agency</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/super-admin/agencies">Back to list</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
