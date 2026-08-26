import ChatWindow from '@/components/Chat/ChatWindow';

// Forces dynamic rendering — a statically prerendered page's headers are
// baked in at build time, which would serve a stale (nonce-less) CSP header
// from proxy.ts and break hydration entirely.
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 bg-zinc-50 px-6 py-8 sm:py-16 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Learning Path Recommender
        </h1>
        <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          Tell the assistant your goal and it will build a personalized,
          explained learning path from the course catalog.
        </p>
      </div>
      <ChatWindow />
    </main>
  );
}
