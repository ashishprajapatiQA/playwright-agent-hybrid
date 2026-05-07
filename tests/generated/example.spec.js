import { test, expect } from "@playwright/test";

// EXAMPLE generated test — delete once you create your own.
test("example.com loads with correct heading", async ({ page }) => {
  await page.goto("https://example.com");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Example Domain");
});
