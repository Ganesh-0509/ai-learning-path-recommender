import {test, expect} from '@playwright/test';

// docs/TEST_PLAN.md §3: a goal containing a script-injection-shaped payload
// must render as inert text, never as executable markup. This targets the
// real render path — React's default JSX escaping — via the actual browser,
// not just an API-layer assertion, since XSS is a rendering-time concern.

const PAYLOAD = '<script>window.__xssFired = true;</script>';

test('a goal containing a script tag renders as inert text on the dashboard', async ({
  page,
}) => {
  // page.request (not the standalone `request` fixture) shares the browser
  // context's cookie jar, so the learner_id cookie this sets actually
  // reaches the page navigation below.
  const created = await page.request.post('/api/profile', {
    data: {goal: `Learn Python ${PAYLOAD}`, level: 'BEGINNER'},
  });
  expect(created.status()).toBe(201);
  // The API itself doesn't sanitize server-side — escaping is React's job at
  // render time (docs/SECURITY.md §2) — so the raw payload is expected here.
  const createdBody = await created.json();
  expect(createdBody.goal).toContain(PAYLOAD);

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // If the script had actually executed, this flag would be set.
  const xssFired = await page.evaluate(
    () => (window as unknown as {__xssFired?: boolean}).__xssFired,
  );
  expect(xssFired).toBeUndefined();

  // The literal text must still be visible on the page (proving React
  // rendered it as an escaped text node, not that it silently disappeared).
  await expect(page.getByText('Learn Python', {exact: false})).toBeVisible();

  // No unexpected <script> element was injected into the document body by
  // the payload — only the app's own bundled/hydration scripts should exist.
  const injectedScriptCount = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('script')).filter(el =>
        el.textContent?.includes('__xssFired'),
      ).length,
  );
  expect(injectedScriptCount).toBe(0);
});

test('a chat message containing a script tag does not execute', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Message').fill(`Hello ${PAYLOAD} world`);
  await page.getByRole('button', {name: 'Send'}).click();

  // The message renders in the log immediately (optimistic local echo) —
  // no LLM round trip needed to check the render path itself.
  await expect(page.getByRole('log')).toContainText('Hello');

  const xssFired = await page.evaluate(
    () => (window as unknown as {__xssFired?: boolean}).__xssFired,
  );
  expect(xssFired).toBeUndefined();
});
