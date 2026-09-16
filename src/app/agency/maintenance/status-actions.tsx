"use client";

import { useTransition } from "react";
import { Loader2, Check, X } from "lucide-react";
import { setMaintenanceStatus } from "./actions";
import { Button } from "@/components/ui/button";
import type { Enums } from "@/lib/database.types";

export function MaintenanceStatusActions({
  id,
  status,
}: {
  id: string;
  status: Enums<"maintenance_status">;
}) {
  const [pending, startTransition] = useTransition();
  const update = (next: "IN_PROGRESS" | "COMPLETED" | "CANCELLED") => {
    startTransition(async () => {
      const result = await setMaintenanceStatus(id, next);
      if (result?.error) window.alert(result.error);
    });
  };

  if (status === "COMPLETED" || status === "CANCELLED") return null;
  return (
    <div className="flex gap-1">
      {status === "SCHEDULED" && (
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => update("IN_PROGRESS")} title="Démarrer">
          {pending ? <Loader2 className="size-3 animate-spin" /> : <Loader2 className="size-3" />}
        </Button>
      )}
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => update("COMPLETED")} title="Terminer">
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => update("CANCELLED")} title="Annuler">
        <X className="size-3" />
      </Button>
    </div>
  );
}

