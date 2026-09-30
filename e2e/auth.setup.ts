import { test as setup } from "@playwright/test";

/**
 * Logs in through the real login form once per role and saves the session to
 * e2e/.auth/<role>.json (gitignored — contains session tokens). Specs reuse it
 * via test.use({ storageState }) so the suite stays inside the login rate
 * limit (10 attempts / 15 min / IP). super_admin is not handled here: its
 * /superadmin/* routes need a live TOTP code that can't be automated.
 */
const ROLES = [
  { role: "member", prefix: "E2E_MEMBER" },
  { role: "staff", prefix: "E2E_STAFF" },
  { role: "librarian", prefix: "E2E_LIBRARIAN" },
  { role: "admin", prefix: "E2E_ADMIN" },
] as const;

for (const { role, prefix } of ROLES) {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];

  setup(`authenticate ${role}`, async ({ page }) => {
    setup.skip(!email || !password, `${prefix}_EMAIL / ${prefix}_PASSWORD not set — skipping`);

    await page.goto("/th/login", { waitUntil: "networkidle" });
    await page.getByRole("textbox", { name: /อีเมล/ }).fill(email!);
    await page.getByRole("textbox", { name: "รหัสผ่าน" }).fill(password!);
    await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30_000 });

    await page.context().storageState({ path: `e2e/.auth/${role}.json` });
  });
}
