import {NextResponse, type NextRequest} from 'next/server';
import {db} from '@/lib/db';
import {embed} from '@/lib/embeddings';
import {rankCourses, computeLevelAdjustment} from '@/lib/recommend';
import {
  loadCourseMap,
  getCompletedCourseIds,
  getFeedbackCounts,
} from '@/lib/courses';
import {getLearnerIdFromRequest} from '@/lib/session';
import type {Level} from '@/lib/types';

// SRS FR-3: recommendation engine. Ranks the catalog by similarity to the
// learner's stated goal/interests, filtered by completed courses, re-weighted
// (not hard-filtered) by level match — docs/TRD.md §4.1.

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

export async function GET(request: NextRequest) {
  const learnerId = getLearnerIdFromRequest(request);
  if (!learnerId) {
    return NextResponse.json({error: 'No profile yet.'}, {status: 404});
  }

  const learner = await db.learner.findUnique({where: {id: learnerId}});
  if (!learner) {
    return NextResponse.json({error: 'No profile yet.'}, {status: 404});
  }

  const interests = JSON.parse(learner.interests) as string[];
  if (!learner.goal && interests.length === 0) {
    return NextResponse.json(
      {error: 'Set a goal or interests before requesting recommendations.'},
      {status: 400},
    );
  }

  const limitParam = Number(request.nextUrl.searchParams.get('limit'));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_LIMIT)
      : DEFAULT_LIMIT;

  const goalText = `${learner.goal} Interests: ${interests.join(', ')}.`.trim();
  const goalEmbedding = await embed(goalText);

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

  return NextResponse.json({
    recommendations: ranked.slice(0, limit).map(r => ({
      id: r.course.id,
      title: r.course.title,
      category: r.course.category,
      description: r.course.description,
      skillsTaught: r.course.skillsTaught,
      level: r.course.level,
      similarity: r.similarity,
      score: r.score,
      levelMismatch: r.levelMismatch,
    })),
  });
}
