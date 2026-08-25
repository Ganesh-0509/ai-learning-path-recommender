import {NextResponse, type NextRequest} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {embed, cosineSimilarity} from '@/lib/embeddings';
import {loadCourseMap} from '@/lib/courses';
import {buildExplainInput, explainRecommendation} from '@/lib/explain';
import {getLearnerIdFromRequest} from '@/lib/session';
import {LEVEL_RANK, type Level} from '@/lib/types';

// SRS FR-5.1: "why was this course recommended" — grounded in the same
// evidence /api/recommend used to rank it (docs/TRD.md §4.3).

const explainInputSchema = z.object({courseId: z.string().min(1)});

export async function POST(request: NextRequest) {
  const learnerId = getLearnerIdFromRequest(request);
  if (!learnerId) {
    return NextResponse.json({error: 'No profile yet.'}, {status: 404});
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = explainInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({error: 'Invalid request.'}, {status: 400});
  }

  const learner = await db.learner.findUnique({where: {id: learnerId}});
  if (!learner) {
    return NextResponse.json({error: 'No profile yet.'}, {status: 404});
  }

  const courseById = await loadCourseMap();
  const course = courseById.get(parsed.data.courseId);
  if (!course) {
    return NextResponse.json({error: 'Unknown course id.'}, {status: 404});
  }

  const interests = JSON.parse(learner.interests) as string[];
  const goalText = `${learner.goal} Interests: ${interests.join(', ')}.`.trim();
  const goalEmbedding = await embed(goalText);
  const similarity = cosineSimilarity(goalEmbedding, course.embedding);
  const levelMismatch =
    LEVEL_RANK[course.level as Level] !== LEVEL_RANK[learner.level as Level];

  const explanation = await explainRecommendation(
    buildExplainInput(
      course,
      courseById,
      learner.goal,
      similarity,
      levelMismatch,
    ),
  );

  return NextResponse.json({explanation});
}
