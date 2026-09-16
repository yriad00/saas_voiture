"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createPayment, type PaymentFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

type ContractOption = { id: string; contract_number: string; customerName: string };
type ReservationOption = { id: string; reference: string; customerName: string };

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
      Enregistrer le paiement
    </Button>
  );
}

export function PaymentForm({
  contracts,
  reservations,
  defaultContractId,
  defaultReservationId,
  backHref,
}: {
  contracts: ContractOption[];
  reservations: ReservationOption[];
  defaultContractId?: string;
  defaultReservationId?: string;
  backHref: string;
}) {
  const [state, action] = useActionState<PaymentFormState, FormData>(createPayment, {});
  const fe = state.fieldErrors ?? {};
  const router = useRouter();
  // A key belongs to one mounted submission attempt.  `useId()` is stable
  // across navigations in Next and can collide with a later legitimate
  // payment; a UUID keeps retries idempotent while allowing a new page to
  // create a new payment.
  const [idempotencyKey] = useState(() => typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (state.success && state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [state.success, state.redirectTo, router]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-6">
      <input type="text" className="hidden" name="idempotency_key" value={idempotencyKey} readOnly />
      <Card>
        <CardHeader><CardTitle className="text-base">Détails du paiement</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Contrat (optionnel)" name="contract_id" error={fe.contract_id}>
              <Select id="contract_id" name="contract_id" defaultValue={defaultContractId ?? ""}>
                <option value="">— Sans contrat —</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.contract_number} — {c.customerName}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Réservation (optionnel)" name="reservation_id" error={fe.reservation_id}>
              <Select id="reservation_id" name="reservation_id" defaultValue={defaultReservationId ?? ""}>
                <option value="">— Sans réservation —</option>
                {reservations.map((r) => (
                  <option key={r.id} value={r.id}>{r.reference} — {r.customerName}</option>
                ))}
              </Select>
            </Field>
            <p className="mt-1 text-xs text-muted-foreground">Utilisez ce lien pour enregistrer une avance ou un remboursement avant la création du contrat.</p>
          </div>
          <Field label="Montant (MAD)" name="amount" error={fe.amount}>
            <Input id="amount" name="amount" type="number" step="0.01" min={0} required placeholder="0.00" />
          </Field>
          <Field label="Date" name="paid_at" error={fe.paid_at}>
            <Input id="paid_at" name="paid_at" type="date" defaultValue={today} />
          </Field>
          <Field label="Type" name="type" error={fe.type}>
            <Select id="type" name="type" defaultValue="RENTAL">
              <option value="RENTAL">Location</option>
              <option value="DEPOSIT">Caution</option>
              <option value="DEPOSIT_REFUND">Restitution de caution</option>
              <option value="EXTRA">Supplément</option>
              <option value="PENALTY">Pénalité</option>
              <option value="REFUND">Remboursement</option>
            </Select>
          </Field>
          <Field label="Méthode" name="method" error={fe.method}>
            <Select id="method" name="method" defaultValue="CASH">
              <option value="CASH">Espèces</option>
              <option value="CARD">Carte bancaire</option>
              <option value="TRANSFER">Virement</option>
              <option value="CHECK">Chèque</option>
            </Select>
          </Field>
          <Field label="Statut" name="status" error={fe.status}>
            <Select id="status" name="status" defaultValue="COMPLETED">
              <option value="COMPLETED">Payé</option>
              <option value="PENDING">En attente</option>
              <option value="REFUNDED">Remboursé</option>
              <option value="FAILED">Échoué</option>
            </Select>
          </Field>
          <Field label="Référence (optionnel)" name="reference" error={fe.reference}>
            <Input id="reference" name="reference" placeholder="N° transaction, chèque…" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes" name="notes" error={fe.notes}>
              <Textarea id="notes" name="notes" placeholder="Informations complémentaires…" />
            </Field>
          </div>
        </CardContent>
      </Card>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">{state.error}</p>
      )}

      <div className="flex items-center gap-3">
        <Submit />
        <Button asChild variant="ghost"><Link href={backHref}>Annuler</Link></Button>
      </div>
    </form>
  );
}
