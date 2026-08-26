import {NextResponse, type NextRequest} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {embed, cosineSimilarity} from '@/lib/embeddings';
import {loadCourseMap} from '@/lib/courses';
import {buildExplainInput, explainRecommendationStream} from '@/lib/explain';
import {getLearnerIdFromRequest} from '@/lib/session';
import {checkRateLimit, getRateLimitKey} from '@/lib/rate-limit';
import {textStreamFromGenerator} from '@/lib/stream-utils';
import {LEVEL_RANK, type Level} from '@/lib/types';

// SRS FR-5.1: "why was this course recommended" — grounded in the same
// evidence /api/recommend used to rank it (docs/TRD.md §4.3).

const explainInputSchema = z.object({courseId: z.string().min(1)});

export async function POST(request: NextRequest) {
  const learnerId = getLearnerIdFromRequest(request);
  if (!learnerId) {
    return NextResponse.json({error: 'No profile yet.'}, {status: 404});
  }

  const rateLimit = checkRateLimit(
    'explain',
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

  const stream = explainRecommendationStream(
    buildExplainInput(
      course,
      courseById,
      learner.goal,
      similarity,
      levelMismatch,
    ),
  );

  // Streamed as it generates (SRS FR-5.1 is the highest-frequency LLM
  // interaction on the dashboard) — plain text body, not JSON, so the
  // client tells this apart from a non-streaming route by Content-Type.
  return new Response(textStreamFromGenerator(stream), {
    headers: {'Content-Type': 'text/plain; charset=utf-8'},
  });
}
