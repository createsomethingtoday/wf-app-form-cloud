import { expect, test } from '@playwright/test';

test.describe('marketplace form smoke', () => {
  test('health endpoint reports D1 + R2 ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status(), 'health endpoint status').toBe(200);
    const body = await response.json();
    expect(body.d1).toBe('ok');
    expect(body.r2).toBe('ok');
  });

  test('form page renders progress rail', async ({ page }) => {
    await page.goto('/complete-form');
    // The progress rail shows a percent-complete label and pills per section.
    // If any of these are missing something is very broken.
    await expect(page.getByText(/complete/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /app info/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /review/i })).toBeVisible();
  });

  test('submit type selector is present and selectable', async ({ page }) => {
    await page.goto('/complete-form');
    const select = page.locator('#Submission-Type');
    await expect(select).toBeVisible();
    await select.selectOption('New');
    // Selecting 'New' should not surface the App Update notice.
    await expect(page.getByText(/app update mode/i)).not.toBeVisible();
  });
});

test.describe('full submission (staging only)', () => {
  test.skip(
    process.env.E2E_ALLOW_SUBMIT !== '1',
    'E2E_ALLOW_SUBMIT=1 required — this test creates a real submission. Only run against staging.',
  );

  test('New submission flows through to success state', async ({ page }) => {
    await page.goto('/complete-form');
    await page.locator('#submission-type').selectOption('New');

    await page.fill('#app-name', `E2E Test ${Date.now()}`);
    // Remaining required fields would be filled here in a real staging run.
    // Intentionally left as a sketch until staging exists — so this test is
    // easy to extend later without landing broken assertions in the meantime.

    // Sentinel: if we ever reach this without the skip above, fail loudly
    // rather than silently filing incomplete submissions.
    throw new Error(
      'Full submission test is a sketch. Flesh out field fills before relying on it.',
    );
  });
});
