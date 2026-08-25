import {NextResponse, type NextRequest} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {extractIntent} from '@/lib/intent';
import {answerPathQuestion} from '@/lib/qa';
import {embed} from '@/lib/embeddings';
import {rankCourses, computeLevelAdjustment} from '@/lib/recommend';
import {
  loadCourseMap,
  getCompletedCourseIds,
  getFeedbackCounts,
} from '@/lib/courses';
import {getLearnerIdFromRequest, setLearnerIdCookie} from '@/lib/session';
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
      {error: 'Invalid chat request.', details: parsed.error.flatten()},
      {status: 400},
    );
  }

  const {message, history} = parsed.data;

  const learnerId = getLearnerIdFromRequest(request);
  const existing = learnerId
    ? await db.learner.findUnique({where: {id: learnerId}})
    : null;

  if (existing?.goal && QUESTION_PATTERN.test(message.trim())) {
    const interests = JSON.parse(existing.interests) as string[];
    const goalText =
      `${existing.goal} Interests: ${interests.join(', ')}.`.trim();
    const goalEmbedding = await embed(goalText);
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

    const answer = await answerPathQuestion(message, {
      goal: existing.goal,
      recommendations: ranked.slice(0, 5).map(r => ({
        title: r.course.title,
        level: r.course.level,
        description: r.course.description,
      })),
    });

    const response = NextResponse.json({
      reply: answer,
      needsClarification: false,
      profile: {
        id: existing.id,
        goal: existing.goal,
        level: existing.level,
        interests,
      },
    });
    setLearnerIdCookie(response, existing.id);
    return response;
  }

  const intent = await extractIntent(message, history);

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
