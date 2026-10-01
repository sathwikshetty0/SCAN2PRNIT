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
    await expect(page.getByRole('img')).toBeVisible();
  });

  test('Admin dashboard fits a laptop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.route('**/api/admin/login', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    }));
    await page.route('**/api/admin/session', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    }));
    await page.route('**/api/admin/jobs', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        jobs: [],
        printerStatus: null,
        paperInventory: { remaining_sheets: 100 },
        stats: {
          totalRevenue: 0,
          todayRevenue: 0,
          totalJobs: 0,
          todayJobs: 0,
          totalPages: 0,
          failedJobs: 0,
          printingJobs: 0,
        },
        kioskPaused: false,
      }),
    }));

    await page.goto('/admin');
    await page.getByPlaceholder('Enter PIN').fill('1234');
    await page.getByRole('button', { name: 'Unlock Dashboard' }).click();
    await expect(page.getByText('Admin Dashboard')).toBeVisible();
    await expect(page.getByText('Paper in tray')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1366);
  });
});
