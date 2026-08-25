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
  "You are a learning-path assistant. Read the learner's message and extract " +
  'their goal, interests, and self-rated skill level if stated or clearly ' +
  'implied. Only fill a field when the message actually supports it — leave ' +
  'goal/interests/level unset rather than guessing. If the message is too ' +
  'vague to act on (e.g. "help me learn stuff"), set needsClarification=true ' +
  'and write a reply that asks ONE specific clarifying question. Otherwise ' +
  'set needsClarification=false and write a short, warm reply acknowledging ' +
  'what you understood. Reply with JSON only, matching the schema.';

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
