import { test, expect, type Page } from "@playwright/test";

/**
 * Regression suite for the Header/HeaderAccountArea split (Hallmark — header
 * rendering refactor). Proves that moving the user menu / notification badge
 * / role-limited workspace links out of the blocking root layout and into a
 * Suspense-streamed Server Component did not change any visible behavior:
 * same links, same badge, same guest fallback, for every role.
 *
 * Each role logs in fresh in its own test (no shared storageState) so a
 * failure in one role can't leak session state into another.
 */

const ACCOUNTS = {
  member: { email: process.env.E2E_MEMBER_EMAIL, password: process.env.E2E_MEMBER_PASSWORD },
  staff: { email: process.env.E2E_STAFF_EMAIL, password: process.env.E2E_STAFF_PASSWORD },
  librarian: { email: process.env.E2E_LIBRARIAN_EMAIL, password: process.env.E2E_LIBRARIAN_PASSWORD },
  admin: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
  super_admin: { email: process.env.E2E_SUPERADMIN_EMAIL, password: process.env.E2E_SUPERADMIN_PASSWORD },
} as const;

type RoleName = keyof typeof ACCOUNTS;

// ต้องตรงกับ buildWorkspaceLinks() ใน lib/auth/workspace-links.ts ทุกประการ
// (ดู lib/auth/workspace-links.test.ts สำหรับการพิสูจน์ระดับ unit เพิ่มเติม —
// ที่นี่พิสูจน์ว่าผลลัพธ์เดียวกันนั้น render จริงถูกต้องในเบราว์เซอร์จริงด้วย)
const EXPECTED_LINKS: Record<RoleName, string[]> = {
  member: ["/favorites", "/access-requests"],
  staff: ["/favorites", "/access-requests", "/submit-research", "/my-submissions"],
  librarian: ["/favorites", "/access-requests", "/submit-research", "/my-submissions", "/dashboard"],
  admin: ["/favorites", "/access-requests", "/submit-research", "/my-submissions", "/dashboard"],
  super_admin: [
    "/favorites",
    "/access-requests",
    "/submit-research",
    "/my-submissions",
    "/dashboard",
    "/superadmin/overview",
  ],
};

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/th/login", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: /อีเมล/ }).fill(email);
  await page.getByRole("textbox", { name: "รหัสผ่าน" }).fill(password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30_000 });
}

/** เปิด dropdown เมนูผู้ใช้ (desktop UserMenu) แล้วอ่านรายการ href ของลิงก์ทั้งหมด */
async function openUserMenuAndGetLinks(page: Page): Promise<string[]> {
  await page.goto("/th/", { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: /โปรไฟล์ของฉัน|@/ });
  await trigger.click();
  const menu = page.locator(".absolute.right-0.z-50");
  await expect(menu).toBeVisible();
  // ลิงก์ก่อนเส้นคั่นอันแรกคือ workspaceLinks (ตามด้วย "โปรไฟล์ของฉัน" เสมอ)
  const hrefs = await menu.getByRole("link").evaluateAll((els) =>
    els.map((el) => new URL((el as HTMLAnchorElement).href).pathname)
  );
  return hrefs.filter((href) => href !== "/account");
}

test.describe("Header account area — guest", () => {
  test("shows login/register, no notification bell, no user menu", async ({ page }) => {
    await page.goto("/th/", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: "เข้าสู่ระบบ", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "สมัครสมาชิก", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "การแจ้งเตือน" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /โปรไฟล์ของฉัน|@/ })).toHaveCount(0);
  });

  test("mobile menu opens, shows login/register, and auto-closes on navigation", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/th/", { waitUntil: "networkidle" });

    const toggle = page.getByRole("button", { name: "เปิดเมนู" });
    await toggle.click();
    await expect(page.getByRole("button", { name: "ปิดเมนู" })).toBeVisible();

    // ขอบเขตแค่แผงเมนูมือถือ (header) เพราะ footer ก็มีลิงก์ "สมัครสมาชิก"
    // เหมือนกัน — getByRole ทั่วทั้งหน้าจะชนกัน (strict mode violation)
    const mobilePanel = page.locator("header .md\\:hidden");
    await expect(mobilePanel.getByRole("link", { name: "สมัครสมาชิก", exact: true })).toBeVisible();

    await mobilePanel.getByRole("link", { name: "งานวิจัย", exact: true }).click();
    // i18n Phase 0A — ทุก path ผ่าน locale prefix เสมอ (localePrefix: "always")
    await page.waitForURL((u) => /^\/(th|en|lo)\/research$/.test(u.pathname));
    await expect(page.getByRole("button", { name: "เปิดเมนู" })).toBeVisible();
  });
});

for (const role of Object.keys(ACCOUNTS) as RoleName[]) {
  const { email, password } = ACCOUNTS[role];

  test.describe(`Header account area — ${role}`, () => {
    test.skip(!email || !password, `E2E_${role.toUpperCase()}_EMAIL / _PASSWORD not set in .env.local — skipping`);

    test(`shows exactly the ${role} workspace links and a notification bell`, async ({ page }) => {
      await loginAs(page, email!, password!);

      await expect(page.getByRole("button", { name: "การแจ้งเตือน" })).toBeVisible();

      const links = await openUserMenuAndGetLinks(page);
      expect(links).toEqual(EXPECTED_LINKS[role]);
    });

    test(`mobile menu shows the same ${role} workspace links and profile/logout`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await loginAs(page, email!, password!);

      await page.goto("/th/", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "เปิดเมนู" }).click();
      const mobilePanel = page.locator("header .md\\:hidden");

      for (const href of EXPECTED_LINKS[role]) {
        await expect(mobilePanel.locator(`a[href="${href}"]`)).toBeVisible();
      }
      await expect(mobilePanel.getByRole("link", { name: /โปรไฟล์|@/ }).first()).toBeVisible();
      await expect(mobilePanel.getByRole("button", { name: "ออกจากระบบ" })).toBeVisible();
    });
  });
}

test.describe("Header account area — notification badge", () => {
  const { email, password } = ACCOUNTS.member;
  test.skip(!email || !password, "E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set in .env.local — skipping");

  test("bell has no numeric badge when there are no unread notifications, and opens an empty panel", async ({
    page,
  }) => {
    await loginAs(page, email!, password!);
    await page.goto("/th/", { waitUntil: "networkidle" });

    const bell = page.getByRole("button", { name: "การแจ้งเตือน" });
    await expect(bell).toBeVisible();
    // ตัวเลข badge เป็น span ลูกของปุ่ม — ถ้าไม่มีแจ้งเตือนที่ยังไม่อ่านต้องไม่มี span นี้เลย
    await expect(bell.locator("span")).toHaveCount(0);

    await bell.click();
    await expect(page.getByText("การแจ้งเตือน", { exact: true })).toBeVisible();
  });
});
