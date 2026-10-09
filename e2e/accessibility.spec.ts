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

/**
 * Finds a detail-page URL by following a real link on a list page, so the suite never
 * hard-codes an id. If the list has no matching link the test FAILS with an explicit
 * message (it never skips silently): these pages need seeded data to be checked at all.
 */
async function firstDetailHref(page: Page, listPath: string, pattern: RegExp, needs: string): Promise<string> {
  await page.goto(listPath, { waitUntil: "networkidle" });
  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((anchors) => anchors.map((a) => a.getAttribute("href") ?? ""));
  const href = hrefs.find((h) => pattern.test(h));
  if (!href) {
    throw new Error(
      `a11y suite: no link matching ${pattern} on ${listPath}. The local database needs ${needs} ` +
        `for this page to be checked — seed it instead of skipping.`
    );
  }
  return href;
}

const PUBLIC_ROUTES: { name: string; path: string }[] = [
  { name: "homepage", path: "/lo/" },
  { name: "research-search", path: "/lo/research" },
  { name: "research-detail", path: "/lo/research/eng-2024-001" },
  { name: "login", path: "/lo/login" },
  { name: "register", path: "/lo/register" },
  // Phase 2B — public pages whose violations were fixed. /contact is left out on
  // purpose: its nested <main> is a layout issue tracked for Phase 2C.
  { name: "blog", path: "/lo/blog" },
  { name: "privacy", path: "/lo/privacy" },
  { name: "terms", path: "/lo/terms" },
  { name: "forgot-password", path: "/lo/auth/forgot-password" },
  { name: "about", path: "/lo/about" },
  // Phase 2C — its nested <main> was replaced by a <div>
  { name: "contact", path: "/lo/contact" },
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

// Phase 2C — author detail page; the id comes from research list -> research detail -> author link.
for (const theme of THEMES) {
  test.describe(`public dynamic routes — ${theme} theme`, () => {
    test("author-detail", async ({ page }) => {
      const research = await firstDetailHref(page, "/lo/research", /\/research\/[^/?#]+$/, "at least one published research item");
      const author = await firstDetailHref(page, research, /\/authors\/[^/?#]+$/, "a published research item with an author");
      await page.goto(author, { waitUntil: "networkidle" });
      await setTheme(page, theme);
      await expectNoViolations(page);
    });
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
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
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
  // Phase 2B — forms/filters that were unlabeled (upload form, list filters, settings).
  // The research edit page needs a real id, so it is covered by manual scans only.
  { name: "submit-research", path: "/lo/submit-research" },
  { name: "dashboard-research", path: "/lo/dashboard/research" },
  { name: "dashboard-research-new", path: "/lo/dashboard/research/new" },
  { name: "dashboard-authors", path: "/lo/dashboard/authors" },
  { name: "dashboard-access-requests", path: "/lo/dashboard/access-requests" },
  { name: "dashboard-contact-messages", path: "/lo/dashboard/contact-messages" },
  { name: "dashboard-users", path: "/lo/dashboard/users" },
  { name: "dashboard-audit-logs", path: "/lo/dashboard/audit-logs" },
  { name: "dashboard-settings", path: "/lo/dashboard/settings" },
  // Phase 2C — blog-admin (nested <main>, missing labels and dark-mode surfaces fixed)
  { name: "blog-admin", path: "/lo/blog-admin" },
  { name: "blog-admin-new", path: "/lo/blog-admin/new" },
];

test.describe("authenticated (admin) routes", () => {
  test.skip(
    !adminEmail || !adminPassword,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set in .env.local — skipping authenticated a11y checks"
  );
  // session from e2e/auth.setup.ts — avoids one login per test (rate limit)
  test.use({ storageState: "e2e/.auth/admin.json" });

  for (const theme of THEMES) {
    for (const route of AUTH_ROUTES) {
      test(`${route.name} — ${theme} theme`, async ({ page }) => {
        await page.goto(route.path, { waitUntil: "networkidle" });
        await setTheme(page, theme);
        await expectNoViolations(page);
      });
    }

    // Phase 2C — edit pages; ids are found by following the first "edit" link of each list.
    test(`dashboard-research-edit — ${theme} theme`, async ({ page }) => {
      const edit = await firstDetailHref(page, "/lo/dashboard/research", /\/dashboard\/research\/[^/?#]+\/edit$/, "at least one research item");
      await page.goto(edit, { waitUntil: "networkidle" });
      await setTheme(page, theme);
      await expectNoViolations(page);
    });

    test(`blog-admin-edit — ${theme} theme`, async ({ page }) => {
      const edit = await firstDetailHref(page, "/lo/blog-admin", /\/blog-admin\/[^/?#]+\/edit$/, "at least one blog post (create a draft)");
      await page.goto(edit, { waitUntil: "networkidle" });
      await setTheme(page, theme);
      await expectNoViolations(page);
    });
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
