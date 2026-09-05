"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, PauseCircle, PlayCircle, Ban, Loader2 } from "lucide-react";
import { setAgencyStatus } from "../actions";
import { Button } from "@/components/ui/button";
import type { Enums } from "@/lib/database.types";

type Action = {
  status: Enums<"agency_status">;
  label: string;
  icon: typeof Power;
  variant: "default" | "destructive" | "outline" | "secondary";
  confirm: string;
};

// Actions available depend on current status.
function actionsFor(current: Enums<"agency_status">): Action[] {
  const activate: Action = {
    status: "ACTIVE",
    label: "Activate",
    icon: PlayCircle,
    variant: "default",
    confirm: "Activate this agency? Its users will regain access.",
  };
  const deactivate: Action = {
    status: "INACTIVE",
    label: "Deactivate",
    icon: Power,
    variant: "outline",
    confirm: "Deactivate this agency? Users lose access but all data is preserved.",
  };
  const suspend: Action = {
    status: "SUSPENDED",
    label: "Suspend",
    icon: PauseCircle,
    variant: "outline",
    confirm: "Suspend this agency? Users lose access until reactivated. Data is preserved.",
  };
  const expire: Action = {
    status: "EXPIRED",
    label: "Mark expired",
    icon: Ban,
    variant: "outline",
    confirm: "Mark this agency's subscription as expired? Users lose access.",
  };

  switch (current) {
    case "ACTIVE":
    case "TRIAL":
      return [deactivate, suspend, expire];
    case "INACTIVE":
    case "SUSPENDED":
    case "EXPIRED":
      return [activate];
    default:
      return [activate];
  }
}

export function StatusActions({
  agencyId,
  current,
}: {
  agencyId: string;
  current: Enums<"agency_status">;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (a: Action) => {
    if (!window.confirm(a.confirm)) return;
    startTransition(async () => {
      const res = await setAgencyStatus(agencyId, a.status);
      if (res?.error) {
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {actionsFor(current).map((a) => {
        const Icon = a.icon;
        return (
          <Button key={a.status} variant={a.variant} size="sm" disabled={pending} onClick={() => run(a)}>
            {pending ? <Loader2 className="animate-spin" /> : <Icon />}
            {a.label}
          </Button>
        );
      })}
    </div>
  );
}
