import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { CustomerForm } from "../customer-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Ajouter un client — FleetHub" };

export default async function NewCustomerPage() {
  await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/agency/customers"><ArrowLeft /> Retour aux clients</Link>
      </Button>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Ajouter un client</h1>
        <p className="mt-1 text-sm text-muted-foreground">Renseignez les informations du client.</p>
      </div>
      <CustomerForm />
    </div>
  );
}
