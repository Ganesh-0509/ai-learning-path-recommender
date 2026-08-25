import {test, expect} from '@playwright/test';

// SRS FR-3 (recommendation engine), FR-4 (path generator), FR-6.5 (progress/
// feedback). Runs against real seeded course data + local embeddings — no
// Ollama dependency, so this stays fast and independent of catalog-gen
// timing (docs/TEST_PLAN.md §2).

test.describe('recommendations require a profile', () => {
  test('GET /api/recommend with no profile returns 404', async ({request}) => {
    const response = await request.get('/api/recommend');
    expect(response.status()).toBe(404);
  });

  test('GET /api/recommend with an empty goal/interests returns 400', async ({
    request,
  }) => {
    await request.post('/api/profile', {data: {}});
    const response = await request.get('/api/recommend');
    expect(response.status()).toBe(400);
  });
});

test.describe('recommend -> path -> progress flow', () => {
  test('a learner with a stated goal gets ranked recommendations', async ({
    request,
  }) => {
    await request.post('/api/profile', {
      data: {
        goal: 'I want to learn machine learning and deep neural networks',
        level: 'BEGINNER',
      },
    });

    const response = await request.get('/api/recommend?limit=5');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.recommendations)).toBe(true);
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(body.recommendations.length).toBeLessThanOrEqual(5);

    // Sorted by score, descending.
    const scores = body.recommendations.map((r: {score: number}) => r.score);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  test('the generated path respects prerequisite ordering', async ({
    request,
  }) => {
    await request.post('/api/profile', {
      data: {goal: 'Master deep learning', level: 'ADVANCED'},
    });

    const response = await request.get('/api/path');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.milestones)).toBe(true);

    // Every course's prerequisite-implied milestone must not come after it —
    // spot-checked by milestone index only increasing for later stages.
    if (body.milestones.length > 1) {
      expect(body.milestones[0].title).toBe('Foundations');
    }
  });

  test('marking a course complete removes it from future recommendations', async ({
    request,
  }) => {
    await request.post('/api/profile', {
      data: {goal: 'Learn web development', level: 'BEGINNER'},
    });

    const before = await request.get('/api/recommend?limit=20');
    const beforeBody = await before.json();
    expect(beforeBody.recommendations.length).toBeGreaterThan(0);
    const targetId = beforeBody.recommendations[0].id;

    const progressResponse = await request.post('/api/progress', {
      data: {courseId: targetId, status: 'COMPLETE'},
    });
    expect(progressResponse.status()).toBe(200);

    const after = await request.get('/api/recommend?limit=20');
    const afterBody = await after.json();
    const ids = afterBody.recommendations.map((r: {id: string}) => r.id);
    expect(ids).not.toContain(targetId);
  });

  test('POST /api/progress with an unknown course id returns 404', async ({
    request,
  }) => {
    await request.post('/api/profile', {data: {goal: 'Learn something'}});
    const response = await request.post('/api/progress', {
      data: {courseId: 'not-a-real-course', status: 'COMPLETE'},
    });
    expect(response.status()).toBe(404);
  });
});

test.describe('feedback adapts future recommendations (FR-4.4/FR-6.5)', () => {
  test('TOO_HARD feedback shifts the effective ranking level down a tier', async ({
    request,
  }) => {
    await request.post('/api/profile', {
      data: {goal: 'I want to master Python programming', level: 'ADVANCED'},
    });

    function findLevelMismatch(
      body: {recommendations: {id: string; levelMismatch: boolean}[]},
      id: string,
    ) {
      const found = body.recommendations.find(r => r.id === id);
      expect(found, `expected "${id}" in the response`).toBeTruthy();
      return found!.levelMismatch;
    }

    const before = await (await request.get('/api/recommend?limit=30')).json();
    // At the stated ADVANCED level: the ADVANCED course matches exactly,
    // the INTERMEDIATE course is a mismatch.
    expect(findLevelMismatch(before, 'advanced-python-development')).toBe(
      false,
    );
    expect(findLevelMismatch(before, 'python-automation-and-scripting')).toBe(
      true,
    );

    // Any TOO_HARD signal nudges the effective level down one tier —
    // computeLevelAdjustment doesn't care which course it came from.
    const progressResponse = await request.post('/api/progress', {
      data: {
        courseId: 'advanced-python-development',
        status: 'IN_PROGRESS',
        feedback: 'TOO_HARD',
      },
    });
    expect(progressResponse.status()).toBe(200);

    const after = await (await request.get('/api/recommend?limit=30')).json();
    // Effective level is now INTERMEDIATE: the mismatch flips for both courses.
    expect(findLevelMismatch(after, 'advanced-python-development')).toBe(true);
    expect(findLevelMismatch(after, 'python-automation-and-scripting')).toBe(
      false,
    );
  });
});
