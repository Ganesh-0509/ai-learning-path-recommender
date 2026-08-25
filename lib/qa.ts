import {chat} from './llm';

/**
 * SRS FR-5.2: answer a learner's question about their existing
 * recommendations/path, grounded in the same evidence the dashboard shows —
 * not free generation. The model is told explicitly not to name a course
 * outside the given list.
 */

export type PathQaContext = {
  goal: string;
  recommendations: {title: string; level: string; description: string}[];
};

export async function answerPathQuestion(
  question: string,
  context: PathQaContext,
): Promise<string> {
  const coursesBlock = context.recommendations
    .map(c => `- "${c.title}" (${c.level}): ${c.description}`)
    .join('\n');

  const reply = await chat(
    [
      {
        role: 'system',
        content:
          "You answer a learner's question about their recommended learning " +
          'path, using ONLY the course list given to you below. Never name or ' +
          'describe a course that is not in this list — if the question asks ' +
          'about something not covered, say so plainly rather than guessing. ' +
          '2-4 sentences, plain text, speak directly to the learner ("you").',
      },
      {
        role: 'user',
        content:
          `Learner's goal: "${context.goal}"\n\n` +
          `Current recommended courses:\n${coursesBlock}\n\n` +
          `Learner's question: ${question}`,
      },
    ],
    {temperature: 0.4, timeoutMs: 60_000},
  );

  return reply.trim();
}
