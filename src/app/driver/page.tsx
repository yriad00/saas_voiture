import { requireAgency } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Driver — FleetHub" };

export default async function DriverHome() {
  const ctx = await requireAgency(["DRIVER"]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Driver</h1>
          <p className="text-sm text-muted-foreground">{ctx.membership.agencyName}</p>
        </div>
        <form action={signOut}>
          <Button variant="outline" size="sm" type="submit">Sign out</Button>
        </form>
      </div>
      <ComingSoon title="Delivery & pickup missions" phase="Phase 10 (Drivers & Deliveries)" />
    </div>
  );
}
