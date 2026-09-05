"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setReservationStatus } from "../actions";
import { Button } from "@/components/ui/button";
import { RESERVATION_STATUS } from "@/lib/labels";
import type { Enums } from "@/lib/database.types";

// Allowed forward transitions per current status.
const NEXT: Record<Enums<"reservation_status">, Enums<"reservation_status">[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ONGOING", "CANCELLED"],
  ONGOING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function ReservationStatusActions({
  reservationId,
  current,
}: {
  reservationId: string;
  current: Enums<"reservation_status">;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const change = (status: Enums<"reservation_status">) => {
    startTransition(async () => {
      const res = await setReservationStatus(reservationId, status);
      if (res?.error) {
        window.alert(res.error);
        return;
      }
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
          disabled={pending}
          onClick={() => change(s)}
        >
          {pending && <Loader2 className="animate-spin" />}
          {s === "CONFIRMED" && "Confirmer"}
          {s === "ONGOING" && "Démarrer la location"}
          {s === "COMPLETED" && "Clôturer"}
          {s === "CANCELLED" && "Annuler"}
          {!["CONFIRMED", "ONGOING", "COMPLETED", "CANCELLED"].includes(s) && RESERVATION_STATUS[s].label}
        </Button>
      ))}
    </>
  );
}
