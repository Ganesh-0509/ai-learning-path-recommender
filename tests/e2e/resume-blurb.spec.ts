import {test, expect} from '@playwright/test';

// Resume/portfolio blurb — RAG-grounded, same pattern as /api/explain (real
// local-LLM call, so slower than the pure-logic specs).

test.describe('resume blurb API', () => {
  test('returns 404 with no profile', async ({request}) => {
    const response = await request.post('/api/resume-blurb');
    expect(response.status()).toBe(404);
  });

  test('returns 400 when nothing is completed yet', async ({request}) => {
    await request.post('/api/profile', {
      data: {goal: 'I want to learn Python from scratch', level: 'BEGINNER'},
    });
    const response = await request.post('/api/resume-blurb');
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(typeof body.error).toBe('string');
  });

  test('generates a grounded summary once an item is complete', async ({
    request,
  }) => {
    // Real local-LLM latency has been observed up to ~35s under load (see
    // tests/stress) — occasionally exceeding Playwright's default 30s
    // per-test timeout is expected variance, not a bug.
    test.setTimeout(90_000);
    await request.post('/api/profile', {
      data: {goal: 'I want to learn Python from scratch', level: 'BEGINNER'},
    });
    const recommendResponse = await request.get('/api/recommend?limit=1');
    const {recommendations} = await recommendResponse.json();
    expect(recommendations.length).toBeGreaterThan(0);

    await request.post('/api/progress', {
      data: {courseId: recommendations[0].id, status: 'COMPLETE'},
    });

    const response = await request.post('/api/resume-blurb');
    expect(response.status()).toBe(200);
    // Streamed as plain text, matching /api/explain's convention.
    expect(response.headers()['content-type']).toContain('text/plain');
    const blurb = await response.text();
    expect(blurb.length).toBeGreaterThan(0);
  });
});
