import {test, expect, request as playwrightRequest} from '@playwright/test';

// docs/TEST_PLAN.md §4: N concurrent simulated learners hitting
// recommend/progress endpoints — correctness under load, not just a single
// serial user. Each simulated learner gets its own APIRequestContext (its
// own cookie jar), which is what actually makes them "concurrent different
// learners" rather than one client racing itself.

const LEARNER_COUNT = 20;

type Learner = {
  id: number;
  ctx: Awaited<ReturnType<typeof playwrightRequest.newContext>>;
  goal: string;
};

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index];
}

test('N concurrent learners get correct, isolated recommendations and progress', async ({
  baseURL,
}) => {
  const learners: Learner[] = await Promise.all(
    Array.from({length: LEARNER_COUNT}, async (_, id) => ({
      id,
      ctx: await playwrightRequest.newContext({baseURL}),
      // Distinct goals so each learner's recommendations are meaningfully
      // different, not just isolated-by-accident.
      goal:
        id % 2 === 0
          ? 'I want to learn machine learning and deep neural networks'
          : 'I want to learn web development with React and Node.js',
    })),
  );

  try {
    // Create all profiles concurrently.
    await Promise.all(
      learners.map(learner =>
        learner.ctx.post('/api/profile', {
          data: {goal: learner.goal, level: 'BEGINNER'},
        }),
      ),
    );

    // Concurrent recommend calls — this is the load-bearing part of the
    // test: every learner's own cookie must route to their own profile.
    const recommendLatencies: number[] = [];
    const recommendResults = await Promise.all(
      learners.map(async learner => {
        const start = Date.now();
        const response = await learner.ctx.get('/api/recommend?limit=10');
        recommendLatencies.push(Date.now() - start);
        expect(response.status(), `learner ${learner.id}`).toBe(200);
        return {learner, body: await response.json()};
      }),
    );

    // Correctness under load: a machine-learning learner's top recommendation
    // must not be a web-dev-flavored course and vice versa — proves no
    // cross-learner state bleed, not just that every call returned 200.
    for (const {learner, body} of recommendResults) {
      expect(body.recommendations.length).toBeGreaterThan(0);
      const topTitles = body.recommendations
        .slice(0, 3)
        .map((r: {title: string}) => r.title.toLowerCase());
      if (learner.id % 2 === 0) {
        expect(topTitles.some((t: string) => /react|vue|html/.test(t))).toBe(
          false,
        );
      } else {
        expect(
          topTitles.some((t: string) =>
            /neural|deep learning|machine learning/.test(t),
          ),
        ).toBe(false);
      }
    }

    // Concurrent progress writes — different learners marking different
    // courses complete simultaneously must not corrupt each other's state.
    await Promise.all(
      recommendResults.map(({learner, body}) =>
        learner.ctx.post('/api/progress', {
          data: {courseId: body.recommendations[0].id, status: 'COMPLETE'},
        }),
      ),
    );

    const afterResults = await Promise.all(
      recommendResults.map(async ({learner, body}) => {
        const response = await learner.ctx.get('/api/recommend?limit=10');
        const after = await response.json();
        return {learner, completedId: body.recommendations[0].id, after};
      }),
    );

    for (const {learner, completedId, after} of afterResults) {
      const ids = after.recommendations.map((r: {id: string}) => r.id);
      expect(
        ids,
        `learner ${learner.id}'s completed course should no longer be recommended`,
      ).not.toContain(completedId);
    }

    recommendLatencies.sort((a, b) => a - b);
    console.log(
      `[stress] /api/recommend under ${LEARNER_COUNT} concurrent learners: ` +
        `p50=${percentile(recommendLatencies, 0.5)}ms ` +
        `p95=${percentile(recommendLatencies, 0.95)}ms ` +
        `max=${recommendLatencies[recommendLatencies.length - 1]}ms`,
    );
  } finally {
    await Promise.all(learners.map(learner => learner.ctx.dispose()));
  }
});
