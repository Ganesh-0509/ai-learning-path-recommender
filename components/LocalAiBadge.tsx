/** Turns the "everything runs locally, zero third-party AI" claim into
 * something visible in the product itself, not just something read in the
 * docs — shown next to a response once it's finished streaming/loading.
 * Deliberately generic (no internal hostnames/ports) — a proof-of-concept
 * badge, not an infrastructure disclosure. */
export default function LocalAiBadge({elapsedMs}: {elapsedMs: number}) {
  const seconds = (elapsedMs / 1000).toFixed(1);
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
      <span aria-hidden="true">⚡</span>
      Ran locally · {seconds}s · 0 external calls
    </span>
  );
}
