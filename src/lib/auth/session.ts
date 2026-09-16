import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Tables, Enums } from "@/lib/database.types";
import { measurePerf } from "@/lib/perf";

export type RoleKey =
  | "AGENCY_OWNER"
  | "MANAGER"
  | "AGENT"
  | "ACCOUNTANT"
  | "DRIVER"
  | "CLIENT";

export type Membership = {
  agencyId: string;
  branchId: string | null;
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

const STAFF_ROLES: RoleKey[] = ["AGENCY_OWNER", "MANAGER", "AGENT", "ACCOUNTANT"];

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolve profile, membership and permissions for an already authenticated
 * user. The caller must obtain the user from Supabase Auth; this helper does
 * not cache across requests or users.
 */
export async function getSessionContextForUser(
  supabase: SupabaseServerClient,
  user: User,
): Promise<SessionContext | null> {
  const { data: profile } = await measurePerf("login.profile", async () =>
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  );

  if (!profile) return null;

  let membership: Membership | null = null;

  if (!profile.is_super_admin) {
    const { data: member } = await measurePerf("login.membership", async () =>
      supabase
        .from("agency_members")
        .select("agency_id, branch_id, role_id, status")
        .eq("profile_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    );

    if (member) {
      // Keep these lookups explicit instead of relying on PostgREST embedded
      // relationships. Some existing databases have the logical
      // role_id/agency_id links without a reflected FK relation; authentication
      // must remain reliable in either schema shape.
      const [{ data: agency }, { data: role }, { data: rolePermissions }] = await measurePerf(
        "login.agencyRoleLookups",
        () =>
          Promise.all([
            supabase.from("agencies").select("name, status").eq("id", member.agency_id).maybeSingle(),
            supabase.from("roles").select("key, name").eq("id", member.role_id).maybeSingle(),
            supabase.from("role_permissions").select("permission_id").eq("role_id", member.role_id),
          ]),
      );
      if (!agency || !role) {
        return {
          user,
          profile,
          isSuperAdmin: profile.is_super_admin,
          membership: null,
        };
      }

      const permissionIds = (rolePermissions ?? []).map((p) => p.permission_id).filter(Boolean);
      const { data: permissionRows } = permissionIds.length > 0
        ? await measurePerf("login.permissions", async () =>
            supabase.from("permissions").select("key").in("id", permissionIds),
          )
        : { data: [] as Array<{ key: string }> };

      membership = {
        agencyId: member.agency_id,
        branchId: member.branch_id,
        agencyName: agency.name,
        agencyStatus: agency.status,
        roleKey: role.key as RoleKey,
        roleName: role.name,
        permissions: (permissionRows ?? []).map((p) => p.key),
      };
    }
  }

  return {
    user,
    profile,
    isSuperAdmin: profile.is_super_admin,
    membership,
  };
}

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
    } = await measurePerf("session.auth.getUser", () => supabase.auth.getUser());
    if (!user) return null;
    return getSessionContextForUser(supabase, user);
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
  if (!["ACTIVE", "TRIAL"].includes(ctx.membership.agencyStatus)) redirect("/no-access");
  if (!roles && !STAFF_ROLES.includes(ctx.membership.roleKey)) redirect("/no-access");
  if (roles && !roles.includes(ctx.membership.roleKey)) redirect("/no-access");
  return ctx as SessionContext & { membership: Membership };
}

/** True if the current membership holds a permission (super-admin holds all). */
export function can(ctx: SessionContext, permission: string): boolean {
  if (ctx.isSuperAdmin) return true;
  return ctx.membership?.permissions.includes(permission) ?? false;
}

/**
 * Server-side permission guard for mutations and sensitive reads.
 * Keeping this next to the session resolver prevents a UI-only permission check.
 */
export async function requireAgencyPermission(
  permission: string,
  roles?: RoleKey[],
): Promise<SessionContext & { membership: Membership }> {
  const ctx = await requireAgency(roles);
  if (!can(ctx, permission)) redirect("/no-access");
  return ctx;
}
