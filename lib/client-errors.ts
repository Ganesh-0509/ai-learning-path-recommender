/**
 * Every API route in this app returns `{error: string}` in its JSON body on
 * failure, already worded for a learner to read (e.g. "Too many requests.
 * Please slow down." vs. "The assistant is taking too long to respond.") —
 * but client components were discarding it and showing one generic
 * "something went wrong" for every failure mode instead. This surfaces that
 * specific message so a rate limit, a timeout, and an expired profile each
 * read differently, and falls back to `fallback` only when the body isn't
 * parseable JSON (a network-level failure that never reached the server).
 */
export async function extractErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof body.error === 'string' &&
      body.error.length > 0
    ) {
      return body.error;
    }
  } catch {
    // Not JSON (or no body) — a network failure, not a server error response.
  }
  return fallback;
}
