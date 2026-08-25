import {z} from 'zod';
import {chat} from './llm';
import type {CourseRecord} from './courses';

/**
 * SRS FR-5.1: explain a single recommendation. RAG pattern — the model is
 * handed only the retrieved evidence (similarity bucket, matched skills,
 * prerequisite chain, the learner's own goal text) and its job is to phrase
 * that evidence, not invent a justification. No JSON Schema here (plain
 * text out), so no structured-output retry loop is needed.
 */

const explainInputSchema = z.object({
  course: z.object({
    title: z.string(),
    description: z.string(),
    skillsTaught: z.array(z.string()),
    level: z.string(),
  }),
  learnerGoal: z.string(),
  similarity: z.number(),
  levelMismatch: z.boolean(),
  prerequisiteTitles: z.array(z.string()),
});

export type ExplainInput = z.infer<typeof explainInputSchema>;

function similarityBucket(similarity: number): string {
  if (similarity >= 0.6) return 'a strong match';
  if (similarity >= 0.35) return 'a moderate match';
  return 'a loose match';
}

export async function explainRecommendation(
  input: ExplainInput,
): Promise<string> {
  const parsed = explainInputSchema.parse(input);

  const evidence = [
    `Learner's stated goal: "${parsed.learnerGoal}"`,
    `Course: "${parsed.course.title}" (${parsed.course.level})`,
    `Course description: ${parsed.course.description}`,
    `Skills this course teaches: ${parsed.course.skillsTaught.join(', ')}`,
    `Similarity to the learner's goal: ${similarityBucket(parsed.similarity)}.`,
    parsed.levelMismatch
      ? "Note: this course's level does not exactly match the learner's self-rated level."
      : "This course's level matches the learner's self-rated level.",
    parsed.prerequisiteTitles.length > 0
      ? `Prerequisites in the path before this course: ${parsed.prerequisiteTitles.join(', ')}.`
      : 'This course has no prerequisites in the current path.',
  ].join('\n');

  const reply = await chat(
    [
      {
        role: 'system',
        content:
          'You explain why a course was recommended to a learner, using ONLY ' +
          'the evidence given to you below — do not invent facts about the ' +
          'course or claim things not stated in the evidence. 2-3 sentences, ' +
          'plain text, no markdown, speak directly to the learner ("you").',
      },
      {role: 'user', content: evidence},
    ],
    {temperature: 0.4, timeoutMs: 60_000},
  );

  return reply.trim();
}

/** Builds the ExplainInput for a course already present in a loaded course
 * map — a small convenience so callers don't repeat the lookup/shape logic. */
export function buildExplainInput(
  course: CourseRecord,
  courseById: ReadonlyMap<string, CourseRecord>,
  learnerGoal: string,
  similarity: number,
  levelMismatch: boolean,
): ExplainInput {
  const prerequisiteTitles = course.prerequisites
    .map(id => courseById.get(id)?.title)
    .filter((title): title is string => Boolean(title));

  return {
    course: {
      title: course.title,
      description: course.description,
      skillsTaught: course.skillsTaught,
      level: course.level,
    },
    learnerGoal,
    similarity,
    levelMismatch,
    prerequisiteTitles,
  };
}
