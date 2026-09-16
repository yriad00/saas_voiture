"use client";

import { useTransition } from "react";
import { Loader2, Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { voidInvoice } from "./invoice-actions";
import { Button } from "@/components/ui/button";

export function VoidInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const handleVoid = () => {
    const reason = window.prompt("Motif d’annulation (obligatoire)");
    if (!reason?.trim()) return;
    startTransition(async () => {
      const result = await voidInvoice(invoiceId, reason);
      if (result.error) window.alert(result.error);
      else router.refresh();
    });
  };
  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={handleVoid}>
      {pending ? <Loader2 className="animate-spin" /> : <Ban />}
      {pending ? "Annulation…" : "Annuler le document"}
    </Button>
  );
}
