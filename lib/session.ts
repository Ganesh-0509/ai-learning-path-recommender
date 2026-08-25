import type {NextRequest, NextResponse} from 'next/server';

/**
 * Single-session learner identification via an httpOnly cookie — no
 * multi-tenant auth in this submission's scope (docs/PRD.md §5, docs/SRS.md
 * FR-2.3). Kept as a tiny dedicated module so every route resolves "the
 * current learner" the same way.
 */

export const LEARNER_COOKIE = 'learner_id';

export function getLearnerIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get(LEARNER_COOKIE)?.value ?? null;
}

export function setLearnerIdCookie(
  response: NextResponse,
  learnerId: string,
): void {
  response.cookies.set(LEARNER_COOKIE, learnerId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // 180 days — long enough that a returning learner keeps their progress,
    // short enough not to be a permanent identifier.
    maxAge: 60 * 60 * 24 * 180,
  });
}
