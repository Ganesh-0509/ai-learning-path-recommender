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
    const body = await response.json();
    expect(typeof body.explanation).toBe('string');
    expect(body.explanation.length).toBeGreaterThan(0);
  });
});

test.describe('chat Q&A grounded in the current path', () => {
  test('a question about the path does not invent an off-list course', async ({
    request,
  }) => {
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
    const chatBody = await chatResponse.json();
    expect(typeof chatBody.reply).toBe('string');
    expect(chatBody.reply.length).toBeGreaterThan(0);
    // Grounding contract: for a web-dev goal, the answer must not claim an
    // unrelated-domain course (e.g. blockchain) is part of the path.
    expect(chatBody.reply).not.toMatch(/blockchain|solidity/i);
  });
});
