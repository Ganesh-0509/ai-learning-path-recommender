import {NextResponse, type NextRequest} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {getLearnerIdFromRequest, setLearnerIdCookie} from '@/lib/session';
import {LEVELS} from '@/lib/types';

// SRS FR-2.1/FR-2.2: learner profile capture (interests, level, goal), via
// chat or a structured form — this route is the structured-form + read path;
// /api/chat updates the same rows from parsed conversation intent.

const profileInputSchema = z.object({
  interests: z.array(z.string().min(1).max(80)).max(20).optional(),
  level: z.enum(LEVELS).optional(),
  goal: z.string().max(500).optional(),
});

type LearnerRow = {
  id: string;
  interests: string;
  level: string;
  goal: string;
  createdAt: Date;
  updatedAt: Date;
};

function serializeLearner(learner: LearnerRow) {
  return {
    id: learner.id,
    interests: JSON.parse(learner.interests) as string[],
    level: learner.level,
    goal: learner.goal,
    createdAt: learner.createdAt,
    updatedAt: learner.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const learnerId = getLearnerIdFromRequest(request);
  if (!learnerId) {
    return NextResponse.json({error: 'No profile yet.'}, {status: 404});
  }

  const learner = await db.learner.findUnique({where: {id: learnerId}});
  if (!learner) {
    // Stale cookie (e.g. DB was reset) — treat the same as no profile.
    return NextResponse.json({error: 'No profile yet.'}, {status: 404});
  }

  return NextResponse.json(serializeLearner(learner));
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = profileInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "That profile information couldn't be saved — please check it and try again.",
        details: parsed.error.flatten(),
      },
      {status: 400},
    );
  }

  const {interests, level, goal} = parsed.data;
  const existingId = getLearnerIdFromRequest(request);
  const existing = existingId
    ? await db.learner.findUnique({where: {id: existingId}})
    : null;

  const learner = existing
    ? await db.learner.update({
        where: {id: existing.id},
        data: {
          ...(interests !== undefined && {
            interests: JSON.stringify(interests),
          }),
          ...(level !== undefined && {level}),
          ...(goal !== undefined && {goal}),
        },
      })
    : await db.learner.create({
        data: {
          interests: JSON.stringify(interests ?? []),
          level: level ?? 'BEGINNER',
          goal: goal ?? '',
        },
      });

  const response = NextResponse.json(serializeLearner(learner), {
    status: existing ? 200 : 201,
  });
  setLearnerIdCookie(response, learner.id);
  return response;
}
