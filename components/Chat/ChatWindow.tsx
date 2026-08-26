'use client';

import {useState, type FormEvent} from 'react';
import Link from 'next/link';
import MarkdownText from '@/components/MarkdownText';
import {extractErrorMessage} from '@/lib/client-errors';

// SRS FR-1: conversational interface. Talks to /api/chat, which extracts
// structured intent (lib/intent.ts) and updates the learner profile as a
// side effect — this component just renders the conversation and surfaces a
// link to the dashboard once there's enough profile to generate a path.
//
// /api/chat returns two different response shapes depending on which
// branch it took: JSON for intent extraction, or a streamed plain-text body
// (with profile data riding in the X-Profile header) for the path-Q&A
// branch — told apart here by Content-Type, since the Q&A branch is the
// higher-frequency interaction once a goal exists and streaming makes the
// wait visibly happen instead of a silent multi-second pause.

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
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGoal, setHasGoal] = useState(false);

  async function consumeStream(response: Response) {
    setMessages(prev => [...prev, {role: 'assistant', content: ''}]);
    setStreaming(true);
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();

    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, {stream: true});
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        next[next.length - 1] = {...last, content: last.content + chunk};
        return next;
      });
    }
  }

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
        setError(
          await extractErrorMessage(
            response,
            'Something went wrong reaching the assistant. Please try again.',
          ),
        );
        return;
      }

      if (response.headers.get('content-type')?.includes('text/plain')) {
        await consumeStream(response);
        // The Q&A branch only ever runs once a goal already exists, so
        // hasGoal is already true — the X-Profile header exists for
        // completeness/robustness, not because this path changes it.
        const profileHeader = response.headers.get('x-profile');
        if (profileHeader) {
          const profile = JSON.parse(decodeURIComponent(profileHeader));
          setHasGoal(Boolean(profile.goal));
        }
      } else {
        const data: ChatResponse = await response.json();
        setMessages(prev => [
          ...prev,
          {role: 'assistant', content: data.reply},
        ]);
        setHasGoal(Boolean(data.profile.goal));
      }
    } catch {
      setError(
        'Something went wrong reaching the assistant. Please try again.',
      );
    } finally {
      setLoading(false);
      setStreaming(false);
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
            <MarkdownText text={message.content} />
          </div>
        ))}
        {loading && !streaming && (
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
