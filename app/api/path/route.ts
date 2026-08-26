import {NextResponse, type NextRequest} from 'next/server';
import {db} from '@/lib/db';
import {embed} from '@/lib/embeddings';
import {rankCourses, computeLevelAdjustment} from '@/lib/recommend';
import {buildPath} from '@/lib/prereq-graph';
import {
  loadCourseMap,
  getCompletedCourseIds,
  getFeedbackCounts,
} from '@/lib/courses';
import {getLearnerIdFromRequest} from '@/lib/session';
import {checkRateLimit, getRateLimitKey} from '@/lib/rate-limit';
import type {Level} from '@/lib/types';

// SRS FR-4: learning path generator. Takes the top-ranked recommendations,
// expands them with prerequisites, and groups the result into milestones —
// docs/TRD.md §4.2.

const PATH_SEED_COUNT = 5;

export async function GET(request: NextRequest) {
  const learnerId = getLearnerIdFromRequest(request);
  if (!learnerId) {
    return NextResponse.json({error: 'No profile yet.'}, {status: 404});
  }

  const rateLimit = checkRateLimit('path', getRateLimitKey(request, learnerId));
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

  const interests = JSON.parse(learner.interests) as string[];
  if (!learner.goal && interests.length === 0) {
    return NextResponse.json(
      {error: 'Set a goal or interests before requesting a path.'},
      {status: 400},
    );
  }

  const goalText = `${learner.goal} Interests: ${interests.join(', ')}.`.trim();
  let goalEmbedding: number[];
  try {
    goalEmbedding = await embed(goalText);
  } catch {
    return NextResponse.json(
      {error: "Couldn't process your goal right now. Please try again."},
      {status: 503},
    );
  }

  const courseById = await loadCourseMap();
  const completed = await getCompletedCourseIds(learner.id);
  const levelAdjustment = computeLevelAdjustment(
    await getFeedbackCounts(learner.id),
  );

  const ranked = rankCourses(
    {goalEmbedding, level: learner.level as Level, levelAdjustment},
    [...courseById.values()],
    completed,
  );
  const seedIds = ranked.slice(0, PATH_SEED_COUNT).map(r => r.course.id);

  if (seedIds.length === 0) {
    return NextResponse.json({milestones: []});
  }

  const milestones = buildPath(seedIds, courseById);

  return NextResponse.json({
    milestones: milestones.map(m => ({
      title: m.title,
      courses: m.courseIds.map(id => {
        const course = courseById.get(id);
        if (!course) {
          throw new Error(`buildPath returned unknown course id "${id}"`);
        }
        return {
          id: course.id,
          title: course.title,
          type: course.type,
          category: course.category,
          description: course.description,
          skillsTaught: course.skillsTaught,
          level: course.level,
          completed: completed.has(course.id),
        };
      }),
    })),
  });
}
