import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Tables, Enums } from "@/lib/database.types";

export type RoleKey =
  | "AGENCY_OWNER"
  | "MANAGER"
  | "AGENT"
  | "ACCOUNTANT"
  | "DRIVER"
  | "CLIENT";

export type Membership = {
  agencyId: string;
  agencyName: string;
  agencyStatus: Enums<"agency_status">;
  roleKey: RoleKey;
  roleName: string;
  permissions: string[];
};

export type SessionContext = {
  user: User;
  profile: Tables<"profiles">;
  isSuperAdmin: boolean;
  membership: Membership | null;
};

/**
 * Resolve the full auth context for the current request.
 * Cached per-request so multiple guards don't re-query.
 * Returns null when there is no authenticated user.
 */
export const getSessionContext = cache(
  async (): Promise<SessionContext | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) return null;

    let membership: Membership | null = null;

    if (!profile.is_super_admin) {
      const { data: member } = await supabase
        .from("agency_members")
        .select(
          "agency_id, role_id, status, agencies!inner(name, status), roles!inner(key, name)",
        )
        .eq("profile_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (member) {
        // Permissions for this role.
        const { data: perms } = await supabase
          .from("role_permissions")
          .select("permissions!inner(key)")
          .eq("role_id", member.role_id);

        // Supabase types the embedded relation loosely; narrow at the boundary.
        const agency = member.agencies as unknown as {
          name: string;
          status: Enums<"agency_status">;
        };
        const role = member.roles as unknown as { key: RoleKey; name: string };

        membership = {
          agencyId: member.agency_id,
          agencyName: agency.name,
          agencyStatus: agency.status,
          roleKey: role.key,
          roleName: role.name,
          permissions: (perms ?? []).map(
            (p) => (p.permissions as unknown as { key: string }).key,
          ),
        };
      }
    }

    return {
      user,
      profile,
      isSuperAdmin: profile.is_super_admin,
      membership,
    };
  },
);

/** The landing route for a given context, used after login. */
export function homeRouteFor(ctx: SessionContext): string {
  if (ctx.isSuperAdmin) return "/super-admin";
  if (!ctx.membership) return "/no-access";
  switch (ctx.membership.roleKey) {
    case "DRIVER":
      return "/driver";
    case "CLIENT":
      return "/client";
    default:
      return "/agency";
  }
}

/** Require an authenticated user; redirect to /login otherwise. */
export async function requireUser(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Require platform super-admin. */
export async function requireSuperAdmin(): Promise<SessionContext> {
  const ctx = await requireUser();
  if (!ctx.isSuperAdmin) redirect("/no-access");
  return ctx;
}

/** Require an active agency membership in one of the given roles (default: any staff role). */
export async function requireAgency(
  roles?: RoleKey[],
): Promise<SessionContext & { membership: Membership }> {
  const ctx = await requireUser();
  if (ctx.isSuperAdmin) redirect("/super-admin");
  if (!ctx.membership) redirect("/no-access");
  if (roles && !roles.includes(ctx.membership.roleKey)) redirect("/no-access");
  return ctx as SessionContext & { membership: Membership };
}

/** True if the current membership holds a permission (super-admin holds all). */
export function can(ctx: SessionContext, permission: string): boolean {
  if (ctx.isSuperAdmin) return true;
  return ctx.membership?.permissions.includes(permission) ?? false;
}
