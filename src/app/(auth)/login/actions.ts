"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext, homeRouteFor } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email("Saisissez une adresse email valide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

export type LoginState = { error?: string; redirectTo?: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "Email ou mot de passe incorrect." };
  }

  const ctx = await getSessionContext();
  if (!ctx) return { error: "Impossible de charger votre compte. Contactez l'administrateur." };

  return { redirectTo: homeRouteFor(ctx) };
}
