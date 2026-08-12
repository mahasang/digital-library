# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-verification.spec.ts >> role gate — admin >> admin can reach its allowed pages and is blocked (403) from higher-rank pages
- Location: e2e\auth-verification.spec.ts:108:9

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3001/dashboard/settings", waiting until "networkidle"

```

# Test source

```ts
  15  |  * ทดสอบนี้)
  16  |  */
  17  | 
  18  | const ACCOUNTS = {
  19  |   member: { email: process.env.E2E_MEMBER_EMAIL, password: process.env.E2E_MEMBER_PASSWORD },
  20  |   staff: { email: process.env.E2E_STAFF_EMAIL, password: process.env.E2E_STAFF_PASSWORD },
  21  |   librarian: { email: process.env.E2E_LIBRARIAN_EMAIL, password: process.env.E2E_LIBRARIAN_PASSWORD },
  22  |   admin: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
  23  |   super_admin: { email: process.env.E2E_SUPERADMIN_EMAIL, password: process.env.E2E_SUPERADMIN_PASSWORD },
  24  | } as const;
  25  | 
  26  | type RoleName = keyof typeof ACCOUNTS;
  27  | const ALL_ROLES = Object.keys(ACCOUNTS) as RoleName[];
  28  | 
  29  | async function loginAs(page: Page, email: string, password: string) {
  30  |   await page.goto("/login", { waitUntil: "networkidle" });
  31  |   await page.getByRole("textbox", { name: /อีเมล/ }).fill(email);
  32  |   await page.getByRole("textbox", { name: "รหัสผ่าน" }).fill(password);
  33  |   await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  34  |   await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15_000 });
  35  | }
  36  | 
  37  | function hasAccount(role: RoleName) {
  38  |   return Boolean(ACCOUNTS[role].email && ACCOUNTS[role].password);
  39  | }
  40  | 
  41  | // ------------------------------------------------------------------
  42  | // 1) Logout
  43  | // ------------------------------------------------------------------
  44  | test.describe("logout", () => {
  45  |   const { email, password } = ACCOUNTS.member;
  46  |   test.skip(!email || !password, "E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set — skipping");
  47  | 
  48  |   test("logging out clears the session — protected pages redirect to /login again afterward", async ({
  49  |     page,
  50  |   }) => {
  51  |     await loginAs(page, email!, password!);
  52  | 
  53  |     await page.goto("/account", { waitUntil: "networkidle" });
  54  |     await expect(page).toHaveURL(/\/account/);
  55  | 
  56  |     await page.getByRole("button", { name: "ออกจากระบบ" }).first().click();
  57  |     await page.waitForURL((u) => u.pathname === "/", { timeout: 10_000 });
  58  | 
  59  |     // guest อีกครั้งแล้ว — เข้าหน้าที่ต้อง login ต้องถูกเด้งไป /login
  60  |     await page.goto("/account", { waitUntil: "networkidle" });
  61  |     await expect(page).toHaveURL(/\/login/);
  62  |   });
  63  | });
  64  | 
  65  | // ------------------------------------------------------------------
  66  | // 2) Protected-route role-gate matrix (middleware.ts:
  67  | //    LOGIN_REQUIRED_PREFIXES / ROLE_REQUIRED_PREFIXES)
  68  | // ------------------------------------------------------------------
  69  | test.describe("role gate — guest", () => {
  70  |   test("guest is redirected to /login from any login-required or role-required page", async ({
  71  |     page,
  72  |   }) => {
  73  |     for (const path of ["/account", "/favorites", "/submit-research", "/dashboard", "/superadmin"]) {
  74  |       await page.goto(path, { waitUntil: "networkidle" });
  75  |       await expect(page, `guest visiting ${path}`).toHaveURL(/\/login/);
  76  |     }
  77  |   });
  78  | });
  79  | 
  80  | const ROLE_GATE_MATRIX: Record<RoleName, { allowed: string[]; forbidden: string[] }> = {
  81  |   member: {
  82  |     allowed: ["/account", "/favorites"],
  83  |     forbidden: ["/submit-research", "/dashboard", "/superadmin"],
  84  |   },
  85  |   staff: {
  86  |     allowed: ["/account", "/submit-research", "/my-submissions"],
  87  |     forbidden: ["/dashboard", "/superadmin"],
  88  |   },
  89  |   librarian: {
  90  |     allowed: ["/dashboard"],
  91  |     forbidden: ["/dashboard/users", "/dashboard/settings", "/superadmin"],
  92  |   },
  93  |   admin: {
  94  |     allowed: ["/dashboard", "/dashboard/users", "/dashboard/settings"],
  95  |     forbidden: ["/superadmin"],
  96  |   },
  97  |   super_admin: {
  98  |     allowed: ["/dashboard", "/dashboard/users", "/superadmin"],
  99  |     forbidden: [],
  100 |   },
  101 | };
  102 | 
  103 | for (const role of ALL_ROLES) {
  104 |   test.describe(`role gate — ${role}`, () => {
  105 |     const { email, password } = ACCOUNTS[role];
  106 |     test.skip(!hasAccount(role), `E2E_${role.toUpperCase()}_EMAIL / _PASSWORD not set — skipping`);
  107 | 
  108 |     test(`${role} can reach its allowed pages and is blocked (403) from higher-rank pages`, async ({
  109 |       page,
  110 |     }) => {
  111 |       await loginAs(page, email!, password!);
  112 | 
  113 |       const { allowed, forbidden } = ROLE_GATE_MATRIX[role];
  114 |       for (const path of allowed) {
> 115 |         await page.goto(path, { waitUntil: "networkidle" });
      |                    ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  116 |         expect(page.url(), `${role} visiting ${path} (expected allowed)`).not.toContain("/403");
  117 |         expect(page.url(), `${role} visiting ${path} (expected allowed)`).not.toContain("/login");
  118 |       }
  119 |       for (const path of forbidden) {
  120 |         await page.goto(path, { waitUntil: "networkidle" });
  121 |         await expect(page, `${role} visiting ${path} (expected forbidden)`).toHaveURL(/\/403/);
  122 |       }
  123 |     });
  124 |   });
  125 | }
  126 | 
  127 | // ------------------------------------------------------------------
  128 | // 3) Corrupted / tampered token handling
  129 | // ------------------------------------------------------------------
  130 | test.describe("corrupted session token", () => {
  131 |   const { email, password } = ACCOUNTS.member;
  132 |   test.skip(!email || !password, "E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set — skipping");
  133 | 
  134 |   async function tamperAccessToken(context: BrowserContext) {
  135 |     const cookies = await context.cookies();
  136 |     const authCookie = cookies.find((c) => c.name.includes("auth-token") && !c.name.endsWith(".1"));
  137 |     expect(authCookie, "expected a Supabase auth-token cookie to exist after login").toBeTruthy();
  138 | 
  139 |     // ทำลาย payload ของ token ให้ decode ไม่ได้/ยืนยันกับ Supabase Auth server
  140 |     // ไม่ผ่านแน่นอน — จำลอง token เสียหาย/ปลอมแปลง (ไม่ใช่แค่หมดอายุตามเวลา
  141 |     // ซึ่งทดสอบจริงในเบราว์เซอร์อัตโนมัติได้ยากกว่ามากเพราะต้องรอเป็นชั่วโมง)
  142 |     const tampered = authCookie!.value.slice(0, -20) + "AAAAAAAAAAAAAAAAAAAA";
  143 |     await context.addCookies([{ ...authCookie!, value: tampered }]);
  144 |   }
  145 | 
  146 |   test("a tampered/invalid access token is treated as logged-out, not a crash and not a bypass", async ({
  147 |     page,
  148 |     context,
  149 |   }) => {
  150 |     await loginAs(page, email!, password!);
  151 |     await tamperAccessToken(context);
  152 | 
  153 |     // ต้องไม่ crash (ไม่ใช่หน้า error 500) และไม่ถือว่ายัง login อยู่ (bypass)
  154 |     // middleware.ts ตรวจพบ getUser() ล้มเหลว -> signOut() -> ปฏิบัติเหมือน guest
  155 |     const response = await page.goto("/account", { waitUntil: "networkidle" });
  156 |     expect(response?.status(), "corrupted-token request must not 500").toBeLessThan(500);
  157 |     await expect(page).toHaveURL(/\/login/);
  158 |   });
  159 | });
  160 | 
  161 | // ------------------------------------------------------------------
  162 | // 4) Document download authorization (real seed data — see supabase/seed.sql)
  163 | //    eng-2024-001 = public (downloadable by everyone, even guest)
  164 | //    it-2024-002  = member_only (visible + downloadable only at rank >= 10)
  165 | //    edu-2024-005 = read_only (visible to everyone, downloadable by no one)
  166 | // ------------------------------------------------------------------
  167 | test.describe("document download authorization", () => {
  168 |   test("guest can download a public item without logging in", async ({ page }) => {
  169 |     await page.goto("/research/eng-2024-001", { waitUntil: "networkidle" });
  170 |     await expect(page.getByRole("button", { name: "ดาวน์โหลดไฟล์" })).toBeEnabled();
  171 |   });
  172 | 
  173 |   test("guest cannot see a member_only item at all (404, not a login prompt)", async ({ page }) => {
  174 |     const response = await page.goto("/research/it-2024-002", { waitUntil: "networkidle" });
  175 |     expect(response?.status()).toBe(404);
  176 |   });
  177 | 
  178 |   test("a read_only item is visible but never downloadable, even for a member", async ({ page }) => {
  179 |     const { email, password } = ACCOUNTS.member;
  180 |     test.skip(!email || !password, "E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set — skipping");
  181 | 
  182 |     await loginAs(page, email!, password!);
  183 |     await page.goto("/research/edu-2024-005", { waitUntil: "networkidle" });
  184 |     // read_only ไม่ผ่าน canDownload() เลย — หน้าเว็บจึงแสดง AccessRequestButton
  185 |     // (ปุ่ม "ขอสิทธิ์ดาวน์โหลด" หรือ สถานะคำขอเดิมถ้าเคยส่งคำขอไปแล้ว — ทั้งสอง
  186 |     // กรณีมีข้อความ "ขอสิทธิ์ดาวน์โหลด" ปรากฏอยู่เสมอ) แทน DownloadButton ที่ใช้
  187 |     // งานได้จริงไปเลย — ไม่ใช่ DownloadButton เวอร์ชันปิดใช้งาน สิ่งที่สำคัญ
  188 |     // ด้านความปลอดภัยจริงๆ คือปุ่มดาวน์โหลดที่ใช้งานได้จริงต้องไม่ปรากฏเด็ดขาด
  189 |     await expect(page.getByText(/ขอสิทธิ์ดาวน์โหลด/).first()).toBeVisible();
  190 |     await expect(page.getByRole("button", { name: "ดาวน์โหลดไฟล์" })).toHaveCount(0);
  191 |   });
  192 | 
  193 |   test("a logged-in member can see and download a member_only item", async ({ page }) => {
  194 |     const { email, password } = ACCOUNTS.member;
  195 |     test.skip(!email || !password, "E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set — skipping");
  196 | 
  197 |     await loginAs(page, email!, password!);
  198 |     await page.goto("/research/it-2024-002", { waitUntil: "networkidle" });
  199 |     await expect(page.getByRole("button", { name: "ดาวน์โหลดไฟล์" })).toBeEnabled();
  200 |   });
  201 | });
  202 | 
```