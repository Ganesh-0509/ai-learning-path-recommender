import {test, expect, type Page} from '@playwright/test';

// SRS FR-1/FR-2: the actual chat UI, not just the API — a learner states a
// goal in natural language and the profile gets created from extracted
// intent. This one exercises the real local LLM (lib/intent.ts via
// /api/chat), so it's slower than the API-layer specs, and the model's
// response is genuinely non-deterministic turn-to-turn.

async function sendAndWaitForReply(page: Page, message: string) {
  await page.getByLabel('Message').fill(message);
  await page.getByRole('button', {name: 'Send'}).click();
  // "Thinking…" shows while the real (slow) local-LLM round trip is in
  // flight; wait for it to clear rather than asserting on bubble count/index,
  // which would race ahead and match the user's own echoed message instead.
  await expect(page.getByText('Thinking…')).toBeVisible();
  await expect(page.getByText('Thinking…')).toBeHidden({timeout: 90_000});
}

test('a learner can state a goal through chat and reach the dashboard', async ({
  page,
}) => {
  // Up to two real local-LLM round trips (initial goal + a possible
  // clarifying answer), each observed up to ~35s under load (see
  // tests/stress) — Playwright's default 30s per-test timeout covers only
  // one such trip, so this needs headroom for both.
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.getByRole('log')).toContainText(
    "Tell me what you're trying to learn",
  );

  await sendAndWaitForReply(
    page,
    'I want to become a backend developer using Node.js',
  );

  const dashboardLink = page.getByRole('link', {
    name: /view your learning path/i,
  });

  // FR-1.3: the assistant may reasonably ask one clarifying question before
  // it has enough to set a goal — if so, answer it and expect the path to
  // unblock on the next turn, rather than assuming the goal lands in one shot.
  if (!(await dashboardLink.isVisible())) {
    await sendAndWaitForReply(
      page,
      "I'm a complete beginner with some general programming knowledge.",
    );
  }

  await expect(dashboardLink).toBeVisible({timeout: 5_000});
  await dashboardLink.click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole('heading', {name: 'Your Learning Path'}),
  ).toBeVisible();
});
