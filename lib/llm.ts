import {z} from 'zod';

/**
 * Client for the locally-hosted, self-hosted LLM (Ollama). No third-party AI
 * API is called anywhere in this module — see docs/SECURITY.md and PLAN.md
 * §3a for why that's a hard constraint, not a preference.
 */

const DEFAULT_HOST = 'http://localhost:11434';

function getHost(): string {
  return process.env.LLM_HOST ?? DEFAULT_HOST;
}

function getModel(): string {
  const model = process.env.LLM_MODEL;
  if (!model) {
    throw new Error(
      'LLM_MODEL is not set — copy .env.example to .env (see docs/TRD.md §6).',
    );
  }
  return model;
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatOptions = {
  /** JSON Schema the model's reply must conform to (Ollama structured output). */
  format?: Record<string, unknown>;
  /** Lower = more deterministic. Metadata/extraction tasks want this low. */
  temperature?: number;
};

const ollamaChatResponseSchema = z.object({
  message: z.object({content: z.string()}),
});

/**
 * Sends a single, non-streaming chat request to the local Ollama server and
 * returns the assistant's reply text.
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  const response = await fetch(`${getHost()}/api/chat`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      model: getModel(),
      messages,
      stream: false,
      format: options.format,
      options:
        options.temperature === undefined
          ? undefined
          : {temperature: options.temperature},
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Local LLM request failed (${response.status}): ${await response.text()}. ` +
        `Is Ollama running? Try \`ollama serve\` and \`ollama pull ${getModel()}\`.`,
    );
  }

  const parsed = ollamaChatResponseSchema.parse(await response.json());
  return parsed.message.content;
}

/**
 * Calls the LLM with a JSON Schema and validates the reply against a Zod
 * schema, retrying with a corrective follow-up message on failure. Malformed
 * output from a small local model is expected occasionally — this is the one
 * retry boundary for that, not a silent catch (docs/CODING_STANDARDS.md §3).
 */
export async function chatStructured<T>(
  messages: ChatMessage[],
  jsonSchema: Record<string, unknown>,
  zodSchema: z.ZodType<T>,
  options: {temperature?: number; maxAttempts?: number} = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const conversation = [...messages];
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const raw = await chat(conversation, {
      format: jsonSchema,
      temperature: options.temperature,
    });
    try {
      return zodSchema.parse(JSON.parse(raw));
    } catch (error) {
      lastError = error;
      conversation.push({role: 'assistant', content: raw});
      conversation.push({
        role: 'user',
        content:
          'That response did not match the required JSON schema. ' +
          `Error: ${error instanceof Error ? error.message : String(error)}. ` +
          'Reply again with ONLY corrected JSON, matching the schema exactly.',
      });
    }
  }

  throw new Error(
    `Local LLM did not produce schema-valid JSON after ${maxAttempts} attempts: ${String(
      lastError,
    )}`,
  );
}
