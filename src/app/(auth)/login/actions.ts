"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSessionContextForUser, homeRouteFor } from "@/lib/auth/session";
import { consumeLoginRateLimit } from "@/lib/services/login-rate-limit";
import { measurePerf } from "@/lib/perf";

const schema = z.object({
  email: z.string().email("Saisissez une adresse email valide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

export type LoginState = { error?: string; redirectTo?: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  return measurePerf("login.total", async () => {
    const parsed = schema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Saisie invalide" };
    }

    const supabase = await measurePerf("login.createClient", () => createClient());
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ipAddress = forwardedFor || requestHeaders.get("x-real-ip") || "unknown";
    const allowed = await measurePerf("login.rateLimit", () =>
      consumeLoginRateLimit(supabase, parsed.data.email, ipAddress),
    );
    if (!allowed) {
      return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
    }

    // signInWithPassword both verifies credentials and writes the auth cookie
    // through the server Supabase client. Reuse its verified user below rather
    // than issuing a second auth.getUser in the same server action. Middleware
    // and the destination page still perform their normal independent checks.
    const { data: authData, error } = await measurePerf(
      "login.supabase.signInWithPassword+cookie",
      () => supabase.auth.signInWithPassword(parsed.data),
    );
    if (error || !authData.user) {
      return { error: "Email ou mot de passe incorrect." };
    }

    const ctx = await measurePerf("login.sessionContext", () =>
      getSessionContextForUser(supabase, authData.user),
    );
    if (!ctx) return { error: "Impossible de charger votre compte. Contactez l'administrateur." };

    return { redirectTo: homeRouteFor(ctx) };
  });
}
