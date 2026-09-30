#!/usr/bin/env node
/**
 * Creates/updates the Supabase Auth accounts used by e2e/*.spec.ts (the
 * E2E_*_EMAIL / E2E_*_PASSWORD pairs in .env.local) — LOCAL SUPABASE ONLY.
 *
 * Why raw SQL for user_roles instead of the Supabase JS client: service_role
 * has SELECT/UPDATE on public.user_roles but not INSERT (least-privilege —
 * see lib/data/research-search-rls.integration.test.ts's own comment on the
 * same restriction). That test works around it with a direct `docker exec`
 * into the local Postgres container as the `postgres` superuser; this script
 * uses the exact same mechanism, matching that established pattern.
 *
 * super_admin is intentionally skipped: /superadmin/* requires aal2 (MFA
 * step-up, see lib/supabase/middleware.ts), and a real TOTP factor can't be
 * enrolled headlessly through the Admin API.
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Load .env.local (no dotenv dependency in this project) — never overrides a
// value already present in process.env, so an inline env var on the command
// line (used by the REFUSED safety-gate test) always wins.
// ---------------------------------------------------------------------------
function loadEnvLocal() {
  const envPath = path.join(projectRoot, ".env.local");
  let content;
  try {
    content = readFileSync(envPath, "utf8");
  } catch {
    return;
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

// ---------------------------------------------------------------------------
// Safety gate — must run before any client is created or network call made.
// ---------------------------------------------------------------------------
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let parsedUrl;
try {
  parsedUrl = new URL(rawUrl);
} catch {
  console.error("REFUSED: NEXT_PUBLIC_SUPABASE_URL is missing or not a valid URL.");
  process.exit(1);
}
const isLocalHost = ["127.0.0.1", "localhost", "[::1]", "::1"].includes(parsedUrl.hostname);
if (!isLocalHost || parsedUrl.hostname.endsWith("supabase.co")) {
  console.error("REFUSED: not a local Supabase URL. This script only runs against local.");
  process.exit(1);
}

const SUPABASE_URL = rawUrl;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  console.error("REFUSED: SUPABASE_SERVICE_ROLE_KEY is not set.");
  process.exit(1);
}

const DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_Ebooks";

// ---------------------------------------------------------------------------
// Roles this script manages. super_admin is deliberately excluded — see
// module docstring.
// ---------------------------------------------------------------------------
const ROLE_ENV_PREFIXES = [
  { role: "member", prefix: "E2E_MEMBER" },
  { role: "staff", prefix: "E2E_STAFF" },
  { role: "librarian", prefix: "E2E_LIBRARIAN" },
  { role: "admin", prefix: "E2E_ADMIN" },
];
const SKIPPED_MFA_ROLES = [{ role: "super_admin", prefix: "E2E_SUPERADMIN" }];

function runSql(sql) {
  execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
    { input: sql, stdio: ["pipe", "pipe", "inherit"] }
  );
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function listAllUsers(supabase) {
  const byEmail = new Map();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
  return byEmail;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const { prefix } of SKIPPED_MFA_ROLES) {
    const email = process.env[`${prefix}_EMAIL`];
    if (email) {
      console.log(`${email} | super_admin | skipped (requires TOTP)`);
    } else {
      console.log(`(unset) | super_admin | skipped (requires TOTP)`);
    }
  }

  const existingByEmail = await listAllUsers(supabase);
  const assignments = []; // { email, role }

  for (const { role, prefix } of ROLE_ENV_PREFIXES) {
    const email = process.env[`${prefix}_EMAIL`];
    const password = process.env[`${prefix}_PASSWORD`];

    if (!email || !password) {
      console.log(`(unset) | ${role} | skipped (missing ${prefix}_EMAIL/_PASSWORD)`);
      continue;
    }

    const existingId = existingByEmail.get(email.toLowerCase());
    if (existingId) {
      const { error } = await supabase.auth.admin.updateUserById(existingId, {
        password,
        email_confirm: true,
      });
      if (error) throw new Error(`updateUserById failed for ${email}: ${error.message}`);
      console.log(`${email} | ${role} | updated`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(`createUser failed for ${email}: ${error?.message}`);
      }
      console.log(`${email} | ${role} | created`);
    }

    assignments.push({ email, role });
  }

  if (assignments.length === 0) {
    console.log("No accounts to assign roles for — nothing more to do.");
    return;
  }

  // Leave exactly one role per account: delete whatever handle_new_user() (or
  // a prior run of this script) assigned, then insert the intended role.
  const valuesClause = assignments
    .map((a) => `(${sqlQuote(a.email)}, ${sqlQuote(a.role)})`)
    .join(",\n      ");

  runSql(`
    with pairs(email, role_name) as (
      values
      ${valuesClause}
    ),
    target_users as (
      select u.id as user_id, r.id as role_id
      from pairs p
      join auth.users u on u.email = p.email
      join public.roles r on r.name = p.role_name
    )
    delete from public.user_roles ur
    using target_users tu
    where ur.user_id = tu.user_id;

    with pairs(email, role_name) as (
      values
      ${valuesClause}
    )
    insert into public.user_roles (user_id, role_id)
    select u.id, r.id
    from pairs p
    join auth.users u on u.email = p.email
    join public.roles r on r.name = p.role_name
    on conflict (user_id, role_id) do nothing;
  `);

  console.log(`Assigned roles for ${assignments.length} account(s).`);
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
