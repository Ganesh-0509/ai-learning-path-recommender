import {test, expect} from '@playwright/test';

// docs/SUBMISSION_READINESS.md §1a: the brief requires the roadmap to
// include "courses, projects and assessments," not courses alone —
// scripts/generate-project-assessment-catalog.ts adds one PROJECT and one
// ASSESSMENT per category. Unlike the original 80 courses (stable,
// hardcoded slugs other specs rely on), generated item ids depend on
// LLM-chosen titles, so this spec discovers them dynamically rather than
// hardcoding one.
//
// The goal text below is deliberately narrow (IoT is the thinnest category —
// 1 course + 1 project + 1 assessment total) and was confirmed to rank the
// project/assessment within the top 5 (so /api/path, which seeds from the
// top 5, actually includes them) — a broader goal risks the project/
// assessment ranking outside the seed set purely on embedding proximity,
// which would make this spec flaky through no fault of the feature itself.
const IOT_GOAL =
  'I want to learn IoT with Raspberry Pi and smart home automation';

const VALID_TYPES = ['COURSE', 'PROJECT', 'ASSESSMENT'];

test.describe('project/assessment item types', () => {
  test('/api/recommend surfaces valid, non-course types alongside courses', async ({
    request,
  }) => {
    await request.post('/api/profile', {
      data: {goal: IOT_GOAL, level: 'BEGINNER'},
    });
    const response = await request.get('/api/recommend?limit=30');
    expect(response.status()).toBe(200);
    const {recommendations} = await response.json();

    for (const r of recommendations) {
      expect(VALID_TYPES).toContain(r.type);
    }
    expect(
      recommendations.some((r: {type: string}) => r.type === 'PROJECT'),
    ).toBe(true);
    expect(
      recommendations.some((r: {type: string}) => r.type === 'ASSESSMENT'),
    ).toBe(true);
  });

  test('/api/path places a non-course item in the generated milestones', async ({
    request,
  }) => {
    await request.post('/api/profile', {
      data: {goal: IOT_GOAL, level: 'BEGINNER'},
    });
    const response = await request.get('/api/path');
    expect(response.status()).toBe(200);
    const {milestones} = await response.json();

    const allItems = milestones.flatMap(
      (m: {courses: {type: string}[]}) => m.courses,
    );
    for (const item of allItems) {
      expect(VALID_TYPES).toContain(item.type);
    }
    expect(
      allItems.some((item: {type: string}) => item.type !== 'COURSE'),
    ).toBe(true);
  });

  test('/api/explain works for a project/assessment, not just a course', async ({
    request,
  }) => {
    // Real local-LLM latency has been observed up to ~35s under load (see
    // tests/stress) — occasionally exceeding Playwright's default 30s
    // per-test timeout is expected variance, not a bug.
    test.setTimeout(90_000);
    await request.post('/api/profile', {
      data: {goal: IOT_GOAL, level: 'BEGINNER'},
    });
    const recommendResponse = await request.get('/api/recommend?limit=30');
    const {recommendations} = await recommendResponse.json();
    const nonCourse = recommendations.find(
      (r: {type: string}) => r.type !== 'COURSE',
    );
    expect(nonCourse).toBeTruthy();

    const response = await request.post('/api/explain', {
      data: {courseId: nonCourse.id},
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');
    const explanation = await response.text();
    expect(explanation.length).toBeGreaterThan(0);
  });
});
