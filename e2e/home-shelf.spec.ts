import { test, expect, type Page } from "@playwright/test";

const shelf = '[data-testid="hero-shelf"]';

async function openShelf(page: Page): Promise<number> {
  await page.goto("/th");
  await expect(page.locator(shelf)).toHaveAttribute("data-shelf-mode", "3d", { timeout: 20_000 });
  return currentIndex(page);
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
});
