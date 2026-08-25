import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankCourses} from '../../lib/recommend';
import type {CourseLike} from '../../lib/types';

function course(
  id: string,
  embedding: number[],
  level: CourseLike['level'] = 'BEGINNER',
): CourseLike {
  return {id, title: id, level, prerequisites: [], embedding};
}

test('rankCourses sorts by similarity to the goal embedding, closest first', () => {
  const learner = {goalEmbedding: [1, 0], level: 'BEGINNER' as const};
  const courses = [course('far', [0, 1]), course('close', [1, 0])];
  const ranked = rankCourses(learner, courses, new Set());
  assert.deepEqual(
    ranked.map(r => r.course.id),
    ['close', 'far'],
  );
});

test('rankCourses excludes completed courses entirely', () => {
  const learner = {goalEmbedding: [1, 0], level: 'BEGINNER' as const};
  const courses = [course('done', [1, 0]), course('todo', [0.9, 0.1])];
  const ranked = rankCourses(learner, courses, new Set(['done']));
  assert.deepEqual(
    ranked.map(r => r.course.id),
    ['todo'],
  );
});

test('rankCourses penalizes but does not exclude a level mismatch', () => {
  const learner = {goalEmbedding: [1, 0], level: 'BEGINNER' as const};
  const courses = [
    course('same-level', [1, 0], 'BEGINNER'),
    course('advanced', [1, 0], 'ADVANCED'),
  ];
  const ranked = rankCourses(learner, courses, new Set());
  // Identical similarity, but the mismatched-level course should rank lower and be flagged.
  assert.equal(ranked[0].course.id, 'same-level');
  assert.equal(ranked[0].levelMismatch, false);
  assert.equal(ranked[1].course.id, 'advanced');
  assert.equal(ranked[1].levelMismatch, true);
  assert.ok(ranked[1].score < ranked[0].score);
});
