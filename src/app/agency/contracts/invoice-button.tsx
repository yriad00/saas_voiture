"use client";

import { useTransition } from "react";
import { FilePlus2, Loader2 } from "lucide-react";
import { issueInvoice } from "./invoice-actions";
import { Button } from "@/components/ui/button";

export function InvoiceButton({ contractId }: { contractId: string }) {
  const [pending, startTransition] = useTransition();
  const create = () => {
    startTransition(async () => {
      const result = await issueInvoice(contractId);
      if (result?.error) window.alert(result.error);
      else window.location.reload();
    });
  };

  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={create}>
      {pending ? <Loader2 className="animate-spin" /> : <FilePlus2 />}
      Émettre la facture
    </Button>
  );
}

