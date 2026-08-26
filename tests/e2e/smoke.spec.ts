import {test, expect} from '@playwright/test';

// A basic smoke check that the app boots and the Playwright harness itself
// is wired up correctly, independent of the fuller flows covered elsewhere.
test('home page responds', async ({page}) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
});
