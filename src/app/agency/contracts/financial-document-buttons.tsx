"use client";

import { useTransition } from "react";
import { FileText, Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { issueFinancialDocument } from "./invoice-actions";
import { Button } from "@/components/ui/button";

export function FinancialDocumentButtons({ contractId }: { contractId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const create = (kind: "QUOTE" | "RECEIPT") => startTransition(async () => { const result = await issueFinancialDocument(contractId, kind); if (result.error) window.alert(result.error); else if (result.id) router.push(`/agency/contracts/${contractId}/invoice/${result.id}`); });
  return <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => create("QUOTE")}><FileText /> Devis</Button><Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => create("RECEIPT")}><Receipt /> Reçu</Button></div>;
}
