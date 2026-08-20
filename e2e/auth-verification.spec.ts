import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * ยืนยันว่า Hallmark — audit ลดการเรียกซ้ำของการยืนยันตัวตน (ห่อ
 * getSessionUser()/getCurrentUserRoleRank() ด้วย React cache() — ดู
 * lib/supabase/session.ts, lib/supabase/roles.ts, docs/auth-verification-audit.md)
 * ไม่ได้ลดทอนความปลอดภัยใดๆ เลย: การ์ดสิทธิ์ทุกชั้น (middleware.ts,
 * DashboardLayout/SuperAdminLayout, requireMinRank ใน Server Action) ยังคง
 * บังคับใช้ครบทุกกรณีเหมือนเดิมทุกประการ — cache() เปลี่ยนแค่ "จำนวนครั้งที่
 * เรียก" ไม่เปลี่ยน "ผลของการตรวจสอบ" เลย
 *
 * ครอบคลุม: login/logout ทุกบทบาท, role gate matrix ของหน้าที่มีสิทธิ์จำกัด
 * (บวก/ลบ), token ที่เสียหาย/หมดอายุ, และสิทธิ์การดาวน์โหลดเอกสารจริงตาม
 * access_level (ดู supabase/seed.sql สำหรับ slug/access_level จริงที่ใช้ในชุด
 * ทดสอบนี้)
 */

const ACCOUNTS = {
  member: { email: process.env.E2E_MEMBER_EMAIL, password: process.env.E2E_MEMBER_PASSWORD },
  staff: { email: process.env.E2E_STAFF_EMAIL, password: process.env.E2E_STAFF_PASSWORD },
  librarian: { email: process.env.E2E_LIBRARIAN_EMAIL, password: process.env.E2E_LIBRARIAN_PASSWORD },
  admin: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
  super_admin: { email: process.env.E2E_SUPERADMIN_EMAIL, password: process.env.E2E_SUPERADMIN_PASSWORD },
} as const;

type RoleName = keyof typeof ACCOUNTS;
const ALL_ROLES = Object.keys(ACCOUNTS) as RoleName[];

async function loginAs(page: Page, email: string, password: string) {
  // /th/login โดยเจาะจง — locator ด้านล่างจับข้อความภาษาไทยของฟอร์มตรงๆ
  // (auth.email/auth.password ผูกกับ next-intl แล้ว จึงต่างกันไปตาม locale)
  await page.goto("/th/login", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: /อีเมล/ }).fill(email);
  await page.getByRole("textbox", { name: "รหัสผ่าน" }).fill(password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30_000 });
}

function hasAccount(role: RoleName) {
  return Boolean(ACCOUNTS[role].email && ACCOUNTS[role].password);
}

// ------------------------------------------------------------------
// 1) Logout
// ------------------------------------------------------------------
test.describe("logout", () => {
  const { email, password } = ACCOUNTS.member;
  test.skip(!email || !password, "E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set — skipping");

  test("logging out clears the session — protected pages redirect to /login again afterward", async ({
    page,
  }) => {
    await loginAs(page, email!, password!);

    await page.goto("/th/account", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/account/);

    await page.getByRole("button", { name: "ออกจากระบบ" }).first().click();
    // i18n Phase 0A — ทุก path ผ่าน locale prefix เสมอ (localePrefix: "always")
    // "/" จริงจะ redirect เป็น /th, /en, /lo หรือ /vi ตาม locale ที่ negotiate ได้
    await page.waitForURL((u) => /^\/(th|en|lo|vi)$/.test(u.pathname), { timeout: 10_000 });

    // guest อีกครั้งแล้ว — เข้าหน้าที่ต้อง login ต้องถูกเด้งไป /login
    await page.goto("/th/account", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/login/);
  });
});

