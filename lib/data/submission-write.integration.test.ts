/**
 * Regression test for replaceResearchRelations (lib/data/submission-write.server.ts).
 *
 * Bug: saving an edit with a keyword that already exists in `keywords` failed
 * (the old code used upsert ... onConflict "keyword", which needs an UPDATE
 * policy that `keywords` deliberately does not have) AND the old keyword links
 * had already been deleted by then, so the work lost its keywords.
 *
 * Connects to the real LOCAL Supabase (RLS is the point of the test — mocks
 * would prove nothing). Skipped when .env.local / local Supabase is missing.
 * Creates and removes only its own fixtures (slug prefix, test users, authors,
 * keywords); never touches production.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { replaceResearchRelations } from "@/lib/data/submission-write.server";
import type { Database } from "@/lib/supabase/database.types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Safety gate — runs at import time, before any client is created or any
// network call is made. This file creates and deletes auth users, so it must
// never run against anything but the local Supabase.
if (SUPABASE_URL) {
  let hostname = "";
  try {
    hostname = new URL(SUPABASE_URL).hostname;
  } catch {
    // unparsable -> refused below
  }
  const isLocal = ["127.0.0.1", "localhost", "[::1]"].includes(hostname);
  if (!isLocal || hostname.endsWith("supabase.co")) {
    throw new Error(
      "REFUSED: NEXT_PUBLIC_SUPABASE_URL is not a local Supabase URL. This integration test only runs against local."
    );
  }
}

const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAN_RUN = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_Ebooks";

function psql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"],
    { input: sql, stdio: ["pipe", "pipe", "pipe"] }
  )
    .toString()
    .trim();
}

const q = (value: string) => `'${value.replace(/'/g, "''")}'`;

const PREFIX = "qa-relations-test";
const USER_DOMAIN = "qa-relations-test.invalid";
const KW = "qa-rel-"; // every keyword created by this file starts with this
const AUTHOR_NAME = "QA Relations Tester";
const PASSWORD = "Test-Password-1234!";
const ITEM_OWNED_BY_STAFF = "00000000-0000-0000-0000-00000000ee01";
const ITEM_OWNED_BY_OTHER = "00000000-0000-0000-0000-00000000ee02";

type Role = "librarian" | "staff" | "member";
const sessions = new Map<Role, { userId: string; client: SupabaseClient<Database> }>();

function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function linkedKeywords(itemId: string): string[] {
  const out = psql(
    `select k.keyword from research_keywords rk join keywords k on k.id = rk.keyword_id
     where rk.research_id = ${q(itemId)} order by k.keyword;`
  );
  return out ? out.split("\n") : [];
}

function counts(itemId: string) {
  return psql(
    `select (select count(*) from research_authors where research_id = ${q(itemId)}) || '|' ||
            (select count(*) from research_categories where research_id = ${q(itemId)});`
  );
}

function baseData(keywords: string[], categoryId = "science") {
  return {
    researchers: [{ name: AUTHOR_NAME, organization: "QA" }],
    categoryId,
    keywords,
  };
}

function cleanup() {
  psql(`
    delete from public.research_items where slug like '${PREFIX}%';
    delete from public.authors where name = ${q(AUTHOR_NAME)};
    delete from public.keywords where keyword like '${KW}%';
  `);
}

async function removeTestUsers(service: SupabaseClient<Database>) {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) {
    if (u.email?.endsWith(`@${USER_DOMAIN}`)) await service.auth.admin.deleteUser(u.id);
  }
}

beforeAll(async () => {
  if (!CAN_RUN) {
    console.warn("[submission-write.integration.test] skipped — local Supabase env not configured");
    return;
  }
  const service = createServiceRoleClient();
  cleanup();
  await removeTestUsers(service);

  const roleRows: Role[] = ["librarian", "staff", "member"];
  for (const role of roleRows) {
    const email = `${role}@${USER_DOMAIN}`;
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`create ${email}: ${error?.message}`);
    // handle_new_user() gave 'member'; keep exactly one role (service_role cannot INSERT user_roles)
    psql(`
      delete from public.user_roles where user_id = ${q(data.user.id)};
      insert into public.user_roles (user_id, role_id)
      select ${q(data.user.id)}, id from public.roles where name = ${q(role)};
    `);
    const client = anonClient();
    const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`sign in ${email}: ${signInError.message}`);
    sessions.set(role, { userId: data.user.id, client });
  }

  const staffId = sessions.get("staff")!.userId;
  const librarianId = sessions.get("librarian")!.userId;
  psql(`
    insert into public.research_items (id, slug, title_th, abstract, year, access_level, status, submitted_by)
    values
      (${q(ITEM_OWNED_BY_STAFF)}, '${PREFIX}-staff-owned', 'ทดสอบความสัมพันธ์ A', 'abstract for relations test', 2560, 'metadata_only', 'draft', ${q(staffId)}),
      (${q(ITEM_OWNED_BY_OTHER)}, '${PREFIX}-other-owned', 'ทดสอบความสัมพันธ์ B', 'abstract for relations test', 2560, 'metadata_only', 'draft', ${q(librarianId)});
  `);
}, 60000);

afterAll(async () => {
  if (!CAN_RUN) return;
  cleanup();
  await removeTestUsers(createServiceRoleClient());
}, 60000);

describe.runIf(CAN_RUN)("replaceResearchRelations — keywords", () => {
  it("first save with brand-new keywords links them all (insert path)", async () => {
    const { client } = sessions.get("librarian")!;
    await replaceResearchRelations(client, ITEM_OWNED_BY_STAFF, baseData([`${KW}alpha`, `${KW}beta`]));
    expect(linkedKeywords(ITEM_OWNED_BY_STAFF)).toEqual([`${KW}alpha`, `${KW}beta`]);
  });

  it("re-saving with keywords that ALREADY exist succeeds and keeps every link (was: error + keywords lost)", async () => {
    const { client } = sessions.get("librarian")!;
    await expect(
      replaceResearchRelations(client, ITEM_OWNED_BY_STAFF, baseData([`${KW}alpha`, `${KW}beta`]))
    ).resolves.toBeUndefined();
    expect(linkedKeywords(ITEM_OWNED_BY_STAFF)).toEqual([`${KW}alpha`, `${KW}beta`]);
  });

  it("mixed new + already-existing keywords all end up linked, replacing the previous set", async () => {
    const { client } = sessions.get("librarian")!;
    await replaceResearchRelations(client, ITEM_OWNED_BY_STAFF, baseData([`${KW}beta`, `${KW}gamma`]));
    expect(linkedKeywords(ITEM_OWNED_BY_STAFF)).toEqual([`${KW}beta`, `${KW}gamma`]);
  });

  it("duplicates inside the submitted list neither error nor create duplicate rows", async () => {
    const { client } = sessions.get("librarian")!;
    await replaceResearchRelations(client, ITEM_OWNED_BY_STAFF, baseData([`${KW}dup`, `${KW}dup`, `${KW}dup`]));
    expect(linkedKeywords(ITEM_OWNED_BY_STAFF)).toEqual([`${KW}dup`]);
    expect(psql(`select count(*) from keywords where keyword = '${KW}dup';`)).toBe("1");
  });

  it("keywords with commas, parentheses and quotes round-trip (same rules as before: exact match)", async () => {
    const { client } = sessions.get("librarian")!;
    const odd = [`${KW}a,b`, `${KW}(x)`, `${KW}say "hi"`, `${KW}it's`];
    await replaceResearchRelations(client, ITEM_OWNED_BY_STAFF, baseData(odd));
    await replaceResearchRelations(client, ITEM_OWNED_BY_STAFF, baseData(odd));
    expect(linkedKeywords(ITEM_OWNED_BY_STAFF).sort()).toEqual([...odd].sort());
  });

  it("an empty keyword list clears the links without error", async () => {
    const { client } = sessions.get("librarian")!;
    await replaceResearchRelations(client, ITEM_OWNED_BY_STAFF, baseData([`${KW}alpha`]));
    await expect(replaceResearchRelations(client, ITEM_OWNED_BY_STAFF, baseData([]))).resolves.toBeUndefined();
    expect(linkedKeywords(ITEM_OWNED_BY_STAFF)).toEqual([]);
  });

  it("CREATE path: a brand-new work whose keywords already exist in the system links them (same function as edit)", async () => {
    const { client } = sessions.get("librarian")!;
    // make sure the keywords exist from a different work first
    await replaceResearchRelations(client, ITEM_OWNED_BY_STAFF, baseData([`${KW}shared1`, `${KW}shared2`]));
    // second work has never had any relations (what a first save of a new upload looks like)
    await expect(
      replaceResearchRelations(client, ITEM_OWNED_BY_OTHER, baseData([`${KW}shared1`, `${KW}shared2`, `${KW}fresh`]))
    ).resolves.toBeUndefined();
    expect(linkedKeywords(ITEM_OWNED_BY_OTHER)).toEqual([`${KW}fresh`, `${KW}shared1`, `${KW}shared2`]);
    // the work that already used them is unaffected
    expect(linkedKeywords(ITEM_OWNED_BY_STAFF)).toEqual([`${KW}shared1`, `${KW}shared2`]);
    // leave ITEM_OWNED_BY_OTHER empty for the permission tests below
    await replaceResearchRelations(client, ITEM_OWNED_BY_OTHER, baseData([]));
  });

  it("the owner (staff, rank 20) can re-save their own submission with existing keywords", async () => {
    const { client } = sessions.get("staff")!;
    await replaceResearchRelations(client, ITEM_OWNED_BY_STAFF, baseData([`${KW}alpha`, `${KW}beta`]));
    await replaceResearchRelations(client, ITEM_OWNED_BY_STAFF, baseData([`${KW}alpha`, `${KW}beta`]));
    expect(linkedKeywords(ITEM_OWNED_BY_STAFF)).toEqual([`${KW}alpha`, `${KW}beta`]);
  });
});

describe.runIf(CAN_RUN)("replaceResearchRelations — failure safety", () => {
  it("a failure part-way (unknown category) leaves the existing keywords/authors/category untouched (was: all wiped)", async () => {
    const { client } = sessions.get("librarian")!;
    await replaceResearchRelations(client, ITEM_OWNED_BY_STAFF, baseData([`${KW}keep1`, `${KW}keep2`]));
    const before = counts(ITEM_OWNED_BY_STAFF);

    await expect(
      replaceResearchRelations(client, ITEM_OWNED_BY_STAFF, baseData([`${KW}new`], "no-such-category"))
    ).rejects.toThrow();

    expect(linkedKeywords(ITEM_OWNED_BY_STAFF)).toEqual([`${KW}keep1`, `${KW}keep2`]);
    expect(counts(ITEM_OWNED_BY_STAFF)).toBe(before);
  });
});

describe.runIf(CAN_RUN)("replaceResearchRelations — permissions are unchanged", () => {
  it("a member (rank 10) is rejected and the item's existing links are left alone", async () => {
    const librarian = sessions.get("librarian")!.client;
    await replaceResearchRelations(librarian, ITEM_OWNED_BY_OTHER, baseData([`${KW}owned`]));
    const before = counts(ITEM_OWNED_BY_OTHER);

    const member = sessions.get("member")!.client;
    await expect(
      replaceResearchRelations(member, ITEM_OWNED_BY_OTHER, baseData([`${KW}hijack`]))
    ).rejects.toThrow();

    expect(linkedKeywords(ITEM_OWNED_BY_OTHER)).toEqual([`${KW}owned`]);
    expect(counts(ITEM_OWNED_BY_OTHER)).toBe(before);
    expect(psql(`select count(*) from keywords where keyword = '${KW}hijack';`)).toBe("0");
  });

  it("staff cannot rewrite relations of an item they do not own", async () => {
    const staff = sessions.get("staff")!.client;
    await expect(
      replaceResearchRelations(staff, ITEM_OWNED_BY_OTHER, baseData([`${KW}owned`, `${KW}staff-hijack`]))
    ).rejects.toThrow();
    expect(linkedKeywords(ITEM_OWNED_BY_OTHER)).toEqual([`${KW}owned`]);
  });
});
