import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables, Enums } from "@/lib/database.types";

export type AgencyListRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  city: string | null;
  status: Enums<"agency_status">;
  created_at: string;
  ownerName: string | null;
  ownerEmail: string | null;
  planName: string | null;
  subscriptionStatus: Enums<"subscription_status"> | null;
  endsAt: string | null;
  memberCount: number;
};

/** List every agency with owner, plan and member count (super-admin view). */
export async function listAgencies(): Promise<AgencyListRow[]> {
  const supabase = await createClient();

  const { data: agencies, error } = await supabase
    .from("agencies")
    .select("id, name, slug, logo_url, city, status, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!agencies || agencies.length === 0) return [];

  const ids = agencies.map((a) => a.id);

  // Owners (role AGENCY_OWNER) with their profiles.
  const { data: owners } = await supabase
    .from("agency_members")
    .select("agency_id, profiles!inner(full_name, email), roles!inner(key)")
    .in("agency_id", ids)
    .eq("roles.key", "AGENCY_OWNER");

  // Active/most-recent subscription per agency with plan name.
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("agency_id, status, ends_at, created_at, plans!inner(name)")
    .in("agency_id", ids)
    .order("created_at", { ascending: false });

  // Member counts.
  const { data: members } = await supabase
    .from("agency_members")
    .select("agency_id")
    .in("agency_id", ids);

  const ownerByAgency = new Map<string, { name: string | null; email: string | null }>();
  for (const o of owners ?? []) {
    const p = o.profiles as unknown as { full_name: string | null; email: string | null };
    ownerByAgency.set(o.agency_id, { name: p.full_name, email: p.email });
  }

  const subByAgency = new Map<string, { planName: string | null; status: Enums<"subscription_status">; endsAt: string | null }>();
  for (const s of subs ?? []) {
    if (subByAgency.has(s.agency_id)) continue; // first = most recent
    const plan = s.plans as unknown as { name: string };
    subByAgency.set(s.agency_id, { planName: plan?.name ?? null, status: s.status, endsAt: s.ends_at });
  }

  const countByAgency = new Map<string, number>();
  for (const m of members ?? []) {
    countByAgency.set(m.agency_id, (countByAgency.get(m.agency_id) ?? 0) + 1);
  }

  return agencies.map((a) => {
    const owner = ownerByAgency.get(a.id);
    const sub = subByAgency.get(a.id);
    return {
      ...a,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      planName: sub?.planName ?? null,
      subscriptionStatus: sub?.status ?? null,
      endsAt: sub?.endsAt ?? null,
      memberCount: countByAgency.get(a.id) ?? 0,
    };
  });
}

export type AgencyDetail = {
  agency: Tables<"agencies">;
  settings: Tables<"agency_settings"> | null;
  owner: { id: string; name: string | null; email: string | null; phone: string | null } | null;
  members: Array<{
    id: string;
    name: string | null;
    email: string | null;
    roleName: string;
    status: Enums<"member_status">;
  }>;
  subscription: (Tables<"subscriptions"> & { planName: string | null }) | null;
};

/** Full detail for one agency. Returns null if not found. */
export async function getAgencyDetail(id: string): Promise<AgencyDetail | null> {
  const supabase = await createClient();

  const { data: agency } = await supabase.from("agencies").select("*").eq("id", id).maybeSingle();
  if (!agency) return null;

  const [{ data: settings }, { data: members }, { data: sub }] = await Promise.all([
    supabase.from("agency_settings").select("*").eq("agency_id", id).maybeSingle(),
    supabase
      .from("agency_members")
      .select("id, status, profiles!inner(id, full_name, email, phone), roles!inner(key, name)")
      .eq("agency_id", id),
    supabase
      .from("subscriptions")
      .select("*, plans!inner(name)")
      .eq("agency_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const mappedMembers = (members ?? []).map((m) => {
    const p = m.profiles as unknown as {
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
    };
    const r = m.roles as unknown as { key: string; name: string };
    return {
      id: p.id,
      name: p.full_name,
      email: p.email,
      phone: p.phone,
      roleName: r.name,
      roleKey: r.key,
      status: m.status,
    };
  });

  const owner = mappedMembers.find((m) => m.roleKey === "AGENCY_OWNER") ?? null;

  return {
    agency,
    settings: settings ?? null,
    owner: owner ? { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone } : null,
    members: mappedMembers.map(({ id, name, email, roleName, status }) => ({
      id,
      name,
      email,
      roleName,
      status,
    })),
    subscription: sub
      ? { ...(sub as Tables<"subscriptions">), planName: (sub.plans as unknown as { name: string })?.name ?? null }
      : null,
  };
}
