"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setVehicleStatus } from "../actions";
import { Button } from "@/components/ui/button";
import { VEHICLE_STATUS } from "@/lib/labels";
import type { Enums } from "@/lib/database.types";

const ORDER: Enums<"vehicle_status">[] = [
  "AVAILABLE",
  "RENTED",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
  "RESERVED",
];

export function VehicleStatusActions({
  vehicleId,
  current,
}: {
  vehicleId: string;
  current: Enums<"vehicle_status">;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const change = (status: Enums<"vehicle_status">) => {
    startTransition(async () => {
      const res = await setVehicleStatus(vehicleId, status);
      if (res?.error) {
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  const others = ORDER.filter((s) => s !== current).slice(0, 2);

  return (
    <>
      {others.map((s) => (
        <Button key={s} variant="outline" size="sm" disabled={pending} onClick={() => change(s)}>
          {pending && <Loader2 className="animate-spin" />}
          {VEHICLE_STATUS[s].label}
        </Button>
      ))}
    </>
  );
}
