import {NextResponse, type NextRequest} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {getLearnerIdFromRequest} from '@/lib/session';
import {checkRateLimit, getRateLimitKey} from '@/lib/rate-limit';

// SRS FR-6.5: mark a course complete / give feedback. This is the write side
// of the feedback loop — FR-4.4 (path regeneration) happens naturally on the
// next GET /api/path, since it always re-reads current Progress rows rather
// than caching a stale path.

const progressInputSchema = z.object({
  courseId: z.string().min(1),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE']).optional(),
  feedback: z.enum(['TOO_EASY', 'TOO_HARD', 'SKIP']).optional(),
});

export async function POST(request: NextRequest) {
  const learnerId = getLearnerIdFromRequest(request);
  if (!learnerId) {
    return NextResponse.json({error: 'No profile yet.'}, {status: 404});
  }

  const rateLimit = checkRateLimit(
    'progress',
    getRateLimitKey(request, learnerId),
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {error: 'Too many requests. Please slow down.'},
      {
        status: 429,
        headers: {'Retry-After': String(rateLimit.retryAfterSeconds)},
      },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = progressInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "That update couldn't be saved — please try again.",
        details: parsed.error.flatten(),
      },
      {status: 400},
    );
  }
  const {courseId, status, feedback} = parsed.data;

  const course = await db.course.findUnique({where: {id: courseId}});
  if (!course) {
    return NextResponse.json(
      {error: "That item couldn't be found — try refreshing the page."},
      {status: 404},
    );
  }

  const progress = await db.progress.upsert({
    where: {learnerId_courseId: {learnerId, courseId}},
    create: {
      learnerId,
      courseId,
      status: status ?? 'IN_PROGRESS',
      feedback,
    },
    update: {
      ...(status !== undefined && {status}),
      ...(feedback !== undefined && {feedback}),
    },
  });

  return NextResponse.json({
    courseId: progress.courseId,
    status: progress.status,
    feedback: progress.feedback,
  });
}
