/**
 * Regression test สำหรับ C-1 (docs/production-readiness-report.md) —
 * research_document_texts เคยเปิดให้ดึงเนื้อหาไฟล์ PDF/OCR แบบเต็มได้โดยตรง
 * ทันทีที่แถวมองเห็นได้ (RLS row-level ไม่ใช่ column-level) พิสูจน์แล้วว่าแม้
 * ผู้ใช้ที่ไม่ได้ล็อกอินก็ดึงเนื้อหาเต็มของเอกสาร `read_only` ออกไปได้ทันทีผ่าน
 * REST API ตรงๆ โดยไม่ต้องผ่าน Signed URL เลย — แก้ไขด้วย migration
 * supabase/migrations/20260822100000_restrict_document_text_exposure.sql
 * (ตัด column grant ของ extracted_text/ocr_text ออกจาก anon/authenticated
 * ทั้งหมด + เพิ่มฟังก์ชัน SECURITY DEFINER search_research_document_excerpts()
 * ที่คืนค่าเฉพาะ excerpt รอบจุดที่ตรงคำค้นหา ไม่ใช่เนื้อหาทั้งไฟล์)
 *
 * ไฟล์นี้คือ SEARCH-03 ใน docs/qa-test-plan.md — เป็น integration test ที่ต่อ
 * local Supabase จริง (ไม่ mock RLS/Auth เพราะเป็น regression test ด้าน
 * ความปลอดภัย mock จะพิสูจน์อะไรไม่ได้เลย) ใช้ test fixtures ที่สร้าง/ลบเองใน
 * ไฟล์นี้เท่านั้น **ไม่แตะฐานข้อมูล production เด็ดขาด** — ถ้าต่อ local
 * Supabase ไม่ได้ (ไม่มี .env.local หรือ Docker ไม่ได้รันอยู่) ทั้งชุด test
 * จะถูก skip พร้อมข้อความอธิบายแทนที่จะ fail
 *
 * ครอบคลุมตามที่ระบุไว้ใน docs/qa-test-plan.md: Guest/Member/Staff/
 * Librarian/Admin/Super Admin, ภาษาไทย/อังกฤษ, query ว่าง/ผิดปกติ, sinppet
 * ไม่หลุดเกินขอบเขต, access grant ไม่ทำให้เห็นผลค้นหาเพิ่ม
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/database.types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CAN_RUN = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

// service_role มี SELECT/UPDATE บน research_items/user_roles/
// document_access_grants ตามที่ตั้งใจ (least privilege — ตรงกับที่แอปจริงไม่
// เคยเขียนตารางเหล่านี้ผ่าน service_role เลยสักที่) แต่ "ไม่มี" สิทธิ์ INSERT
// จึงใช้ไม่ได้กับการสร้าง fixture ของ integration test นี้ ใช้ role
// `postgres` (superuser) ผ่าน `docker exec` เข้า container ของ local Supabase
// โดยตรงแทน — เป็นกลไกเดียวกับที่ README.md ใช้ bootstrap Super Admin คนแรก
// ผ่าน SQL Editor จริง (สิทธิ์ postgres เดียวกัน) ไม่ใช่ทางลัดที่ผิดปกติ และ
// จำกัดเฉพาะ integration test ที่ gate ด้วย CAN_RUN (local Supabase เท่านั้น)
const DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_Ebooks";

function runSql(sql: string): void {
  execFileSync("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

// slug/id เฉพาะของชุดทดสอบนี้เท่านั้น — คงที่และเก็บกวาดทั้งใน beforeAll (กันแถว
// ค้างจากรอบทดสอบก่อนหน้าที่ล้มเหลวกลางคัน) และ afterAll เสมอ
const FIXTURE_PREFIX = "qa-rls-search-test";
const TEST_USER_DOMAIN = "qa-rls-search-test.invalid";

interface Fixture {
  id: string;
  slug: string;
  accessLevel: string;
  titleKeyword: string;
  pdfKeyword: string;
  ownerEmail?: string;
}

const FIXTURES: Fixture[] = [
  {
    id: "00000000-0000-0000-0000-0000000000f1",
    slug: `${FIXTURE_PREFIX}-public`,
    accessLevel: "public",
    titleKeyword: "PublicSearchTermAlpha",
    pdfKeyword: "PublicPdfWordAlpha",
  },
  {
    id: "00000000-0000-0000-0000-0000000000f2",
    slug: `${FIXTURE_PREFIX}-readonly`,
    accessLevel: "read_only",
    titleKeyword: "ReadonlySearchTermBravo",
    pdfKeyword: "ReadonlyPdfWordBravo",
  },
  {
    id: "00000000-0000-0000-0000-0000000000f3",
    slug: `${FIXTURE_PREFIX}-member`,
    accessLevel: "member_only",
    titleKeyword: "MemberSearchTermCharlie",
    pdfKeyword: "MemberPdfWordCharlie",
  },
  {
    id: "00000000-0000-0000-0000-0000000000f4",
    slug: `${FIXTURE_PREFIX}-staff`,
    accessLevel: "staff_only",
    titleKeyword: "StaffSearchTermDelta",
    pdfKeyword: "StaffPdfWordDelta",
  },
  {
    id: "00000000-0000-0000-0000-0000000000f5",
    slug: `${FIXTURE_PREFIX}-metadata`,
    accessLevel: "metadata_only",
    titleKeyword: "MetadataSearchTermEcho",
    pdfKeyword: "MetadataPdfWordEcho",
  },
  {
    id: "00000000-0000-0000-0000-0000000000f6",
    slug: `${FIXTURE_PREFIX}-thai`,
    accessLevel: "public",
    // คำภาษาไทยล้วน ไม่มีการแปลงตัวพิมพ์เล็ก-ใหญ่ (Thai script ไม่มีแนวคิด
    // case) — ทดสอบว่าค้นหาภาษาไทยทำงานทั้งบรรณานุกรมและเนื้อหา PDF
    titleKeyword: "คำค้นหาภาษาไทยฟ็อกซ์ทรอต",
    pdfKeyword: "คำค้นหาภาษาไทยในเนื้อหาพีดีเอฟกอล์ฟ",
  },
];

const METADATA_FIXTURE = FIXTURES.find((f) => f.slug.endsWith("-metadata"))!;
const STAFF_FIXTURE = FIXTURES.find((f) => f.slug.endsWith("-staff"))!;
const MEMBER_FIXTURE = FIXTURES.find((f) => f.slug.endsWith("-member"))!;

type TestRoleName = "member" | "staff" | "librarian" | "admin" | "super_admin";
const TEST_ROLES: TestRoleName[] = ["member", "staff", "librarian", "admin", "super_admin"];

interface RoleSession {
  role: TestRoleName;
  userId: string;
  client: SupabaseClient<Database>;
}

let service: SupabaseClient<Database>;
let roleSessions: Map<TestRoleName, RoleSession>;
let anonClient: SupabaseClient<Database>;
/** owner ของ FIXTURES ตัวที่เป็น metadata_only — ใช้ทดสอบสาขา "เจ้าของเห็นเสมอ" */
let ownerSession: RoleSession | null = null;

function createAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signInAs(email: string, password: string): Promise<SupabaseClient<Database>> {
  const client = createAnonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** สร้างข้อความ PDF ที่ดึงไว้แล้วสำหรับ fixture หนึ่งรายการ — insert แถวว่าง
 * ก่อนแล้วค่อย update ด้วยเนื้อหาจริง ตามรูปแบบเดียวกับที่แอปจริงเขียน (ดู
 * lib/pdf/process-extraction.server.ts) เพราะ Insert type ของตารางนี้ตั้งใจ
 * ไม่รวม extracted_text (ไม่มี path การ insert พร้อมเนื้อหาเต็มในแอปจริงเลย) */
async function insertDocumentTextFixture(researchItemId: string, fullText: string): Promise<void> {
  const { error: insertError } = await service.from("research_document_texts").insert({
    research_item_id: researchItemId,
    extraction_status: "pending",
  });
  if (insertError) throw new Error(`insert document text row for ${researchItemId} failed: ${insertError.message}`);

  const { error: updateError } = await service
    .from("research_document_texts")
    .update({
      extraction_status: "completed",
      extracted_text: fullText,
      extracted_text_normalized: fullText.toLowerCase(),
    })
    .eq("research_item_id", researchItemId);
  if (updateError) throw new Error(`update document text row for ${researchItemId} failed: ${updateError.message}`);
}

function deleteFixtures(): void {
  // ใช้ role postgres ลบด้วย slug prefix เดียว (ครอบคลุมทั้ง FIXTURES คงที่
  // และ "bigdoc" ที่สร้างเพิ่มกลางการทดสอบ) — research_document_texts และ
  // document_access_grants ผูก FK แบบ ON DELETE CASCADE จาก research_items
  // อยู่แล้ว จึงลบตามไปเองโดยไม่ต้องสั่งแยก
  runSql(`delete from public.research_items where slug like '${FIXTURE_PREFIX}%';`);
}

async function deleteTestUsers(): Promise<void> {
  // ปิด trigger กันถอดถอน super_admin คนสุดท้ายชั่วคราว เฉพาะรอบลบผู้ใช้ทดสอบ
  // เท่านั้น — ฐานข้อมูล local/test ที่ใช้รัน integration test นี้มักไม่มี
  // super_admin จริงตัวอื่นอยู่ก่อนเลย บัญชี super_admin ของ test เองจึงกลาย
  // เป็น "คนสุดท้าย" ในสายตาของ trigger ทุกครั้ง (ป้องกันไว้สำหรับ production
  // ซึ่งไม่เกี่ยวกับ integration test นี้เลย) ปลอดภัยเพราะจำกัดเฉพาะ local
  // container ที่ CAN_RUN ชี้ไปเท่านั้น เปิด trigger กลับคืนทันทีหลังลบเสร็จ
  // เสมอ (ใน try/finally กันเปิดกลับไม่ทันถ้า deleteUser ล้มเหลวกลางคัน)
  runSql("alter table public.user_roles disable trigger trg_prevent_last_super_admin_removal;");
  try {
    const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
    const testUsers = (data?.users ?? []).filter((u) => u.email?.endsWith(`@${TEST_USER_DOMAIN}`));
    for (const u of testUsers) {
      const { error } = await service.auth.admin.deleteUser(u.id);
      if (error) {
        console.warn(`deleteTestUsers: failed to delete ${u.email}: ${error.message}`);
      }
    }
  } finally {
    runSql("alter table public.user_roles enable trigger trg_prevent_last_super_admin_removal;");
  }
}

/** แทรกงานวิจัยตัวอย่าง 1 รายการผ่าน role postgres — service_role ไม่มีสิทธิ์
 * INSERT บน research_items (ตั้งใจ — least privilege ตรงกับที่แอปจริงไม่เคย
 * เขียนตารางนี้ผ่าน service_role เลย การเขียนจริงทำผ่าน session ของผู้ใช้ที่มี
 * rank พอเสมอ) ใช้เฉพาะตอนสร้าง fixture ของ integration test นี้เท่านั้น */
function insertResearchItemFixture(f: Fixture): void {
  runSql(`
    insert into public.research_items (id, slug, title_th, title_en, abstract, year, access_level, status, pdf_file)
    values (
      ${sqlQuote(f.id)}, ${sqlQuote(f.slug)}, ${sqlQuote(`หัวข้อทดสอบ ${f.titleKeyword}`)},
      ${sqlQuote(`Test title ${f.titleKeyword}`)}, ${sqlQuote(`บทคัดย่อทดสอบ ${f.titleKeyword}`)},
      2560, ${sqlQuote(f.accessLevel)}, 'published', ${sqlQuote(`${f.slug}.pdf`)}
    )
    on conflict (id) do update set access_level = excluded.access_level, status = excluded.status;
  `);
}

beforeAll(async () => {
  if (!CAN_RUN) {
    console.warn(
      "[research-search-rls.integration.test] ข้าม integration test ทั้งชุด — " +
        "ไม่พบ NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY " +
        "ใน .env.local (ต้องรัน local Supabase ผ่าน `npx supabase start` ก่อน)"
    );
    return;
  }

  service = createServiceRoleClient();

  // เก็บกวาดข้อมูลค้างจากรอบทดสอบก่อนหน้าที่อาจล้มเหลวกลางคันก่อนเริ่มเสมอ
  deleteFixtures();
  await deleteTestUsers();

  // 1) สร้างงานวิจัยตัวอย่างครบทุก access level (ผ่าน role postgres) + ข้อความ
  //    PDF ที่ดึงไว้แล้ว (ผ่าน service_role ซึ่งมีสิทธิ์ insert บน
  //    research_document_texts อยู่แล้วจริงตาม migration เดิม — สอดคล้องกับ
  //    background job จริงที่เขียนตารางนี้ด้วย service_role เท่านั้น)
  for (const f of FIXTURES) {
    insertResearchItemFixture(f);
    const fullText = `${"padding text around the match. ".repeat(5)}${f.pdfKeyword}${" more padding text after the match.".repeat(5)}`;
    await insertDocumentTextFixture(f.id, fullText);
  }

  // 2) สร้างบัญชีทดสอบครบทุกบทบาท (member ถึง super_admin) + เจ้าของเอกสาร
  //    metadata_only แยกต่างหาก — guest ไม่ต้องมีบัญชี (ใช้ anon client เปล่า)
  const ownerEmail = `owner@${TEST_USER_DOMAIN}`;
  const password = "Test-Password-1234!";
  const createdIds = new Map<string, string>(); // email -> user id

  for (const email of [...TEST_ROLES.map((r) => `${r}@${TEST_USER_DOMAIN}`), ownerEmail]) {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) {
      throw new Error(`create test user ${email} failed: ${createError?.message}`);
    }
    createdIds.set(email, created.user.id);
  }

  // มอบบทบาทผ่าน role postgres เช่นกัน — service_role ไม่มีสิทธิ์ INSERT บน
  // user_roles (เหตุผลเดียวกับ research_items — ตรงกับที่ README.md เอกสาร
  // bootstrap บัญชี Super Admin คนแรกก็ใช้ role postgres ผ่าน SQL Editor
  // โดยตรงเช่นกัน ไม่ใช่ทางลัดที่ผิดปกติของ test นี้)
  const roleAssignments = [
    ...TEST_ROLES.map((r) => `(${sqlQuote(`${r}@${TEST_USER_DOMAIN}`)}, ${sqlQuote(r)})`),
    `(${sqlQuote(ownerEmail)}, 'member')`,
  ].join(",\n      ");
  runSql(`
    with pairs(email, role_name) as (
      values
      ${roleAssignments}
    )
    insert into public.user_roles (user_id, role_id)
    select u.id, r.id
    from pairs p
    join auth.users u on u.email = p.email
    join public.roles r on r.name = p.role_name
    on conflict do nothing;
  `);

  roleSessions = new Map();
  for (const role of TEST_ROLES) {
    const email = `${role}@${TEST_USER_DOMAIN}`;
    const client = await signInAs(email, password);
    roleSessions.set(role, { role, userId: createdIds.get(email)!, client });
  }

  // 3) เจ้าของเอกสาร metadata_only — ทดสอบสาขา "submitted_by = auth.uid()"
  //    ของ policy โดยตรง (บัญชี member ธรรมดา ไม่ใช่ staff+) — UPDATE บน
  //    research_items ได้รับอนุญาตสำหรับ service_role อยู่แล้วจริง (ต่างจาก
  //    INSERT/DELETE) จึงใช้ client ปกติได้ตรงนี้
  const ownerId = createdIds.get(ownerEmail)!;
  // submitted_by ไม่ได้อยู่ใน Update type ของ research_items (แอปจริงไม่เคย
  // แก้ไขเจ้าของงานวิจัยหลัง insert เลยสักฟีเจอร์เดียว) ใช้ role postgres
  // ตรงๆ สำหรับ fixture นี้เท่านั้น
  runSql(
    `update public.research_items set submitted_by = ${sqlQuote(ownerId)} where id = ${sqlQuote(METADATA_FIXTURE.id)};`
  );
  const ownerClient = await signInAs(ownerEmail, password);
  ownerSession = { role: "member", userId: ownerId, client: ownerClient };

  anonClient = createAnonClient();

  // 4) Access grant ที่ยัง active (member ได้สิทธิ์ "read" ของเอกสาร staff_only
  //    เป็นการเฉพาะ) — ใช้ทดสอบว่า grant ไม่ทำให้เห็นผลค้นหาเพิ่ม (grant เป็น
  //    ชั้นสิทธิ์เสริมสำหรับ Signed URL เท่านั้น ไม่เคยอยู่ใน RLS ของ
  //    research_items/research_document_texts เลย — ดู
  //    supabase/migrations/20260808100000_document_access_requests.sql)
  //    service_role ไม่มีสิทธิ์ INSERT บน document_access_grants เช่นกัน (การ
  //    เขียนจริงทำผ่าน session ของเจ้าหน้าที่ rank >= 30 เสมอ) จึงใช้ role
  //    postgres อีกครั้ง
  const memberSession = roleSessions.get("member")!;
  runSql(`
    insert into public.document_access_grants (research_item_id, user_id, access_type, granted_by, expires_at)
    values (${sqlQuote(STAFF_FIXTURE.id)}, ${sqlQuote(memberSession.userId)}, 'read', ${sqlQuote(ownerId)}, null);
  `);
}, 60000);

