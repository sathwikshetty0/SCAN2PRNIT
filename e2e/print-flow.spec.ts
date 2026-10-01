import { test, expect } from '@playwright/test';

test.describe('A4 Print Kiosk E2E Flow', () => {
  test('Mobile viewport layout (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Verify title and upload zone
    await expect(page.locator('h1')).toContainText('Print Your Document');
    const uploadBtn = page.getByRole('button', { name: 'Select PDF file' });
    await expect(uploadBtn).toBeVisible();

    // Check no horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });

  test('QR Code display page', async ({ page }) => {
    await page.goto('/qr');
    await expect(page.locator('h1')).toContainText('Scan to Print');
    await expect(page.locator('svg')).toBeVisible();
  });
});
