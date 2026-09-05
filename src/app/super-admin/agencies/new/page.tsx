import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/session";
import { NewAgencyForm } from "./new-agency-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "New agency — FleetHub Admin" };

export default async function NewAgencyPage() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, price, max_vehicles, max_users, max_branches")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/super-admin/agencies">
          <ArrowLeft /> Back to agencies
        </Link>
      </Button>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Create a new agency</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This provisions the agency, its owner account, settings and subscription in one step.
        </p>
      </div>
      <NewAgencyForm plans={plans ?? []} />
    </div>
  );
}