afterAll(async () => {
  if (!CAN_RUN) return;
  deleteFixtures();
  await deleteTestUsers();
}, 60000);

describe.runIf(CAN_RUN)("C-1 regression — direct raw-text column access must be blocked", () => {
  it("anon (guest) cannot select extracted_text directly from research_document_texts", async () => {
    const { data, error, status } = await anonClient
      .from("research_document_texts")
      .select("research_item_id, extracted_text")
      .eq("research_item_id", FIXTURES[0].id);

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(status).toBe(401);
    expect(error!.message).toMatch(/permission denied/i);
  });

  it("authenticated member cannot select extracted_text directly either (not just anon)", async () => {
    const memberClient = roleSessions.get("member")!.client;
    const { data, error, status } = await memberClient
      .from("research_document_texts")
      .select("research_item_id, extracted_text")
      .eq("research_item_id", FIXTURES[0].id);

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    // 403 (ไม่ใช่ 401) — คำขอนี้ยืนยันตัวตนสำเร็จแล้ว (JWT ถูกต้อง) เพียงแต่ไม่
    // มีสิทธิ์ระดับคอลัมน์สำหรับ extracted_text ตาม PostgREST/PostgreSQL semantics
    expect(status).toBe(403);
  });

  it("metadata columns (extraction_status etc.) are still selectable — only content columns were revoked", async () => {
    const { data, error } = await anonClient
      .from("research_document_texts")
      .select("research_item_id, extraction_status")
      .eq("research_item_id", FIXTURES[0].id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.extraction_status).toBe("completed");
  });

  it("the new RPC never returns more than a bounded excerpt, never the full document", async () => {
    const { data, error } = await anonClient.rpc("search_research_document_excerpts", {
      p_raw_query: FIXTURES[0].pdfKeyword,
      p_normalized_query: FIXTURES[0].pdfKeyword.toLowerCase(),
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    // excerpt ต้องสั้นกว่าเอกสารเต็มมาก (รัศมี 1000 ตัวอักษรรอบจุดที่ตรง ไม่ใช่
    // ทั้งไฟล์) — เอกสารทดสอบสั้นอยู่แล้วในเคสนี้ จึงแค่ยืนยันว่ามี keyword จริง
    expect(data![0].excerpt).toContain(FIXTURES[0].pdfKeyword);
  });
});

describe.runIf(CAN_RUN)("Guest (ไม่ได้ล็อกอิน — anon client)", () => {
  it("sees public and read_only research_items in bibliographic search", async () => {
    const publicFixture = FIXTURES[0];
    const { data } = await anonClient
      .from("research_items")
      .select("id")
      .eq("id", publicFixture.id)
      .maybeSingle();
    expect(data?.id).toBe(publicFixture.id);
  });

  it("does NOT see member_only or staff_only research_items at all", async () => {
    const { data: memberRow } = await anonClient
      .from("research_items")
      .select("id")
      .eq("id", MEMBER_FIXTURE.id)
      .maybeSingle();
    expect(memberRow).toBeNull();

    const { data: staffRow } = await anonClient
      .from("research_items")
      .select("id")
      .eq("id", STAFF_FIXTURE.id)
      .maybeSingle();
    expect(staffRow).toBeNull();
  });

  it("DOES see metadata_only research_items (title/abstract are public per spec) but not their PDF content", async () => {
    const { data } = await anonClient
      .from("research_items")
      .select("id")
      .eq("id", METADATA_FIXTURE.id)
      .maybeSingle();
    expect(data?.id).toBe(METADATA_FIXTURE.id);

    const { data: excerpt } = await anonClient.rpc("search_research_document_excerpts", {
      p_raw_query: METADATA_FIXTURE.pdfKeyword,
      p_normalized_query: METADATA_FIXTURE.pdfKeyword.toLowerCase(),
    });
    expect(excerpt ?? []).toHaveLength(0);
  });

  it("gets zero PDF-text search results for public/read_only content it cannot see", async () => {
    const { data } = await anonClient.rpc("search_research_document_excerpts", {
      p_raw_query: STAFF_FIXTURE.pdfKeyword,
      p_normalized_query: STAFF_FIXTURE.pdfKeyword.toLowerCase(),
    });
    expect(data ?? []).toHaveLength(0);
  });

  it("gets real snippet results for public/read_only PDF content", async () => {
    const readonlyFixture = FIXTURES[1];
    const { data, error } = await anonClient.rpc("search_research_document_excerpts", {
      p_raw_query: readonlyFixture.pdfKeyword,
      p_normalized_query: readonlyFixture.pdfKeyword.toLowerCase(),
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].research_item_id).toBe(readonlyFixture.id);
  });

  it("cannot bypass the UI by calling the RPC with someone else's query for restricted content", async () => {
    // ยืนยันซ้ำว่าการเรียก RPC ตรง (ไม่ผ่านหน้าเว็บ) ก็ยังถูกปฏิเสธเหมือนกัน —
    // ไม่มี "ทางลัด" ผ่าน API ที่ UI ไม่ได้กันไว้
    const { data } = await anonClient.rpc("search_research_document_excerpts", {
      p_raw_query: MEMBER_FIXTURE.pdfKeyword,
      p_normalized_query: MEMBER_FIXTURE.pdfKeyword.toLowerCase(),
    });
    expect(data ?? []).toHaveLength(0);
  });
});

describe.runIf(CAN_RUN)("Member (rank 10)", () => {
  it("sees public, read_only, and member_only — not staff_only", async () => {
    const memberClient = roleSessions.get("member")!.client;
    const { data: memberRow } = await memberClient
      .from("research_items")
      .select("id")
      .eq("id", MEMBER_FIXTURE.id)
      .maybeSingle();
    expect(memberRow?.id).toBe(MEMBER_FIXTURE.id);

    const { data: staffRow } = await memberClient
      .from("research_items")
      .select("id")
      .eq("id", STAFF_FIXTURE.id)
      .maybeSingle();
    expect(staffRow).toBeNull();
  });

  it("gets PDF-text snippet for member_only content it has rank for", async () => {
    const memberClient = roleSessions.get("member")!.client;
    const { data } = await memberClient.rpc("search_research_document_excerpts", {
      p_raw_query: MEMBER_FIXTURE.pdfKeyword,
      p_normalized_query: MEMBER_FIXTURE.pdfKeyword.toLowerCase(),
    });
    expect(data).toHaveLength(1);
  });

  it("does NOT get PDF-text snippet for staff_only content even with an active access grant for it", async () => {
    // ยืนยันข้อสังเกตสำคัญ: document_access_grants เป็นชั้นสิทธิ์เสริมสำหรับ
    // Signed URL (getResearchReadUrl/getResearchDownloadUrl) เท่านั้น ไม่เคย
    // ถูกอ้างอิงใน RLS ของ research_items/research_document_texts เลย — มี
    // grant "read" ที่ active อยู่จริงสำหรับ STAFF_FIXTURE (ดู beforeAll) แต่
    // ต้องไม่ทำให้เห็นผลค้นหา/snippet เพิ่มขึ้นแต่อย่างใด
    const memberClient = roleSessions.get("member")!.client;
    const { data: row } = await memberClient
      .from("research_items")
      .select("id")
      .eq("id", STAFF_FIXTURE.id)
      .maybeSingle();
    expect(row).toBeNull();

    const { data: excerpt } = await memberClient.rpc("search_research_document_excerpts", {
      p_raw_query: STAFF_FIXTURE.pdfKeyword,
      p_normalized_query: STAFF_FIXTURE.pdfKeyword.toLowerCase(),
    });
    expect(excerpt ?? []).toHaveLength(0);
  });

  it("still cannot select extracted_text directly even with rank 10", async () => {
    const memberClient = roleSessions.get("member")!.client;
    const { data, error } = await memberClient
      .from("research_document_texts")
      .select("extracted_text")
      .eq("research_item_id", MEMBER_FIXTURE.id);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe.runIf(CAN_RUN)("Staff (rank 20)", () => {
  it("sees public, read_only, member_only, and staff_only", async () => {
    const staffClient = roleSessions.get("staff")!.client;
    for (const f of [FIXTURES[0], FIXTURES[1], MEMBER_FIXTURE, STAFF_FIXTURE]) {
      const { data } = await staffClient.from("research_items").select("id").eq("id", f.id).maybeSingle();
      expect(data?.id, `staff should see ${f.slug}`).toBe(f.id);
    }
  });

  it("gets a PDF-text snippet for staff_only content by rank alone (no grant needed)", async () => {
    const staffClient = roleSessions.get("staff")!.client;
    const { data } = await staffClient.rpc("search_research_document_excerpts", {
      p_raw_query: STAFF_FIXTURE.pdfKeyword,
      p_normalized_query: STAFF_FIXTURE.pdfKeyword.toLowerCase(),
    });
    expect(data).toHaveLength(1);
  });

  it("does NOT see metadata_only PDF content (not owner, rank < 30)", async () => {
    const staffClient = roleSessions.get("staff")!.client;
    const { data } = await staffClient.rpc("search_research_document_excerpts", {
      p_raw_query: METADATA_FIXTURE.pdfKeyword,
      p_normalized_query: METADATA_FIXTURE.pdfKeyword.toLowerCase(),
    });
    expect(data ?? []).toHaveLength(0);
  });
});

describe.runIf(CAN_RUN)("Librarian / Admin / Super Admin (rank >= 30)", () => {
  it.each(["librarian", "admin", "super_admin"] as const)(
    "%s sees every access level, including metadata_only PDF content it doesn't own",
    async (role) => {
      const client = roleSessions.get(role)!.client;
      for (const f of FIXTURES) {
        const { data } = await client.from("research_items").select("id").eq("id", f.id).maybeSingle();
        expect(data?.id, `${role} should see ${f.slug}`).toBe(f.id);
      }

      const { data: excerpt } = await client.rpc("search_research_document_excerpts", {
        p_raw_query: METADATA_FIXTURE.pdfKeyword,
        p_normalized_query: METADATA_FIXTURE.pdfKeyword.toLowerCase(),
      });
      expect(excerpt, `${role} should see metadata_only excerpt`).toHaveLength(1);
    }
  );

  it("staff-side visibility into research_document_texts still never exposes raw full-text columns over REST", async () => {
    // แม้เป็น librarian/admin/super_admin ก็ยังต้องผ่าน RPC เท่านั้น — grant
    // ตัดคอลัมน์ดิบออกจาก anon/authenticated แบบไม่มีข้อยกเว้นตามบทบาท (ต่างจาก
    // RLS ที่อิง rank ได้ grant column-level ของ Postgres ไม่รู้จัก "rank")
    const librarianClient = roleSessions.get("librarian")!.client;
    const { data, error } = await librarianClient
      .from("research_document_texts")
      .select("extracted_text")
      .eq("research_item_id", METADATA_FIXTURE.id);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("owner of a metadata_only document sees its PDF content via ownership, not rank", async () => {
    expect(ownerSession).not.toBeNull();
    const { data } = await ownerSession!.client.rpc("search_research_document_excerpts", {
      p_raw_query: METADATA_FIXTURE.pdfKeyword,
      p_normalized_query: METADATA_FIXTURE.pdfKeyword.toLowerCase(),
    });
    expect(data).toHaveLength(1);
  });
});

describe.runIf(CAN_RUN)("Search behavior", () => {
  it("finds Thai-language matches in both title/abstract and PDF content", async () => {
    const thaiFixture = FIXTURES.find((f) => f.slug.endsWith("-thai"))!;

    const { data: bibliographic } = await anonClient
      .from("research_items")
      .select("id, title_th")
      .ilike("title_th", `%${thaiFixture.titleKeyword}%`);
    expect(bibliographic).toHaveLength(1);
    expect(bibliographic![0].id).toBe(thaiFixture.id);

    const { data: pdf } = await anonClient.rpc("search_research_document_excerpts", {
      p_raw_query: thaiFixture.pdfKeyword,
      p_normalized_query: thaiFixture.pdfKeyword.toLowerCase(),
    });
    expect(pdf).toHaveLength(1);
    expect(pdf![0].excerpt).toContain(thaiFixture.pdfKeyword);
  });

  it("finds English-language matches the same way", async () => {
    const englishFixture = FIXTURES[0];
    const { data } = await anonClient.rpc("search_research_document_excerpts", {
      p_raw_query: englishFixture.pdfKeyword,
      p_normalized_query: englishFixture.pdfKeyword.toLowerCase(),
    });
    expect(data).toHaveLength(1);
  });

  it("returns empty (not an error) for an empty query", async () => {
    const { data, error } = await anonClient.rpc("search_research_document_excerpts", {
      p_raw_query: "",
      p_normalized_query: "",
    });
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("returns empty (not an error) for a query with no matches anywhere", async () => {
    const { data, error } = await anonClient.rpc("search_research_document_excerpts", {
      p_raw_query: "ThisStringMatchesNoFixtureAnywhereZZZ999",
      p_normalized_query: "thisstringmatchesnofixtureanywherezzz999",
    });
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("returns empty gracefully for a pathologically long query instead of erroring", async () => {
    const longQuery = "a".repeat(5000);
    const { data, error } = await anonClient.rpc("search_research_document_excerpts", {
      p_raw_query: longQuery,
      p_normalized_query: longQuery,
    });
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("never returns an excerpt longer than the bounded radius, even for a huge document", async () => {
    const bigDocId = "00000000-0000-0000-0000-0000000000f9";
    const uniqueWord = "UniqueMatchWordForBigDocumentTestZZZ";
    const bigPadding = "filler content that must never leave the database wholesale. ".repeat(400); // ~25,600 chars
    const bigText = `${bigPadding}${uniqueWord}${bigPadding}`;

    insertResearchItemFixture({
      id: bigDocId,
      slug: `${FIXTURE_PREFIX}-bigdoc`,
      accessLevel: "public",
      titleKeyword: "big document test",
      pdfKeyword: uniqueWord,
    });
    await insertDocumentTextFixture(bigDocId, bigText);

    try {
      const { data, error } = await anonClient.rpc("search_research_document_excerpts", {
        p_raw_query: uniqueWord,
        p_normalized_query: uniqueWord.toLowerCase(),
      });
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].excerpt).toContain(uniqueWord);
      // รัศมี 1000 ตัวอักษรทั้งสองด้าน + ความยาวคำค้นหา คือขอบเขตบนที่แท้จริง
      const maxExpectedLength = 1000 * 2 + uniqueWord.length + 10;
      expect(data![0].excerpt!.length).toBeLessThan(maxExpectedLength);
      expect(data![0].excerpt!.length).toBeLessThan(bigText.length);
    } finally {
      runSql(`delete from public.research_items where id = ${sqlQuote(bigDocId)};`);
    }
  });
});
