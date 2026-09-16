"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removeContractExtra, removeReservationExtra } from "./actions";
export function RemoveExtraButton({ target, id }: { target: "reservation" | "contract"; id: string }) {
  const [pending, start] = useTransition();
  return <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await (target === "reservation" ? removeReservationExtra(id) : removeContractExtra(id)); })}>Retirer</Button>;
}
