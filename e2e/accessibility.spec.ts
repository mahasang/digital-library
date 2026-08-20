import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Hallmark Audit Phase 5 — automated accessibility regression suite.
 * Runs axe-core against the key routes named in the phase's verification
 * plan, in both the light and dark theme, and fails on any WCAG 2.1 AA
 * violation. This needs a real browser (not the Vitest/jsdom unit suite)
 * because axe's contrast and focus checks depend on actual computed layout.
 *
 * Authenticated checks read credentials from env (see test/setup-env.ts,
 * .env.local) rather than hardcoding real account passwords in source, and
 * skip themselves if those vars aren't configured (e.g. on a machine
 * without the seeded accounts from this project's README bootstrap step).
 */

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((t) => window.localStorage.setItem("theme", t), theme);
  await page.reload({ waitUntil: "networkidle" });
}

function formatViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  if (violations.length === 0) return "";
  return violations
    .map((v) => {
      const nodes = v.nodes.map((n) => `    ${n.target.join(" ")} — ${n.failureSummary}`).join("\n");
      return `\n[${v.id}] (${v.impact}) ${v.help}\n  ${v.helpUrl}\n${nodes}`;
    })
    .join("\n");
}

async function expectNoViolations(page: Page) {
  // "best-practice" picks up axe's heading-order/landmark-one-main/
  // page-has-heading-one/region rules — none of those carry a wcag2a/aa
  // tag on their own, but they're exactly what Section 3 of this audit
  // (DOM heading/landmark structure) asks to verify.
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "best-practice"])
    .analyze();
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
}

const PUBLIC_ROUTES: { name: string; path: string }[] = [
  { name: "homepage", path: "/lo/" },
  { name: "research-search", path: "/lo/research" },
  { name: "research-detail", path: "/lo/research/eng-2024-001" },
  { name: "login", path: "/lo/login" },
  { name: "register", path: "/lo/register" },
];

for (const theme of THEMES) {
  test.describe(`public routes — ${theme} theme`, () => {
    for (const route of PUBLIC_ROUTES) {
      test(route.name, async ({ page }) => {
        await page.goto(route.path, { waitUntil: "networkidle" });
        await setTheme(page, theme);
        await expectNoViolations(page);
      });
    }
  });
}

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function loginAs(page: Page, email: string, password: string) {
  // ไปที่ /th/login โดยเจาะจง (ไม่ใช่ /lo/login เหมือน route อื่นในไฟล์นี้)
  // เพราะ locator ด้านล่างจับข้อความภาษาไทยของฟอร์มตรงๆ — ตอนนี้ auth.email/
  // auth.password ผูกกับ next-intl แล้ว (ก่อนหน้านี้ฟอร์ม hardcode ภาษาไทย
  // เสมอไม่ว่า locale ไหน จึงบังเอิญตรงกับ /lo/login มาตลอด) หลัง login สำเร็จ
  // แต่ละ test ยัง page.goto("/lo/...") ต่อได้ตามปกติ เพราะ session cookie
  // ของ Supabase auth ไม่ผูกกับ locale prefix ใน URL เลย
  await page.goto("/th/login", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: /อีเมล/ }).fill(email);
  await page.getByRole("textbox", { name: "รหัสผ่าน" }).fill(password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30_000 });
}

const AUTH_ROUTES: { name: string; path: string }[] = [
  // ยืนยันว่าหน้าแรกยัง render ได้ปกติสำหรับผู้ใช้ที่ login แล้วด้วย ไม่ใช่แค่
  // guest (ดู PUBLIC_ROUTES ด้านบน) — เกี่ยวข้องโดยตรงกับ homepage data-flow
  // optimization: root layout ยังคงดึง getSessionUser() แยกเป็นของตัวเองตาม
  // เดิม ส่วนหน้าแรกเองก็ต้องแสดงผลถูกต้องไม่ว่า user จะเป็นใคร เพราะ
  // ไม่มีการปรับเนื้อหาตามสิทธิ์ผู้ใช้เลย (ข้อมูลสาธารณะล้วน)
  { name: "homepage", path: "/lo/" },
  { name: "account-profile", path: "/lo/account" },
  { name: "favorites", path: "/lo/favorites" },
  { name: "notifications", path: "/lo/notifications" },
  { name: "dashboard-overview", path: "/lo/dashboard" },
  { name: "dashboard-reports", path: "/lo/dashboard/reports" },
];

test.describe("authenticated (admin) routes", () => {
  test.skip(
    !adminEmail || !adminPassword,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set in .env.local — skipping authenticated a11y checks"
  );

  for (const theme of THEMES) {
    for (const route of AUTH_ROUTES) {
      test(`${route.name} — ${theme} theme`, async ({ page }) => {
        await loginAs(page, adminEmail!, adminPassword!);
        await page.goto(route.path, { waitUntil: "networkidle" });
        await setTheme(page, theme);
        await expectNoViolations(page);
      });
    }
  }
});

const superAdminEmail = process.env.E2E_SUPERADMIN_EMAIL;
const superAdminPassword = process.env.E2E_SUPERADMIN_PASSWORD;

test.describe("mfa challenge screen", () => {
  test.skip(
    !superAdminEmail || !superAdminPassword,
    "E2E_SUPERADMIN_EMAIL / E2E_SUPERADMIN_PASSWORD not set in .env.local — skipping"
  );

  for (const theme of THEMES) {
    test(`mfa-challenge — ${theme} theme`, async ({ page }) => {
      await loginAs(page, superAdminEmail!, superAdminPassword!);
      // MFA is enforced on access to a super_admin-scoped route, not at
      // login itself — login always lands on "/" first.
      await page.goto("/lo/superadmin/overview", { waitUntil: "networkidle" });
      expect(page.url()).toContain("/mfa-challenge");
      await setTheme(page, theme);
      await expectNoViolations(page);
    });
  }
});
