"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { signIn, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

function SubmitButton({ hydrated }: { hydrated: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={!hydrated || pending}>
      {pending && <Loader2 className="animate-spin" />}
      Se connecter
    </Button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [hydrated, setHydrated] = useState(false);
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {});

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (state.redirectTo) {
      const target = params.get("redirect") || state.redirectTo;
      router.replace(target);
    }
  }, [state.redirectTo, params, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="vous@agence.ma" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
          {state.error}
        </p>
      )}
      <SubmitButton hydrated={hydrated} />
    </form>
  );
}
