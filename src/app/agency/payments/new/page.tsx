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
  searchParams: Promise<{ contract?: string; reservation?: string }>;
}) {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"]);
  const { contract, reservation } = await searchParams;

  const supabase = await createClient();
  const [{ data }, { data: reservations }] = await Promise.all([supabase
    .from("contracts")
    .select("id, contract_number, customers!contracts_customer_id_fkey!inner(first_name, last_name)")
    .eq("agency_id", ctx.membership.agencyId)
    .order("created_at", { ascending: false }), supabase
    .from("reservations")
    .select("id, reference, customer_id, customers!reservations_customer_id_fkey!inner(first_name, last_name)")
    .eq("agency_id", ctx.membership.agencyId)
    .in("status", ["PENDING", "CONFIRMED", "CANCELLED", "NO_SHOW"])
    .order("created_at", { ascending: false })]);

  const contracts = (data ?? []).map((c) => {
    const cu = c.customers as unknown as { first_name: string; last_name: string };
    return { id: c.id, contract_number: c.contract_number, customerName: `${cu.first_name} ${cu.last_name}` };
  });

  const backHref = contract ? `/agency/contracts/${contract}` : reservation ? `/agency/reservations/${reservation}` : "/agency/payments";
  const reservationOptions = (reservations ?? []).map((r) => {
    const customer = r.customers as unknown as { first_name: string; last_name: string };
    return { id: r.id, reference: r.reference, customerName: `${customer.first_name} ${customer.last_name}` };
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href={backHref}><ArrowLeft /> Retour</Link>
      </Button>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau paiement</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enregistrez un encaissement, une caution ou un remboursement.</p>
      </div>
      <PaymentForm contracts={contracts} reservations={reservationOptions} defaultContractId={contract} defaultReservationId={reservation} backHref={backHref} />
    </div>
  );
}
