import { test, expect } from '@playwright/test';

test('Verify Google homepage logo is present', async ({ page }) => {
  // Navigate to Google
  await page.goto('https://www.google.com');

  // Verify the Google logo is visible
  const logo = page.getByRole('img', { name: 'Google' });
  await expect(logo).toBeVisible();
});