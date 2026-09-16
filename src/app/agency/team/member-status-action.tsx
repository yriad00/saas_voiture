"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setMemberStatus } from "./actions";
import { Button } from "@/components/ui/button";

export function MemberStatusAction({ id, status }: { id: string; status: "active" | "disabled" | "invited" }) {
  const [pending, startTransition] = useTransition();
  if (status === "invited") return null;
  const next = status === "active" ? "disabled" : "active";
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await setMemberStatus(id, next);
        if (result?.error) window.alert(result.error);
      })}
    >
      {pending && <Loader2 className="size-3 animate-spin" />}
      {status === "active" ? "Désactiver" : "Réactiver"}
    </Button>
  );
}

