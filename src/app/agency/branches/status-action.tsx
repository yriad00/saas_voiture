"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setBranchStatus } from "./actions";
import { Button } from "@/components/ui/button";

export function BranchStatusAction({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => {
    const result = await setBranchStatus(id, !active);
    if (result?.error) window.alert(result.error);
  })}>{pending && <Loader2 className="size-3 animate-spin" />}{active ? "Désactiver" : "Réactiver"}</Button>;
}
