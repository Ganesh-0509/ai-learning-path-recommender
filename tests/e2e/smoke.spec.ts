import {test, expect} from '@playwright/test';

// Placeholder until the real chat/onboarding flow lands (PLAN.md Day 2) — proves
// the app boots and the Playwright harness itself is wired up correctly.
test('home page responds', async ({page}) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
});
