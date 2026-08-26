import {test, expect, request as playwrightRequest} from '@playwright/test';

// docs/TEST_PLAN.md §4: concurrent learners hitting the two streaming
// real-LLM routes — /api/explain (lib/explain.ts's explainRecommendationStream)
// and /api/chat's Q&A branch (lib/qa.ts's answerPathQuestionStream). Both were
// converted from JSON responses to streamed plain text for perceived-latency
// reasons; this exercises that only under concurrency, since
// concurrent-chat.spec.ts only drives the (still-JSON) intent-extraction
// branch and concurrent-recommend-progress.spec.ts never touches the LLM at
// all. Ollama serializes requests to one model, so this is testing "does
// concurrent streamed consumption corrupt state or crash the server," not
// "is the LLM itself parallel."
//
// LEARNER_COUNT is capped at 3, not 5: this spec drives TWO full real-LLM
// round trips per learner (explain, then Q&A) back-to-back, so at 5 it's 10
// total serialized real-LLM calls in one test — empirically this pushed
// queued requests past even a 120s per-call timeout (single local Ollama
// instance, no real parallelism). That's a genuine capacity ceiling of
// single-instance local inference, not a bug worth chasing with ever-larger
// timeouts — see docs/SOLUTION_DOCUMENTATION.md's performance section for
// the documented limit. 3 concurrent learners x 2 calls each stays within
// realistic demo/judging load and completes reliably.

const LEARNER_COUNT = 3;
const GOALS = ['backend', 'frontend', 'data', 'mobile', 'cloud'];

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index];
}

test('N concurrent learners streaming explanations and Q&A stay isolated, no crash', async ({
  baseURL,
}) => {
  // Ollama serializes requests to one model — 5 concurrent real-LLM streamed
  // calls, two per learner, can take well over Playwright's default 30s.
  test.setTimeout(360_000);

  const learners = await Promise.all(
    Array.from({length: LEARNER_COUNT}, async (_, id) => ({
      id,
      ctx: await playwrightRequest.newContext({baseURL}),
      goal: `I want to become a ${GOALS[id]} developer`,
    })),
  );

  try {
    await Promise.all(
      learners.map(learner =>
        learner.ctx.post('/api/profile', {
          data: {goal: learner.goal, level: 'BEGINNER'},
        }),
      ),
    );

    const explainLatencies: number[] = [];
    const explainResults = await Promise.all(
      learners.map(async learner => {
        const recommendResponse = await learner.ctx.get(
          '/api/recommend?limit=1',
        );
        const {recommendations} = await recommendResponse.json();

        const start = Date.now();
        const response = await learner.ctx.post('/api/explain', {
          data: {courseId: recommendations[0].id},
          timeout: 150_000,
        });
        explainLatencies.push(Date.now() - start);
        return {
          learner,
          status: response.status(),
          contentType: response.headers()['content-type'],
          text: await response.text(),
        };
      }),
    );

    for (const {learner, status, contentType, text} of explainResults) {
      expect(status, `explain learner ${learner.id}`).toBe(200);
      expect(contentType, `explain learner ${learner.id}`).toContain(
        'text/plain',
      );
      expect(text.length, `explain learner ${learner.id}`).toBeGreaterThan(0);
    }

    const qaLatencies: number[] = [];
    const qaResults = await Promise.all(
      learners.map(async learner => {
        const start = Date.now();
        const response = await learner.ctx.post('/api/chat', {
          data: {message: 'How long will this path take?'},
          timeout: 150_000,
        });
        qaLatencies.push(Date.now() - start);
        return {
          learner,
          status: response.status(),
          contentType: response.headers()['content-type'],
          text: await response.text(),
          profileHeader: response.headers()['x-profile'],
        };
      }),
    );

    for (const {
      learner,
      status,
      contentType,
      text,
      profileHeader,
    } of qaResults) {
      expect(status, `qa learner ${learner.id}`).toBe(200);
      expect(contentType, `qa learner ${learner.id}`).toContain('text/plain');
      expect(text.length, `qa learner ${learner.id}`).toBeGreaterThan(0);
      expect(profileHeader, `qa learner ${learner.id}`).toBeTruthy();
      const profile = JSON.parse(decodeURIComponent(profileHeader));
      expect(profile.goal, `qa learner ${learner.id}`).toContain(
        GOALS[learner.id],
      );
    }

    // No cross-learner bleed: each learner's streamed Q&A reflects only their
    // own goal, not another concurrently-streaming learner's.
    const goalsSeen = qaResults.map(
      r => JSON.parse(decodeURIComponent(r.profileHeader)).goal,
    );
    expect(
      new Set(goalsSeen).size,
      'every learner should have a distinct goal in their streamed response',
    ).toBe(LEARNER_COUNT);

    explainLatencies.sort((a, b) => a - b);
    qaLatencies.sort((a, b) => a - b);
    console.log(
      `[stress] /api/explain (streamed) under ${LEARNER_COUNT} concurrent learners: ` +
        `p50=${percentile(explainLatencies, 0.5)}ms ` +
        `p95=${percentile(explainLatencies, 0.95)}ms ` +
        `max=${explainLatencies[explainLatencies.length - 1]}ms`,
    );
    console.log(
      `[stress] /api/chat Q&A (streamed) under ${LEARNER_COUNT} concurrent learners: ` +
        `p50=${percentile(qaLatencies, 0.5)}ms ` +
        `p95=${percentile(qaLatencies, 0.95)}ms ` +
        `max=${qaLatencies[qaLatencies.length - 1]}ms`,
    );
  } finally {
    await Promise.all(learners.map(learner => learner.ctx.dispose()));
  }
});
