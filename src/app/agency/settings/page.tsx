import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/stat-card";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Paramètres — FleetHub" };

export default async function SettingsPage() {
  const ctx = await requireAgency();
  const supabase = await createClient();

  const [{ data: agency }, { data: settings }] = await Promise.all([
    supabase.from("agencies").select("*").eq("id", ctx.membership.agencyId).single(),
    supabase.from("agency_settings").select("*").eq("agency_id", ctx.membership.agencyId).maybeSingle(),
  ]);

  if (!agency) return null;

  const canEdit = ["AGENCY_OWNER", "MANAGER"].includes(ctx.membership.roleKey);

  return (
    <>
      <PageHeader
        title="Paramètres"
        description="Profil de l'agence, taxes et politiques de location."
      />
      <SettingsForm agency={agency} settings={settings ?? null} readOnly={!canEdit} />
    </>
  );
}
