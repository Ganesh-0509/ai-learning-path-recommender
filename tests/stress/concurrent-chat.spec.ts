import {test, expect, request as playwrightRequest} from '@playwright/test';

// docs/TEST_PLAN.md §4: concurrent learners hitting the real local LLM via
// /api/chat. Kept to a small N — Ollama serves one model without real
// request-level parallelism, so this is testing "does concurrent load
// corrupt state or crash the server," not "is the LLM itself parallel."

const LEARNER_COUNT = 5;

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index];
}

test('N concurrent learners chatting simultaneously stay isolated, no crash', async ({
  baseURL,
}) => {
  // Ollama serializes requests to one model — 5 concurrent real-LLM calls
  // can take well over Playwright's default 30s test timeout.
  test.setTimeout(180_000);

  const learners = await Promise.all(
    Array.from({length: LEARNER_COUNT}, async (_, id) => ({
      id,
      ctx: await playwrightRequest.newContext({baseURL}),
      message: `I want to become a ${['backend', 'frontend', 'data', 'mobile', 'cloud'][id]} developer`,
    })),
  );

  try {
    const latencies: number[] = [];
    const results = await Promise.all(
      learners.map(async learner => {
        const start = Date.now();
        const response = await learner.ctx.post('/api/chat', {
          data: {message: learner.message},
          timeout: 90_000,
        });
        latencies.push(Date.now() - start);
        return {
          learner,
          status: response.status(),
          body: await response.json(),
        };
      }),
    );

    for (const {learner, status, body} of results) {
      expect(status, `learner ${learner.id}`).toBe(200);
      expect(typeof body.reply).toBe('string');
      expect(body.reply.length).toBeGreaterThan(0);
    }

    // No cross-learner bleed: each learner's own profile reflects only their
    // own message, not another concurrently-chatting learner's.
    const profiles = await Promise.all(
      learners.map(async learner => {
        const response = await learner.ctx.get('/api/profile');
        return {learner, profile: await response.json()};
      }),
    );
    const goals = profiles.map(p => p.profile.goal);
    expect(
      new Set(goals).size,
      'every learner should have a distinct goal',
    ).toBe(LEARNER_COUNT);

    latencies.sort((a, b) => a - b);
    console.log(
      `[stress] /api/chat under ${LEARNER_COUNT} concurrent learners: ` +
        `p50=${percentile(latencies, 0.5)}ms ` +
        `p95=${percentile(latencies, 0.95)}ms ` +
        `max=${latencies[latencies.length - 1]}ms`,
    );
  } finally {
    await Promise.all(learners.map(learner => learner.ctx.dispose()));
  }
});
