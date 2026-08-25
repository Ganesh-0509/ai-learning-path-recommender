import {NextResponse, type NextRequest} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {extractIntent} from '@/lib/intent';
import {getLearnerIdFromRequest, setLearnerIdCookie} from '@/lib/session';

// SRS FR-1: conversational intake. Extracts structured intent from the
// message via lib/intent.ts, then updates (or creates) the learner profile
// with whatever the model actually extracted — FR-2.2's "profile updates via
// chat" path.

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
  const intent = await extractIntent(message, history);

  const learnerId = getLearnerIdFromRequest(request);
  const existing = learnerId
    ? await db.learner.findUnique({where: {id: learnerId}})
    : null;

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
