import { ShieldAlert } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Accès refusé — FleetHub" };

const STATUS_FR: Record<string, string> = {
  INACTIVE: "inactive",
  SUSPENDED: "suspendue",
  EXPIRED: "expirée",
};

export default async function NoAccessPage() {
  const ctx = await getSessionContext();

  const suspended =
    ctx?.membership && !["ACTIVE", "TRIAL"].includes(ctx.membership.agencyStatus);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950">
            <ShieldAlert className="size-6" />
          </div>
          {suspended ? (
            <>
              <h1 className="text-lg font-semibold">Agence indisponible</h1>
              <p className="text-sm text-muted-foreground">
                Votre agence est actuellement{" "}
                <strong>{STATUS_FR[ctx!.membership!.agencyStatus] ?? ctx!.membership!.agencyStatus.toLowerCase()}</strong>.
                Contactez l'administrateur de la plateforme pour rétablir l'accès. Vos
                données sont conservées et seront de nouveau disponibles après réactivation.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold">Accès refusé</h1>
              <p className="text-sm text-muted-foreground">
                Votre compte n'est rattaché à aucun espace de travail, ou vous n'avez pas
                la permission d'accéder à cette zone. Contactez votre administrateur.
              </p>
            </>
          )}
          <form action={signOut}>
            <Button variant="outline" type="submit">Se déconnecter</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
