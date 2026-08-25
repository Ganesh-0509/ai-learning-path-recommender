import {test, expect} from '@playwright/test';

// SRS FR-1/FR-2: the actual chat UI, not just the API — a learner states a
// goal in natural language and the profile gets created from extracted
// intent. This one exercises the real local LLM (lib/intent.ts via
// /api/chat), so it's slower than the API-layer specs.

test('a learner can state a goal through chat and reach the dashboard', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('log')).toContainText(
    "Tell me what you're trying to learn",
  );

  const input = page.getByLabel('Message');
  await input.fill('I want to become a backend developer using Node.js');
  await page.getByRole('button', {name: 'Send'}).click();

  // The assistant's reply is the second bubble in the log, appended after a
  // real (slow) local-LLM round trip.
  await expect(page.getByRole('log').locator('div').nth(1)).not.toBeEmpty({
    timeout: 90_000,
  });

  const dashboardLink = page.getByRole('link', {
    name: /view your learning path/i,
  });
  await expect(dashboardLink).toBeVisible({timeout: 5_000});
  await dashboardLink.click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole('heading', {name: 'Your Learning Path'}),
  ).toBeVisible();
});
