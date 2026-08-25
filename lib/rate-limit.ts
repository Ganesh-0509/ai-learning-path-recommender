import type {NextRequest} from 'next/server';

/**
 * In-memory token-bucket rate limiter — docs/SECURITY.md §2 "resource
 * exhaustion." Explicitly a single-instance limitation, not a production
 * DDoS defense (state resets on redeploy/restart, and doesn't share across
 * instances) — appropriate for this hackathon-scoped deploy, not claimed to
 * be more than that.
 *
 * Keyed by learner id when available, falling back to client IP for
 * requests before a profile exists (the first chat message). Per-learner
 * keying means concurrent *different* learners never contend for the same
 * bucket — only a single actor hammering the same route does.
 */

const CAPACITY = 20;
const REFILL_INTERVAL_MS = 60_000;
const REFILL_AMOUNT = 20;

type Bucket = {tokens: number; lastRefill: number};

const buckets = new Map<string, Bucket>();

export function getRateLimitKey(
  request: NextRequest,
  learnerId: string | null,
): string {
  if (learnerId) return learnerId;
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() ?? 'unknown';
  return `ip:${ip}`;
}

export function checkRateLimit(
  route: string,
  key: string,
): {allowed: boolean; retryAfterSeconds: number} {
  const bucketKey = `${route}:${key}`;
  const now = Date.now();
  const existing = buckets.get(bucketKey);

  if (!existing) {
    buckets.set(bucketKey, {tokens: CAPACITY - 1, lastRefill: now});
    return {allowed: true, retryAfterSeconds: 0};
  }

  const elapsed = now - existing.lastRefill;
  const refilled = Math.min(
    CAPACITY,
    existing.tokens + (elapsed / REFILL_INTERVAL_MS) * REFILL_AMOUNT,
  );

  if (refilled >= 1) {
    buckets.set(bucketKey, {tokens: refilled - 1, lastRefill: now});
    return {allowed: true, retryAfterSeconds: 0};
  }

  const tokensNeeded = 1 - refilled;
  const retryAfterSeconds = Math.ceil(
    (tokensNeeded / REFILL_AMOUNT) * (REFILL_INTERVAL_MS / 1000),
  );
  buckets.set(bucketKey, {tokens: refilled, lastRefill: now});
  return {allowed: false, retryAfterSeconds};
}
