import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankCourses, computeLevelAdjustment} from '../../lib/recommend';
import type {CourseLike} from '../../lib/types';

function course(
  id: string,
  embedding: number[],
  level: CourseLike['level'] = 'BEGINNER',
  type: CourseLike['type'] = 'COURSE',
): CourseLike {
  return {id, title: id, level, prerequisites: [], embedding, type};
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

test('rankCourses lets a strongly relevant, one-tier-off course outrank a barely relevant, level-matched one', () => {
  // Regression test: a flat additive penalty could bury a highly relevant
  // mismatched item under a barely relevant matched one (observed with a
  // real "machine learning" goal outranking "Machine Learning Fundamentals"
  // — one tier off — below an unrelated same-level course). The penalty
  // must scale with the item's own similarity, not be a fixed subtraction.
  const learner = {goalEmbedding: [1, 0], level: 'BEGINNER' as const};
  const courses = [
    course('weak-match', [0.305, 0], 'BEGINNER'),
    course('strong-mismatch', [0.454, 0], 'INTERMEDIATE'),
  ];
  const ranked = rankCourses(learner, courses, new Set());
  assert.equal(ranked[0].course.id, 'strong-mismatch');
  assert.equal(ranked[1].course.id, 'weak-match');
});

test('rankCourses applies a levelAdjustment on top of the stated level', () => {
  const courses = [
    course('beginner', [1, 0], 'BEGINNER'),
    course('intermediate', [1, 0], 'INTERMEDIATE'),
  ];
  // Stated BEGINNER, but adjusted up one tier by positive feedback signal —
  // the INTERMEDIATE course should now be the unpenalized match.
  const adjusted = rankCourses(
    {goalEmbedding: [1, 0], level: 'BEGINNER', levelAdjustment: 1},
    courses,
    new Set(),
  );
  assert.equal(adjusted[0].course.id, 'intermediate');
  assert.equal(adjusted[0].levelMismatch, false);
});

test('rankCourses clamps levelAdjustment to a valid rank', () => {
  const courses = [course('beginner', [1, 0], 'BEGINNER')];
  // ADVANCED (rank 2) + 1 would overflow past the top rank — must clamp, not throw.
  const ranked = rankCourses(
    {goalEmbedding: [1, 0], level: 'ADVANCED', levelAdjustment: 1},
    courses,
    new Set(),
  );
  assert.equal(ranked[0].levelMismatch, true);
});

test('rankCourses applies a contentPreference bonus without excluding other types', () => {
  const courses = [
    course('a-course', [1, 0], 'BEGINNER', 'COURSE'),
    course('a-project', [1, 0], 'BEGINNER', 'PROJECT'),
  ];
  // Identical similarity and level — the project should outrank the course
  // once the learner prefers projects, but the course must still appear.
  const preferred = rankCourses(
    {goalEmbedding: [1, 0], level: 'BEGINNER', contentPreference: 'PROJECT'},
    courses,
    new Set(),
  );
  assert.equal(preferred[0].course.id, 'a-project');
  assert.equal(preferred.length, 2);
  assert.ok(preferred[0].score > preferred[1].score);
});

test('rankCourses ignores contentPreference when not set (balanced, no bias)', () => {
  const courses = [
    course('a-course', [1, 0], 'BEGINNER', 'COURSE'),
    course('a-project', [1, 0], 'BEGINNER', 'PROJECT'),
  ];
  const balanced = rankCourses(
    {goalEmbedding: [1, 0], level: 'BEGINNER'},
    courses,
    new Set(),
  );
  assert.equal(balanced[0].score, balanced[1].score);
});

test('computeLevelAdjustment: more TOO_HARD than TOO_EASY nudges down a tier', () => {
  assert.equal(computeLevelAdjustment({tooEasy: 0, tooHard: 1}), -1);
  assert.equal(computeLevelAdjustment({tooEasy: 1, tooHard: 3}), -1);
});

test('computeLevelAdjustment: more TOO_EASY than TOO_HARD nudges up a tier', () => {
  assert.equal(computeLevelAdjustment({tooEasy: 1, tooHard: 0}), 1);
  assert.equal(computeLevelAdjustment({tooEasy: 3, tooHard: 1}), 1);
});

test('computeLevelAdjustment: a tie or no feedback makes no adjustment', () => {
  assert.equal(computeLevelAdjustment({tooEasy: 0, tooHard: 0}), 0);
  assert.equal(computeLevelAdjustment({tooEasy: 2, tooHard: 2}), 0);
});
