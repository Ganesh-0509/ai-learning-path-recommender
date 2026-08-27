import {NextResponse, type NextRequest} from 'next/server';
import {db} from '@/lib/db';
import {loadCourseMap, getCompletedCourseIds} from '@/lib/courses';
import {generateResumeBlurbStream} from '@/lib/resume-blurb';
import {getLearnerIdFromRequest} from '@/lib/session';
import {checkRateLimit, getRateLimitKey} from '@/lib/rate-limit';
import {textStreamFromGenerator} from '@/lib/stream-utils';
import type {ItemType} from '@/lib/types';

// Generates a short, grounded "here's what to put on your resume" summary
// from a learner's actually-completed items — same RAG/grounding pattern as
// /api/explain, differing only in what evidence is retrieved (every
// completed item, not one recommended one).

export async function POST(request: NextRequest) {
  const learnerId = getLearnerIdFromRequest(request);
  if (!learnerId) {
    return NextResponse.json({error: 'No profile yet.'}, {status: 404});
  }

  const rateLimit = checkRateLimit(
    'resume-blurb',
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

  const learner = await db.learner.findUnique({where: {id: learnerId}});
  if (!learner) {
    return NextResponse.json({error: 'No profile yet.'}, {status: 404});
  }

  const courseById = await loadCourseMap();
  const completedIds = await getCompletedCourseIds(learnerId);
  const completedItems = [...completedIds]
    .map(id => courseById.get(id))
    .filter((course): course is NonNullable<typeof course> => Boolean(course))
    .map(course => ({
      title: course.title,
      type: course.type as ItemType,
      skillsTaught: course.skillsTaught,
    }));

  if (completedItems.length === 0) {
    return NextResponse.json(
      {
        error:
          "Complete at least one item first — there's nothing to summarize yet.",
      },
      {status: 400},
    );
  }

  const stream = generateResumeBlurbStream({
    goal: learner.goal,
    completedItems,
  });

  // Streamed, matching /api/explain — plain text body, not JSON, so the
  // client tells this apart from a non-streaming route by Content-Type.
  return new Response(textStreamFromGenerator(stream), {
    headers: {'Content-Type': 'text/plain; charset=utf-8'},
  });
}
