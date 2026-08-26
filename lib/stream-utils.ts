/** Adapts an async generator of text chunks (lib/llm.ts's `chatStream`) into
 * a web ReadableStream a Next.js route handler can return as a Response
 * body.
 *
 * The response has already started (status 200, headers sent) by the time
 * the generator runs, so a mid-stream failure — e.g. the LLM call timing
 * out under concurrent load, see tests/stress/concurrent-streaming.spec.ts —
 * can't be turned into a different HTTP status. Left uncaught, it would
 * abort the connection and the client would see an opaque network error.
 * Catching it here and enqueueing a plain-text fallback instead means the
 * learner always sees a readable message. */
export function textStreamFromGenerator(
  generator: AsyncGenerator<string>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const {value, done} = await generator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(value));
      } catch {
        controller.enqueue(
          encoder.encode(
            '\n\nSorry, that took too long to generate. Please try again.',
          ),
        );
        controller.close();
      }
    },
    async cancel() {
      await generator.return(undefined);
    },
  });
}
