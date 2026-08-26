import {NextResponse, type NextRequest} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {extractIntent} from '@/lib/intent';
import {answerPathQuestionStream} from '@/lib/qa';
import {embed} from '@/lib/embeddings';
import {rankCourses, computeLevelAdjustment} from '@/lib/recommend';
import {
  loadCourseMap,
  getCompletedCourseIds,
  getFeedbackCounts,
} from '@/lib/courses';
import {getLearnerIdFromRequest, setLearnerIdCookie} from '@/lib/session';
import {checkRateLimit, getRateLimitKey} from '@/lib/rate-limit';
import {textStreamFromGenerator} from '@/lib/stream-utils';
import type {Level} from '@/lib/types';

// SRS FR-1: conversational intake. Extracts structured intent from the
// message via lib/intent.ts, then updates (or creates) the learner profile
// with whatever the model actually extracted — FR-2.2's "profile updates via
// chat" path. Also covers FR-5.2: once a goal exists, a question ("why not
// X", "how long will this take") is answered grounded in the learner's
// current recommendations instead of running intent extraction on it.

const QUESTION_PATTERN = /\?\s*$/;

const chatInputSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      }),
    )
    .max(20)
    .optional(),
});

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = chatInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "That message couldn't be sent — please try again.",
        details: parsed.error.flatten(),
      },
      {status: 400},
    );
  }

  const {message, history} = parsed.data;

  const learnerId = getLearnerIdFromRequest(request);

  const rateLimit = checkRateLimit('chat', getRateLimitKey(request, learnerId));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {error: 'Too many requests. Please slow down.'},
      {
        status: 429,
        headers: {'Retry-After': String(rateLimit.retryAfterSeconds)},
      },
    );
  }

  const existing = learnerId
    ? await db.learner.findUnique({where: {id: learnerId}})
    : null;

  if (existing?.goal && QUESTION_PATTERN.test(message.trim())) {
    const interests = JSON.parse(existing.interests) as string[];
    const goalText =
      `${existing.goal} Interests: ${interests.join(', ')}.`.trim();
    let goalEmbedding: number[];
    try {
      goalEmbedding = await embed(goalText);
    } catch {
      return NextResponse.json(
        {error: "Couldn't process your message right now. Please try again."},
        {status: 503},
      );
    }
    const courseById = await loadCourseMap();
    const completed = await getCompletedCourseIds(existing.id);
    const levelAdjustment = computeLevelAdjustment(
      await getFeedbackCounts(existing.id),
    );
    const ranked = rankCourses(
      {goalEmbedding, level: existing.level as Level, levelAdjustment},
      [...courseById.values()],
      completed,
    );

    const stream = answerPathQuestionStream(message, {
      goal: existing.goal,
      recommendations: ranked.slice(0, 5).map(r => ({
        title: r.course.title,
        level: r.course.level,
        description: r.course.description,
        type: r.course.type,
      })),
    });

    // Streamed as it generates (this is the higher-frequency chat
    // interaction once a goal exists) — profile data rides along as a
    // response header since the body is plain streamed text, not JSON; the
    // client tells this apart from the intent-extraction branch below by
    // Content-Type.
    const response = new NextResponse(textStreamFromGenerator(stream), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Profile': encodeURIComponent(
          JSON.stringify({
            id: existing.id,
            goal: existing.goal,
            level: existing.level,
            interests,
          }),
        ),
      },
    });
    setLearnerIdCookie(response, existing.id);
    return response;
  }

  let intent;
  try {
    intent = await extractIntent(message, history);
  } catch {
    // The local LLM call can time out under heavy concurrent load (see
    // tests/stress/concurrent-chat.spec.ts) — surface a clean, well-formed
    // error instead of letting the exception crash the route handler with
    // an empty/malformed response body.
    return NextResponse.json(
      {error: 'The assistant is taking too long to respond. Please try again.'},
      {status: 503},
    );
  }

  const mergedInterests =
    intent.interests && intent.interests.length > 0
      ? [
          ...new Set([
            ...(existing ? (JSON.parse(existing.interests) as string[]) : []),
            ...intent.interests,
          ]),
        ]
      : undefined;

  const learner = existing
    ? await db.learner.update({
        where: {id: existing.id},
        data: {
          ...(intent.goal !== undefined && {goal: intent.goal}),
          ...(intent.level !== undefined && {level: intent.level}),
          ...(mergedInterests !== undefined && {
            interests: JSON.stringify(mergedInterests),
          }),
        },
      })
    : await db.learner.create({
        data: {
          goal: intent.goal ?? '',
          level: intent.level ?? 'BEGINNER',
          interests: JSON.stringify(intent.interests ?? []),
        },
      });

  const response = NextResponse.json({
    reply: intent.reply,
    needsClarification: intent.needsClarification,
    profile: {
      id: learner.id,
      goal: learner.goal,
      level: learner.level,
      interests: JSON.parse(learner.interests) as string[],
    },
  });
  setLearnerIdCookie(response, learner.id);
  return response;
}
