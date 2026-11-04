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
});
