import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { getCustomer } from "@/lib/services/customers";
import { CustomerForm } from "../../customer-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Modifier le client — FleetHub" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer || customer.agency_id !== ctx.membership.agencyId) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href={`/agency/customers/${customer.id}`}><ArrowLeft /> Retour au client</Link>
      </Button>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Modifier {customer.first_name} {customer.last_name}
        </h1>
      </div>
      <CustomerForm customer={customer} />
    </div>
  );
}
