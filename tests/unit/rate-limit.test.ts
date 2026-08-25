import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkRateLimit} from '../../lib/rate-limit';

test('checkRateLimit allows requests up to the bucket capacity', () => {
  const route = `test-route-${Math.random()}`;
  for (let i = 0; i < 20; i++) {
    const result = checkRateLimit(route, 'learner-a');
    assert.equal(result.allowed, true, `request ${i + 1} should be allowed`);
  }
});

test('checkRateLimit denies once the bucket is exhausted', () => {
  const route = `test-route-${Math.random()}`;
  for (let i = 0; i < 20; i++) {
    checkRateLimit(route, 'learner-b');
  }
  const result = checkRateLimit(route, 'learner-b');
  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterSeconds > 0);
});

test('checkRateLimit keys are independent — one learner exhausting their bucket does not affect another', () => {
  const route = `test-route-${Math.random()}`;
  for (let i = 0; i < 20; i++) {
    checkRateLimit(route, 'learner-c');
  }
  const exhausted = checkRateLimit(route, 'learner-c');
  const fresh = checkRateLimit(route, 'learner-d');
  assert.equal(exhausted.allowed, false);
  assert.equal(fresh.allowed, true);
});

test('checkRateLimit routes are independent — exhausting one route does not affect another for the same key', () => {
  const routeA = `test-route-a-${Math.random()}`;
  const routeB = `test-route-b-${Math.random()}`;
  for (let i = 0; i < 20; i++) {
    checkRateLimit(routeA, 'learner-e');
  }
  const exhausted = checkRateLimit(routeA, 'learner-e');
  const otherRoute = checkRateLimit(routeB, 'learner-e');
  assert.equal(exhausted.allowed, false);
  assert.equal(otherRoute.allowed, true);
});