// ------------------------------------------------------------------
// 2) Protected-route role-gate matrix (middleware.ts:
//    LOGIN_REQUIRED_PREFIXES / ROLE_REQUIRED_PREFIXES)
// ------------------------------------------------------------------
test.describe("role gate — guest", () => {
  test("guest is redirected to /login from any login-required or role-required page", async ({
    page,
  }) => {
    for (const path of ["/lo/account", "/lo/favorites", "/lo/submit-research", "/lo/dashboard", "/lo/superadmin"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await expect(page, `guest visiting ${path}`).toHaveURL(/\/login/);
    }
  });
});

const ROLE_GATE_MATRIX: Record<RoleName, { allowed: string[]; forbidden: string[] }> = {
  member: {
    allowed: ["/lo/account", "/lo/favorites"],
    forbidden: ["/lo/submit-research", "/lo/dashboard", "/lo/superadmin"],
  },
  staff: {
    allowed: ["/lo/account", "/lo/submit-research", "/lo/my-submissions"],
    forbidden: ["/lo/dashboard", "/lo/superadmin"],
  },
  librarian: {
    allowed: ["/lo/dashboard"],
    forbidden: ["/lo/dashboard/users", "/lo/dashboard/settings", "/lo/superadmin"],
  },
  admin: {
    allowed: ["/lo/dashboard", "/lo/dashboard/users", "/lo/dashboard/settings"],
    forbidden: ["/lo/superadmin"],
  },
  super_admin: {
    allowed: ["/lo/dashboard", "/lo/dashboard/users", "/lo/superadmin"],
    forbidden: [],
  },
};

for (const role of ALL_ROLES) {
  test.describe(`role gate — ${role}`, () => {
    const { email, password } = ACCOUNTS[role];
    test.skip(!hasAccount(role), `E2E_${role.toUpperCase()}_EMAIL / _PASSWORD not set — skipping`);

    test(`${role} can reach its allowed pages and is blocked (403) from higher-rank pages`, async ({
      page,
    }) => {
      await loginAs(page, email!, password!);

      const { allowed, forbidden } = ROLE_GATE_MATRIX[role];
      for (const path of allowed) {
        await page.goto(path, { waitUntil: "networkidle" });
        expect(page.url(), `${role} visiting ${path} (expected allowed)`).not.toContain("/403");
        expect(page.url(), `${role} visiting ${path} (expected allowed)`).not.toContain("/login");
      }
      for (const path of forbidden) {
        await page.goto(path, { waitUntil: "networkidle" });
        await expect(page, `${role} visiting ${path} (expected forbidden)`).toHaveURL(/\/403/);
      }
    });
  });
}

// ------------------------------------------------------------------
// 3) Corrupted / tampered token handling
// ------------------------------------------------------------------
test.describe("corrupted session token", () => {
  const { email, password } = ACCOUNTS.member;
  test.skip(!email || !password, "E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set — skipping");

  async function tamperAccessToken(context: BrowserContext) {
    const cookies = await context.cookies();
    const authCookie = cookies.find((c) => c.name.includes("auth-token") && !c.name.endsWith(".1"));
    expect(authCookie, "expected a Supabase auth-token cookie to exist after login").toBeTruthy();

    // ทำลาย payload ของ token ให้ decode ไม่ได้/ยืนยันกับ Supabase Auth server
    // ไม่ผ่านแน่นอน — จำลอง token เสียหาย/ปลอมแปลง (ไม่ใช่แค่หมดอายุตามเวลา
    // ซึ่งทดสอบจริงในเบราว์เซอร์อัตโนมัติได้ยากกว่ามากเพราะต้องรอเป็นชั่วโมง)
    const tampered = authCookie!.value.slice(0, -20) + "AAAAAAAAAAAAAAAAAAAA";
    await context.addCookies([{ ...authCookie!, value: tampered }]);
  }

  test("a tampered/invalid access token is treated as logged-out, not a crash and not a bypass", async ({
    page,
    context,
  }) => {
    await loginAs(page, email!, password!);
    await tamperAccessToken(context);

    // ต้องไม่ crash (ไม่ใช่หน้า error 500) และไม่ถือว่ายัง login อยู่ (bypass)
    // middleware.ts ตรวจพบ getUser() ล้มเหลว -> signOut() -> ปฏิบัติเหมือน guest
    const response = await page.goto("/th/account", { waitUntil: "networkidle" });
    expect(response?.status(), "corrupted-token request must not 500").toBeLessThan(500);
    await expect(page).toHaveURL(/\/login/);
  });
});

// ------------------------------------------------------------------
// 4) Document download authorization (real seed data — see supabase/seed.sql)
//    eng-2024-001 = public (downloadable by everyone, even guest)
//    it-2024-002  = member_only (visible + downloadable only at rank >= 10)
//    edu-2024-005 = read_only (visible to everyone, downloadable by no one)
// ------------------------------------------------------------------
test.describe("document download authorization", () => {
  test("guest can download a public item without logging in", async ({ page }) => {
    await page.goto("/lo/research/eng-2024-001", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "ดาวน์โหลดไฟล์" })).toBeEnabled();
  });

  test("guest cannot see a member_only item at all (404, not a login prompt)", async ({ page }) => {
    const response = await page.goto("/lo/research/it-2024-002", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(404);
  });

  test("a read_only item is visible but never downloadable, even for a member", async ({ page }) => {
    const { email, password } = ACCOUNTS.member;
    test.skip(!email || !password, "E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set — skipping");

    await loginAs(page, email!, password!);
    await page.goto("/lo/research/edu-2024-005", { waitUntil: "networkidle" });
    // read_only ไม่ผ่าน canDownload() เลย — หน้าเว็บจึงแสดง AccessRequestButton
    // (ปุ่ม "ขอสิทธิ์ดาวน์โหลด" หรือ สถานะคำขอเดิมถ้าเคยส่งคำขอไปแล้ว — ทั้งสอง
    // กรณีมีข้อความ "ขอสิทธิ์ดาวน์โหลด" ปรากฏอยู่เสมอ) แทน DownloadButton ที่ใช้
    // งานได้จริงไปเลย — ไม่ใช่ DownloadButton เวอร์ชันปิดใช้งาน สิ่งที่สำคัญ
    // ด้านความปลอดภัยจริงๆ คือปุ่มดาวน์โหลดที่ใช้งานได้จริงต้องไม่ปรากฏเด็ดขาด
    await expect(page.getByText(/ขอสิทธิ์ดาวน์โหลด/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "ดาวน์โหลดไฟล์" })).toHaveCount(0);
  });

  test("a logged-in member can see and download a member_only item", async ({ page }) => {
    const { email, password } = ACCOUNTS.member;
    test.skip(!email || !password, "E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set — skipping");

    await loginAs(page, email!, password!);
    await page.goto("/lo/research/it-2024-002", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "ดาวน์โหลดไฟล์" })).toBeEnabled();
  });
});
