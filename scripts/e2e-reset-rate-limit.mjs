#!/usr/bin/env node
/**
 * Deletes the login rate-limit rows (rate_key like 'login:%') from the LOCAL
 * Supabase database so the e2e suite can be re-run within the 15-minute window
 * (login/actions.ts allows 10 attempts / 15 min / IP and counts every attempt).
 *
 * Local only: refuses any NEXT_PUBLIC_SUPABASE_URL that is not 127.0.0.1 /
 * localhost / [::1] (or that ends in supabase.co) BEFORE touching docker.
 * Only the login rows are deleted — no TRUNCATE, no other table.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// .env.local loader (no dotenv dependency); never overrides an existing env var,
// so an inline NEXT_PUBLIC_SUPABASE_URL=... on the command line always wins.
try {
  for (const rawLine of readFileSync(path.join(projectRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
} catch {
  // no .env.local -> the URL check below refuses
}

// Safety gate — before any docker call.
let hostname = "";
try {
  hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
} catch {
  // unparsable -> refused below
}
const isLocal = ["127.0.0.1", "localhost", "[::1]"].includes(hostname);
if (!isLocal || hostname.endsWith("supabase.co")) {
  console.error("REFUSED: NEXT_PUBLIC_SUPABASE_URL is not a local Supabase URL. This script only runs against local.");
  process.exit(1);
}

function docker(args, input) {
  return execFileSync("docker", args, { input, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
}

try {
  const names = docker(["ps", "--filter", "name=^supabase_db_", "--format", "{{.Names}}"])
    .split(/\r?\n/)
    .filter(Boolean);
  if (names.length !== 1) {
    console.error(
      names.length === 0
        ? "STOPPED: no running container named supabase_db_* (is local Supabase running? `npx supabase start`)."
        : `STOPPED: expected exactly one supabase_db_* container, found ${names.length}: ${names.join(", ")}. Not guessing.`
    );
    process.exit(1);
  }

  const deleted = docker(
    ["exec", "-i", names[0], "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"],
    "with d as (delete from public.rate_limit_events where rate_key like 'login:%' returning 1) select count(*) from d;"
  );
  console.log(`Deleted ${deleted} login rate-limit row(s) from local (${names[0]}).`);
} catch (err) {
  console.error(`FAILED: ${err.message.split("\n")[0]}`);
  process.exit(1);
}
