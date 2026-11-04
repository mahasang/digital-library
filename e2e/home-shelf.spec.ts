import { test, expect } from "@playwright/test";

const shelf = '[data-testid="hero-shelf"]';

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
});
