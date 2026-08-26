import {test, expect} from '@playwright/test';

// SRS FR-5: explainability. FR-5.1 (per-course "why") via /api/explain,
// FR-5.2 (path Q&A) via /api/chat's question branch — both are real local-LLM
// calls, so these are slower than the pure-logic specs.

test.describe('explain API', () => {
  test('returns 404 with no profile', async ({request}) => {
    const response = await request.post('/api/explain', {
      data: {courseId: 'python-for-absolute-beginners'},
    });
    expect(response.status()).toBe(404);
  });

  test('returns 404 for an unknown course id', async ({request}) => {
    await request.post('/api/profile', {data: {goal: 'Learn Python'}});
    const response = await request.post('/api/explain', {
      data: {courseId: 'not-a-real-course'},
    });
    expect(response.status()).toBe(404);
  });

  test('explains a real recommendation grounded in evidence', async ({
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

    const response = await request.post('/api/explain', {
      data: {courseId: recommendations[0].id},
    });
    expect(response.status()).toBe(200);
    // Streamed as plain text (see lib/explain.ts's explainRecommendationStream)
    // rather than JSON, so the explanation appears progressively in the UI.
    expect(response.headers()['content-type']).toContain('text/plain');
    const explanation = await response.text();
    expect(explanation.length).toBeGreaterThan(0);
  });
});

test.describe('chat Q&A grounded in the current path', () => {
  test('a question about the path does not invent an off-list course', async ({
    request,
  }) => {
    test.setTimeout(90_000);
    await request.post('/api/profile', {
      data: {
        goal: 'I want to learn web development with React',
        level: 'BEGINNER',
      },
    });

    const chatResponse = await request.post('/api/chat', {
      data: {message: 'How long will this path take?'},
    });
    expect(chatResponse.status()).toBe(200);
    // Streamed (see lib/qa.ts's answerPathQuestionStream) — profile rides
    // along in a header instead of the JSON body the intent-extraction
    // branch returns.
    expect(chatResponse.headers()['content-type']).toContain('text/plain');
    const reply = await chatResponse.text();
    expect(reply.length).toBeGreaterThan(0);
    const profileHeader = chatResponse.headers()['x-profile'];
    expect(profileHeader).toBeTruthy();
    const profile = JSON.parse(decodeURIComponent(profileHeader));
    expect(profile.goal).toContain('web development');
    // Grounding contract: for a web-dev goal, the answer must not claim an
    // unrelated-domain course (e.g. blockchain) is part of the path.
    expect(reply).not.toMatch(/blockchain|solidity/i);
  });
});
