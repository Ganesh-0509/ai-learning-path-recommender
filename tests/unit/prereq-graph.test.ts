import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  expandWithPrerequisites,
  topologicalSort,
  groupIntoMilestones,
  buildPath,
} from '../../lib/prereq-graph';
import type {CourseLike} from '../../lib/types';

function course(id: string, prerequisites: string[] = []): CourseLike {
  return {id, title: id, level: 'BEGINNER', prerequisites, embedding: []};
}

function toMap(courses: CourseLike[]): Map<string, CourseLike> {
  return new Map(courses.map(c => [c.id, c]));
}

test('expandWithPrerequisites pulls in the full chain', () => {
  const courses = toMap([course('a'), course('b', ['a']), course('c', ['b'])]);
  const expanded = expandWithPrerequisites(['c'], courses);
  assert.deepEqual([...expanded].sort(), ['a', 'b', 'c']);
});

test('expandWithPrerequisites throws on an unknown id', () => {
  const courses = toMap([course('a')]);
  assert.throws(() => expandWithPrerequisites(['missing'], courses));
});

test('topologicalSort orders prerequisites before dependents', () => {
  const courses = toMap([course('a'), course('b', ['a']), course('c', ['b'])]);
  const sorted = topologicalSort(['c', 'b', 'a'], courses);
  assert.deepEqual(sorted, ['a', 'b', 'c']);
});

test('topologicalSort throws on a cycle', () => {
  const courses = toMap([course('a', ['b']), course('b', ['a'])]);
  assert.throws(() => topologicalSort(['a', 'b'], courses));
});

test('topologicalSort ignores prerequisite edges outside the given set', () => {
  const courses = toMap([course('a'), course('b', ['a'])]);
  // 'a' isn't in the requested set — 'b' has no in-set dependency, so it's a root.
  const sorted = topologicalSort(['b'], courses);
  assert.deepEqual(sorted, ['b']);
});

test('groupIntoMilestones buckets by prerequisite-chain depth', () => {
  const courses = toMap([course('a'), course('b', ['a']), course('c', ['b'])]);
  const milestones = groupIntoMilestones(['a', 'b', 'c'], courses);
  assert.deepEqual(
    milestones.map(m => m.courseIds),
    [['a'], ['b'], ['c']],
  );
  assert.deepEqual(
    milestones.map(m => m.title),
    ['Foundations', 'Core Skill', 'Applied Practice'],
  );
});

test('groupIntoMilestones keeps courses at the same depth together', () => {
  const courses = toMap([course('a'), course('b')]);
  const milestones = groupIntoMilestones(['a', 'b'], courses);
  assert.equal(milestones.length, 1);
  assert.deepEqual(milestones[0].courseIds.sort(), ['a', 'b']);
});

test('buildPath runs the full expand -> sort -> group pipeline', () => {
  const courses = toMap([
    course('py-beginner'),
    course('py-intermediate', ['py-beginner']),
    course('py-advanced', ['py-intermediate']),
  ]);
  const milestones = buildPath(['py-advanced'], courses);
  assert.deepEqual(
    milestones.map(m => m.courseIds),
    [['py-beginner'], ['py-intermediate'], ['py-advanced']],
  );
});
