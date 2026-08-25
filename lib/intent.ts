import {z} from 'zod';
import {chatStructured, type ChatMessage} from './llm';
import {LEVELS} from './types';

/**
 * Turns a learner's free-text chat message into structured profile intent —
 * SRS FR-1.1/FR-1.2/FR-1.3. The model also drafts the reply shown to the
 * learner, so a single call covers both "understand" and "respond."
 */

const intentSchema = z.object({
  reply: z.string().min(1).max(600),
  goal: z.string().max(500).optional(),
  interests: z.array(z.string().max(80)).max(10).optional(),
  level: z.enum(LEVELS).optional(),
  needsClarification: z.boolean(),
});

export type ExtractedIntent = z.infer<typeof intentSchema>;

const INTENT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    reply: {type: 'string'},
    goal: {type: 'string'},
    interests: {type: 'array', items: {type: 'string'}, maxItems: 10},
    level: {type: 'string', enum: LEVELS},
    needsClarification: {type: 'boolean'},
  },
  required: ['reply', 'needsClarification'],
};

const SYSTEM_PROMPT =
  'You are a learning-path assistant. Extract structured intent from the ' +
  "learner's message, following these rules exactly:\n" +
  '1. If the message names ANY concrete skill, technology, or role (e.g. ' +
  '"backend developer", "Node.js", "machine learning", "become a data ' +
  'analyst"), set `goal` to a short paraphrase of it and set ' +
  'needsClarification=false — even if their experience level or every ' +
  'interest is still unknown. Do NOT withhold `goal` or ask about experience ' +
  'level as a precondition; level defaults elsewhere in the system, so it is ' +
  'never a reason to hold back a goal that was already stated.\n' +
  '2. Only set needsClarification=true when the message gives NO concrete ' +
  'direction at all (e.g. "help me", "I want to learn something", "hi") — a ' +
  'message naming any actual skill/role/technology is never too vague.\n' +
  '3. If the message also states a level (e.g. "I\'m a beginner", "I already ' +
  'know Python") or specific interests, extract those too.\n' +
  '4. Write `reply` as a short, warm acknowledgment. When needsClarification ' +
  'is false, do not end the reply with a question. When it is true, ask ONE ' +
  'specific clarifying question.\n' +
  'Reply with JSON only, matching the schema.';

export async function extractIntent(
  message: string,
  history: ChatMessage[] = [],
): Promise<ExtractedIntent> {
  return chatStructured(
    [
      {role: 'system', content: SYSTEM_PROMPT},
      ...history,
      {role: 'user', content: message},
    ],
    INTENT_JSON_SCHEMA,
    intentSchema,
    {temperature: 0.3, timeoutMs: 60_000},
  );
}
