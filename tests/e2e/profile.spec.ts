import {test, expect} from '@playwright/test';

// SRS FR-2: learner profiling engine. Tested at the API layer (Playwright's
// request context keeps a cookie jar per test, matching the session-cookie
// identification in lib/session.ts) — see docs/TEST_PLAN.md §1.

test.describe('profile API', () => {
  test('GET with no cookie returns 404', async ({request}) => {
    const response = await request.get('/api/profile');
    expect(response.status()).toBe(404);
  });

  test('POST rejects invalid input with 400', async ({request}) => {
    const response = await request.post('/api/profile', {
      data: {level: 'NOT_A_REAL_LEVEL'},
    });
    expect(response.status()).toBe(400);
  });

  test('POST creates a profile, GET then returns it', async ({request}) => {
    const created = await request.post('/api/profile', {
      data: {
        interests: ['machine learning', 'web development'],
        level: 'BEGINNER',
        goal: 'Become a backend developer',
      },
    });
    expect(created.status()).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.interests).toEqual([
      'machine learning',
      'web development',
    ]);
    expect(createdBody.goal).toBe('Become a backend developer');

    const fetched = await request.get('/api/profile');
    expect(fetched.status()).toBe(200);
    const fetchedBody = await fetched.json();
    expect(fetchedBody.id).toBe(createdBody.id);
    expect(fetchedBody.goal).toBe('Become a backend developer');
  });

  test('POST again updates the same profile instead of creating a new one', async ({
    request,
  }) => {
    const first = await request.post('/api/profile', {
      data: {goal: 'Learn Python'},
    });
    const firstBody = await first.json();

    const second = await request.post('/api/profile', {
      data: {goal: 'Learn advanced Python'},
    });
    expect(second.status()).toBe(200); // update, not 201 create
    const secondBody = await second.json();
    expect(secondBody.id).toBe(firstBody.id);
    expect(secondBody.goal).toBe('Learn advanced Python');
  });
});
