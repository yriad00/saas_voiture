import { requireAgency } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Client — FleetHub" };

export default async function ClientHome() {
  const ctx = await requireAgency(["CLIENT"]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">My account</h1>
          <p className="text-sm text-muted-foreground">{ctx.membership.agencyName}</p>
        </div>
        <form action={signOut}>
          <Button variant="outline" size="sm" type="submit">Sign out</Button>
        </form>
      </div>
      <ComingSoon title="Client portal" phase="Phase 12 (Client Portal & Public Booking)" />
    </div>
  );
}
