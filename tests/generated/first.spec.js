import { test, expect } from '@playwright/test';

test('navigate to example.com and verify heading', async ({ page }) => {
  await page.goto('https://www.example.com');
  await expect(page.getByRole('heading', { name: 'Example Domain' })).toBeVisible();
});