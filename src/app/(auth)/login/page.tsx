import { Suspense } from "react";
import { Car } from "lucide-react";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Connexion — FleetHub" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Car className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">FleetHub</h1>
          <p className="text-sm text-muted-foreground">Plateforme de gestion de location de voitures</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Bienvenue</CardTitle>
            <CardDescription>Connectez-vous à votre compte pour continuer.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          L'accès est fourni par votre administrateur. Les agences ne peuvent pas s'inscrire seules.
        </p>
      </div>
    </div>
  );
}
