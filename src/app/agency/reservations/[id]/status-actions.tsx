"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setReservationStatus } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RESERVATION_STATUS } from "@/lib/labels";
import type { Enums } from "@/lib/database.types";

// Allowed forward transitions per current status.
const NEXT: Record<Enums<"reservation_status">, Enums<"reservation_status">[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["ONGOING", "CANCELLED", "NO_SHOW"],
  ONGOING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function ReservationStatusActions({
  reservationId,
  current,
}: {
  reservationId: string;
  current: Enums<"reservation_status">;
}) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<"CASH" | "CARD" | "TRANSFER" | "CHECK">("TRANSFER");
  const [pendingStatus, setPendingStatus] = useState<Enums<"reservation_status"> | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const change = (status: Enums<"reservation_status">) => {
    if (status === "CANCELLED" || status === "NO_SHOW") {
      setPendingStatus(status);
      setReason("");
      setRefundAmount("");
      setRefundMethod("TRANSFER");
      return;
    }
    submit(status);
  };

  const submit = (status: Enums<"reservation_status">, statusReason?: string) => {
    startTransition(async () => {
      const res = await setReservationStatus(reservationId, status, statusReason, {
        refundAmount: Number(refundAmount || 0),
        refundMethod,
      });
      if (res?.error) {
        window.alert(res.error);
        return;
      }
      setPendingStatus(null);
      router.refresh();
    });
  };

  return (
    <>
      {NEXT[current].map((s) => (
        <Button
          key={s}
          variant={s === "CANCELLED" ? "outline" : "default"}
          size="sm"
          disabled={pending || !hydrated}
          onClick={() => change(s)}
        >
          {pending && <Loader2 className="animate-spin" />}
          {s === "CONFIRMED" && "Confirmer"}
          {s === "ONGOING" && "Démarrer la location"}
          {s === "COMPLETED" && "Clôturer"}
          {s === "CANCELLED" && "Annuler"}
          {s === "NO_SHOW" && "Marquer absent"}
          {!["CONFIRMED", "ONGOING", "COMPLETED", "CANCELLED"].includes(s) && RESERVATION_STATUS[s].label}
        </Button>
      ))}
      {pendingStatus && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
          <label htmlFor="reservation-status-reason" className="text-sm font-medium">
            Motif (optionnel)
          </label>
          <Input
            id="reservation-status-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={pendingStatus === "NO_SHOW" ? "Client absent" : "Motif de l’annulation"}
            disabled={pending}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="reservation-refund-amount" className="text-sm font-medium">Remboursement avance (MAD, optionnel)</label>
              <Input id="reservation-refund-amount" type="number" min="0" step="0.01" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} placeholder="0,00" disabled={pending} />
            </div>
            <div>
              <label htmlFor="reservation-refund-method" className="text-sm font-medium">Méthode de remboursement</label>
              <select id="reservation-refund-method" value={refundMethod} onChange={(event) => setRefundMethod(event.target.value as typeof refundMethod)} disabled={pending} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="TRANSFER">Virement</option>
                <option value="CASH">Espèces</option>
                <option value="CARD">Carte</option>
                <option value="CHECK">Chèque</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
              <Button type="button" size="sm" disabled={pending || !hydrated} onClick={() => submit(pendingStatus, reason.trim() || undefined)}>
              Confirmer
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending || !hydrated} onClick={() => setPendingStatus(null)}>
              Retour
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
