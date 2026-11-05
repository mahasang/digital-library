import { test, expect, type Page } from "@playwright/test";

const shelf = '[data-testid="hero-shelf"]';

async function openShelf(page: Page): Promise<number> {
  await page.goto("/th");
  await expect(page.locator(shelf)).toHaveAttribute("data-shelf-mode", "3d", { timeout: 20_000 });
  return currentIndex(page);
}

/** ข้อมูลทดสอบในเครื่องไม่มีปกจริง จึงแก้ payload ของหน้าก่อนถึงเบราว์เซอร์ */
async function rewriteHome(page: Page, rewrite: (html: string) => string): Promise<void> {
  await page.route("**/th", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: rewrite(await response.text()) });
  });
}

const withCovers = (html: string) =>
  html.replaceAll(
    String.raw`\"coverUrl\":null`,
    String.raw`\"coverUrl\":\"https://images.unsplash.com/photo-test\"`,
  );

const withoutAbstracts = (html: string) =>
  html.replace(/\\"abstract\\":\\"(?:[^"\]|\[^"])*\\"/g, String.raw`\"abstract\":\"\"`);

async function openBook(page: Page) {
  await page.getByRole("button", { name: "ดูเล่มนี้" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function currentIndex(page: Page): Promise<number> {
  return Number(await page.locator(shelf).getAttribute("data-shelf-index"));
}

test.describe("hero shelf", () => {
  test("shelf list renders real links", async ({ page }) => {
    await page.goto("/th");
    const links = page.locator(`${shelf} a[href*="/research/"]`);
    await expect(links.first()).toBeAttached();
    expect(await links.count()).toBeGreaterThanOrEqual(2);
  });

  test("hydrates without page errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/th", { waitUntil: "load" });
    await expect(page.locator(shelf)).toBeVisible();
    await page.waitForTimeout(1000);
    expect(errors).toEqual([]);
  });

  test("search stays usable", async ({ page }) => {
    await page.goto("/th");
    const search = page.locator('section input[type="search"]').first();
    await search.fill("วิจัย");
    await expect(search).toHaveValue("วิจัย");
  });

  test("no horizontal page overflow at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/th");
    await expect(page.locator(shelf)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("canvas appears when WebGL is available", async ({ page }) => {
    await page.goto("/th");
    await expect(page.locator(shelf)).toHaveAttribute("data-shelf-mode", "3d", { timeout: 20_000 });
    await expect(page.locator(`${shelf} canvas`)).toBeVisible();
  });

  test("falls back without WebGL", async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type.startsWith("webgl")) return null;
        return (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof original;
    });
    await page.goto("/th");
    await page.waitForTimeout(2500);
    await expect(page.locator(shelf)).toHaveAttribute("data-shelf-mode", "list");
    await expect(page.locator(`${shelf} canvas`)).toHaveCount(0);
    await expect(page.locator(`${shelf} a[href*="/research/"]`).first()).toBeVisible();
  });

  test("does not leave a scene after leaving home", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/th", { waitUntil: "commit" });
    await page.goto("/th/research");
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });

  test("buttons move the shelf", async ({ page }) => {
    const start = await openShelf(page);
    await page.getByRole("button", { name: "เล่มถัดไป" }).click();
    await expect(page.locator(shelf)).toHaveAttribute("data-shelf-index", String(start + 1));
    await page.getByRole("button", { name: "เล่มก่อนหน้า" }).click();
    await expect(page.locator(shelf)).toHaveAttribute("data-shelf-index", String(start));
  });

  test("arrow keys move the shelf", async ({ page }) => {
    const start = await openShelf(page);
    await page.getByRole("button", { name: "เล่มถัดไป" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(shelf)).toHaveAttribute("data-shelf-index", String(start + 1));
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(shelf)).toHaveAttribute("data-shelf-index", String(start));
  });

  test("position marker jumps to a book", async ({ page }) => {
    await openShelf(page);
    await page.getByRole("button", { name: "เล่ม 1 จาก", exact: false }).click();
    await expect(page.locator(shelf)).toHaveAttribute("data-shelf-index", "0");
  });

  test("previous is disabled at the first book", async ({ page }) => {
    await openShelf(page);
    await page.getByRole("button", { name: "เล่ม 1 จาก", exact: false }).click();
    await expect(page.getByRole("button", { name: "เล่มก่อนหน้า" })).toBeDisabled();
  });

  test("focusing a list link moves the shelf", async ({ page }) => {
    await openShelf(page);
    await page.locator(`${shelf} a[data-shelf-index="2"]`).focus();
    await expect(page.locator(shelf)).toHaveAttribute("data-shelf-index", "2");
  });

  test("arrow keys keep focus on the link of the current book", async ({ page }) => {
    await openShelf(page);
    await page.locator(`${shelf} a[data-shelf-index="2"]`).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(`${shelf} a[data-shelf-index="3"]`)).toBeFocused();
  });

  test("vertical wheel scrolls the page", async ({ page }) => {
    await openShelf(page);
    const box = await page.locator(`${shelf} canvas`).boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test("drag moves the shelf", async ({ page }) => {
    const start = await openShelf(page);
    const box = await page.locator(`${shelf} canvas`).boundingBox();
    const y = box!.y + box!.height / 2;
    const x = box!.x + box!.width / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 60, y, { steps: 4 });
    await page.mouse.move(x - 160, y, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => currentIndex(page)).toBeGreaterThan(start);
  });

  test("resizing keeps the canvas in its band", async ({ page }) => {
    await openShelf(page);
    await page.setViewportSize({ width: 900, height: 700 });
    await expect
      .poll(() =>
        page.evaluate((selector) => {
          const section = document.querySelector(selector)!;
          const canvas = section.querySelector("canvas")!;
          return canvas.width / window.devicePixelRatio - section.clientWidth;
        }, shelf),
      )
      .toBe(0);
  });

  test("inspect opens a dialog with book details", async ({ page }) => {
    await openShelf(page);
    const dialog = await openBook(page);
    await expect(dialog.getByRole("heading")).not.toBeEmpty();
    await expect(dialog.getByRole("link", { name: "อ่านงานวิจัย" })).toHaveAttribute(
      "href",
      new RegExp("/th/research/.+"),
    );
  });

  test("escape closes and restores focus", async ({ page }) => {
    await openShelf(page);
    await openBook(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ดูเล่มนี้" })).toBeFocused();
  });

  test("tab stays inside the dialog", async ({ page }) => {
    await openShelf(page);
    const dialog = await openBook(page);
    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }
  });

  test("page scroll is locked while open", async ({ page }) => {
    await openShelf(page);
    await openBook(page);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
  });

  test("vertical wheel zooms only while inspecting", async ({ page }) => {
    await openShelf(page);
    await openBook(page);
    const box = await page.locator(`${shelf} canvas`).boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test("opening the dialog does not move the page behind it", async ({ page }) => {
    await openShelf(page);
    const before = await page.evaluate(() => document.documentElement.scrollHeight);
    await openBook(page);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(before);
  });

  test("resize while open keeps canvas in the dialog and restores the band", async ({ page }) => {
    await openShelf(page);
    const dialog = await openBook(page);
    await page.setViewportSize({ width: 800, height: 900 });
    await expect
      .poll(() =>
        dialog.evaluate((node) => {
          const canvas = node.querySelector("canvas")!;
          return canvas.width / window.devicePixelRatio - canvas.clientWidth;
        }),
      )
      .toBe(0);
    await page.keyboard.press("Escape");
    await expect
      .poll(() =>
        page.evaluate((selector) => {
          const section = document.querySelector(selector)!;
          const canvas = section.querySelector("canvas")!;
          return canvas.clientWidth - section.clientWidth;
        }, shelf),
      )
      .toBe(0);
  });

  test("real covers load through the image optimizer", async ({ page }) => {
    const widths: string[] = [];
    await rewriteHome(page, withCovers);
    await page.route("**/_next/image*", async (route) => {
      widths.push(new URL(route.request().url()).searchParams.get("w") ?? "");
      await route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          "base64",
        ),
      });
    });
    await openShelf(page);
    await expect.poll(() => widths).toContain("640");
    await openBook(page);
    await expect.poll(() => widths).toContain("1080");
  });

  test("broken cover falls back", async ({ page }) => {
    const errors: string[] = [];
    let attempts = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    await rewriteHome(page, withCovers);
    await page.route("**/_next/image*", async (route) => {
      attempts += 1;
      await route.fulfill({ status: 404, body: "" });
    });
    await openShelf(page);
    await expect.poll(() => attempts).toBeGreaterThan(0);
    await openBook(page);
    expect(errors).toEqual([]);
    await expect(page.locator(shelf)).toHaveAttribute("data-shelf-mode", "3d");
  });

  test("empty abstract hides the abstract block", async ({ page }) => {
    await rewriteHome(page, withoutAbstracts);
    await openShelf(page);
    const dialog = await openBook(page);
    await expect(dialog.getByTestId("shelf-abstract")).toHaveCount(0);
  });

  test("list stays usable while the 3D shelf is still loading", async ({ page }) => {
    await page.addInitScript(() => {
      document.fonts.load = () => new Promise(() => undefined);
    });
    await page.goto("/th");
    await expect(page.locator(`${shelf} canvas`)).toBeAttached({ timeout: 20_000 });
    await expect(page.locator(shelf)).toHaveAttribute("data-shelf-mode", "list");
    await page.locator(`${shelf} a[data-shelf-index="0"]`).click({ timeout: 5000 });
    await expect(page).toHaveURL(new RegExp("/th/research/.+"), { timeout: 20_000 });
  });

  test("escape still closes after dragging the book", async ({ page }) => {
    await openShelf(page);
    await openBook(page);
    await page.waitForTimeout(1200);
    const box = await page.locator(`${shelf} canvas`).boundingBox();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 120, y, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("shift tab stays in the dialog after clicking the book", async ({ page }) => {
    await openShelf(page);
    const dialog = await openBook(page);
    const box = await page.locator(`${shelf} canvas`).boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  });

  test("keyboard focus survives reaching the end of the shelf", async ({ page }) => {
    await openShelf(page);
    const count = await page.locator(`${shelf} a[data-shelf-index]`).count();
    await page.getByRole("button", { name: `เล่ม ${count - 1} จาก`, exact: false }).click();
    const next = page.getByRole("button", { name: "เล่มถัดไป" });
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(shelf)).toHaveAttribute("data-shelf-index", String(count - 1));
    await expect(next).toBeFocused();
    await expect(next).toBeDisabled();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(shelf)).toHaveAttribute("data-shelf-index", String(count - 2));
  });

  test("the shelf fills the first screen", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openShelf(page);
    const box = await page.locator(shelf).boundingBox();
    expect(box!.height).toBeGreaterThan(900 * 0.75);
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
    const canvas = await page.locator(`${shelf} canvas`).boundingBox();
    expect(canvas!.width).toBe(box!.width);
    expect(canvas!.height).toBeGreaterThan(box!.height - 80);
  });

  test("the canvas spans the screen width on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openShelf(page);
    const canvas = await page.locator(`${shelf} canvas`).boundingBox();
    expect(canvas!.width).toBe(375);
    expect(canvas!.height).toBeGreaterThan(280);
  });

  test("the selected book is named beside the shelf", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const start = await openShelf(page);
    const title = page.getByTestId("shelf-title");
    const label = (index: number) =>
      page.locator(`${shelf} a[data-shelf-index="${index}"]`).getAttribute("aria-label");
    await expect(title).toHaveText((await label(start))!);
    await page.getByRole("button", { name: "เล่มถัดไป" }).click();
    await expect(title).toHaveText((await label(start + 1))!);
  });

  test("hero keeps search but drops the statistics", async ({ page }) => {
    await page.goto("/th");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('section input[type="search"]').first()).toBeVisible();
    await expect(page.locator("section dl")).toHaveCount(0);
  });
});
