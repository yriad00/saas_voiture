import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PaymentForm } from "../payment-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Nouveau paiement — FleetHub" };

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ contract?: string }>;
}) {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"]);
  const { contract } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase
    .from("contracts")
    .select("id, contract_number, customers!inner(first_name, last_name)")
    .eq("agency_id", ctx.membership.agencyId)
    .order("created_at", { ascending: false });

  const contracts = (data ?? []).map((c) => {
    const cu = c.customers as unknown as { first_name: string; last_name: string };
    return { id: c.id, contract_number: c.contract_number, customerName: `${cu.first_name} ${cu.last_name}` };
  });

  const backHref = contract ? `/agency/contracts/${contract}` : "/agency/payments";

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href={backHref}><ArrowLeft /> Retour</Link>
      </Button>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau paiement</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enregistrez un encaissement, une caution ou un remboursement.</p>
      </div>
      <PaymentForm contracts={contracts} defaultContractId={contract} backHref={backHref} />
    </div>
  );
}
