'use client';

import {useState, type FormEvent} from 'react';
import Link from 'next/link';

// SRS FR-1: conversational interface. Talks to /api/chat, which extracts
// structured intent (lib/intent.ts) and updates the learner profile as a
// side effect — this component just renders the conversation and surfaces a
// link to the dashboard once there's enough profile to generate a path.

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatResponse = {
  reply: string;
  needsClarification: boolean;
  profile: {goal: string; level: string; interests: string[]};
};

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content:
    "Hi! Tell me what you're trying to learn — a goal, a role you're aiming " +
    "for, or a skill you want to build. I'll turn it into a learning path.",
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGoal, setHasGoal] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) {
      return;
    }

    const nextMessages: Message[] = [
      ...messages,
      {role: 'user', content: trimmed},
    ];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-10),
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed (${response.status})`);
      }

      const data: ChatResponse = await response.json();
      setMessages(prev => [...prev, {role: 'assistant', content: data.reply}]);
      setHasGoal(Boolean(data.profile.goal));
    } catch {
      setError(
        'Something went wrong reaching the assistant. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <div
        role="log"
        aria-live="polite"
        className="flex max-h-[60vh] min-h-[300px] flex-col gap-3 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[80%] rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'mr-auto max-w-[80%] rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
            }
          >
            <span className="sr-only">
              {message.role === 'user' ? 'You: ' : 'Assistant: '}
            </span>
            {message.content}
          </div>
        ))}
        {loading && (
          <div className="mr-auto max-w-[80%] rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            Thinking…
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="e.g. I want to become a backend developer"
          disabled={loading}
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-100 dark:focus:ring-offset-zinc-950"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Send
        </button>
      </form>

      {hasGoal && (
        <Link
          href="/dashboard"
          className="text-center text-sm font-medium text-zinc-700 underline underline-offset-4 dark:text-zinc-300"
        >
          View your learning path →
        </Link>
      )}
    </div>
  );
}
