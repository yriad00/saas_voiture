/**
 * Bootstrap the FIRST platform super-admin.
 *
 * Run once, after SUPABASE_SERVICE_ROLE_KEY is set in .env.local:
 *
 *   node --env-file=.env.local scripts/bootstrap-admin.mjs [email] [password] ["Full Name"]
 *
 * Defaults: email = walidtajani084@gmail.com, password = FleetHub!2026, name = "Platform Admin".
 * Safe to re-run: if the user exists it just (re)asserts the super-admin flag.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key || key === "PASTE_SERVICE_ROLE_KEY_HERE") {
  console.error("\n❌ Missing env. Set SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  console.error("   Supabase Dashboard → Settings → API → service_role (secret).\n");
  process.exit(1);
}

const email = process.argv[2] || "walidtajani084@gmail.com";
const password = process.argv[3] || "FleetHub!2026";
const fullName = process.argv[4] || "Platform Admin";

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function findUserByEmail(target) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  let userId;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    if (/already been registered|already exists/i.test(error.message)) {
      const existing = await findUserByEmail(email);
      if (!existing) throw new Error(`User ${email} reported as existing but not found.`);
      userId = existing.id;
      console.log(`ℹ️  User already exists (${email}); elevating to super-admin.`);
    } else {
      throw error;
    }
  } else {
    userId = created.user.id;
    console.log(`✅ Created auth user ${email}`);
  }

  const { error: upErr } = await admin
    .from("profiles")
    .update({ is_super_admin: true, full_name: fullName })
    .eq("id", userId);
  if (upErr) throw upErr;

  console.log("\n✅ Super-admin ready.");
  console.log("   Email:    " + email);
  console.log("   Password: " + password);
  console.log("\n   Sign in at http://localhost:3000/login and change the password.\n");
}

main().catch((e) => {
  console.error("\n❌ Bootstrap failed:", e.message, "\n");
  process.exit(1);
});
