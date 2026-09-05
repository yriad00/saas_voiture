/**
 * Seed a demo agency + owner for testing the agency space.
 *   node --env-file=.env.local scripts/seed-test-agency.mjs
 * Safe to re-run: reuses the owner user if it already exists.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || key === "PASTE_SERVICE_ROLE_KEY_HERE") {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const EMAIL = process.argv[2] || "agence@demo.ma";
const PASSWORD = process.argv[3] || "Demo!2026";
const NAME = process.argv[4] || "Agence Demo Location";

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function findUser(target) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const f = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (f) return f;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  // 1. Owner auth user
  let ownerId;
  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Youssef Propriétaire" },
  });
  if (error) {
    if (/already/i.test(error.message)) {
      const existing = await findUser(EMAIL);
      ownerId = existing.id;
      await admin.auth.admin.updateUserById(ownerId, { password: PASSWORD });
      console.log(`ℹ️  Owner exists, password reset: ${EMAIL}`);
    } else throw error;
  } else {
    ownerId = created.user.id;
    console.log(`✅ Created owner ${EMAIL}`);
  }

  // 2. Already a member somewhere? then skip creating a new agency.
  const { data: existingMember } = await admin
    .from("agency_members")
    .select("agency_id")
    .eq("profile_id", ownerId)
    .maybeSingle();
  if (existingMember) {
    console.log(`ℹ️  Owner already attached to an agency (${existingMember.agency_id}). Skipping creation.`);
    printCreds();
    return;
  }

  // 3. Pick a plan and the owner role (service role bypasses RLS).
  const { data: plan } = await admin.from("plans").select("id").order("sort_order").limit(1).maybeSingle();
  if (!plan) throw new Error("No plan found. Seed plans first.");
  const { data: ownerRole } = await admin.from("roles").select("id").eq("key", "AGENCY_OWNER").single();

  // 4. Create the agency directly.
  const slug = "agence-demo-" + Math.random().toString(36).slice(2, 6);
  const { data: agency, error: aErr } = await admin
    .from("agencies")
    .insert({
      name: NAME,
      slug,
      status: "ACTIVE",
      city: "Casablanca",
      country: "Maroc",
      currency: "MAD",
      email: EMAIL,
      phone: "+212 5 22 00 00 00",
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (aErr) throw aErr;
  const agencyId = agency.id;

  await admin.from("agency_settings").insert({ agency_id: agencyId, tax_rate: 20, default_deposit: 3000, deposit_required: true });
  await admin.from("subscriptions").insert({ agency_id: agencyId, plan_id: plan.id, status: "ACTIVE", started_at: new Date().toISOString() });
  await admin.from("agency_members").insert({
    agency_id: agencyId,
    profile_id: ownerId,
    role_id: ownerRole.id,
    status: "active",
    joined_at: new Date().toISOString(),
  });

  console.log(`✅ Created agency "${NAME}" (${agencyId}) with slug ${slug}`);
  printCreds();
}

function printCreds() {
  console.log("\n──────────── IDENTIFIANTS AGENCE ────────────");
  console.log(`  Email    : ${EMAIL}`);
  console.log(`  Password : ${PASSWORD}`);
  console.log("  URL      : http://localhost:3000/login");
  console.log("─────────────────────────────────────────────\n");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
