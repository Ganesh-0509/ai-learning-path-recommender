'use client';

import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import MarkdownText from '@/components/MarkdownText';
import {LEVELS, nounForItemType, type ItemType, type Level} from '@/lib/types';

// SRS FR-6: dashboard — progress, skills, milestones, next recommended
// action. Reads /api/profile + /api/path (which already reflects Progress
// rows), and writes back through /api/progress — FR-6.5's feedback loop.

type Course = {
  id: string;
  title: string;
  type: ItemType;
  category: string;
  description: string;
  skillsTaught: string[];
  level: string;
  completed: boolean;
};

type Milestone = {
  title: string;
  courses: Course[];
};

type Profile = {
  id: string;
  goal: string;
  level: string;
  interests: string[];
};

const LEVEL_LABELS: Record<Level, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  COURSE: 'Course',
  PROJECT: 'Project',
  ASSESSMENT: 'Assessment',
};

const ITEM_TYPE_BADGE_CLASSES: Record<ItemType, string> = {
  COURSE: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  PROJECT:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  ASSESSMENT:
    'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

export default function DashboardView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  // Distinct from `refreshing` on purpose: only the very first load should
  // blank the whole page. A "Mark complete" refresh previously reused this
  // flag and unmounted the entire dashboard for a single list-item change.
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explaining, setExplaining] = useState<string | null>(null);
  const [savingLevel, setSavingLevel] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const profileResponse = await fetch('/api/profile');
      if (profileResponse.status === 404) {
        setProfile(null);
        setMilestones(null);
        return;
      }
      if (!profileResponse.ok) {
        throw new Error('Failed to load profile.');
      }
      setProfile(await profileResponse.json());

      const pathResponse = await fetch('/api/path');
      if (pathResponse.ok) {
        const pathData = await pathResponse.json();
        setMilestones(pathData.milestones);
      } else if (pathResponse.status !== 400) {
        throw new Error('Failed to load learning path.');
      } else {
        setMilestones([]);
      }
    } catch {
      setError('Something went wrong loading your dashboard.');
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    // Standard fetch-on-mount pattern — `load` is also reused by
    // markComplete's refresh, so it stays a shared useCallback rather than
    // being inlined here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function markComplete(courseId: string) {
    setUpdatingId(courseId);
    setActionErrors(prev => ({...prev, [courseId]: ''}));
    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({courseId, status: 'COMPLETE'}),
      });
      if (!response.ok) {
        throw new Error('Request failed');
      }
      await load();
    } catch {
      setActionErrors(prev => ({
        ...prev,
        [courseId]: "Couldn't mark this complete — try again.",
      }));
    } finally {
      setUpdatingId(null);
    }
  }

  async function explainCourse(courseId: string) {
    setExplaining(courseId);
    setActionErrors(prev => ({...prev, [courseId]: ''}));
    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({courseId}),
      });
      if (!response.ok) {
        throw new Error('Request failed');
      }
      // Streamed — appears progressively rather than after a multi-second
      // silent wait (docs/TRD.md §4.3 grounding still applies server-side;
      // this only changes how the same text arrives at the client).
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }
      const decoder = new TextDecoder();
      while (true) {
        const {value, done} = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, {stream: true});
        setExplanations(prev => ({
          ...prev,
          [courseId]: (prev[courseId] ?? '') + chunk,
        }));
      }
    } catch {
      setActionErrors(prev => ({
        ...prev,
        [courseId]: "Couldn't load an explanation — try again.",
      }));
    } finally {
      setExplaining(null);
    }
  }

  async function updateLevel(level: Level) {
    setSavingLevel(true);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({level}),
      });
      await load();
    } finally {
      setSavingLevel(false);
    }
  }

  if (initialLoading) {
    return <p className="text-sm text-zinc-500">Loading your dashboard…</p>;
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No profile yet — tell the assistant your goal first.
        </p>
        <Link
          href="/"
          className="text-sm font-medium underline underline-offset-4"
        >
          Go to chat →
        </Link>
      </div>
    );
  }

  const allCourses = (milestones ?? []).flatMap(m => m.courses);
  const completedCount = allCourses.filter(c => c.completed).length;
  const progressPercent =
    allCourses.length > 0
      ? Math.round((completedCount / allCourses.length) * 100)
      : 0;
  const nextAction = allCourses.find(c => !c.completed);

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      {error && (
        <p className="flex items-center gap-3 text-sm text-red-600 dark:text-red-400">
          {error}
          <button
            type="button"
            onClick={() => load()}
            className="font-medium underline underline-offset-4"
          >
            Try again
          </button>
        </p>
      )}

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-500">Goal</h2>
            <p className="text-lg text-zinc-900 dark:text-zinc-50">
              {profile.goal || '—'}
            </p>
          </div>
          <label className="flex shrink-0 flex-col items-end gap-1 text-right">
            <span className="text-sm font-medium text-zinc-500">Level</span>
            <select
              value={profile.level}
              disabled={savingLevel}
              onChange={e => updateLevel(e.target.value as Level)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {LEVELS.map(level => (
                <option key={level} value={level}>
                  {LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Learning path progress"
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
        >
          <div
            className="h-full bg-zinc-900 dark:bg-zinc-100"
            style={{width: `${progressPercent}%`}}
          />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {completedCount} / {allCourses.length} items complete (
          {progressPercent}%)
        </p>
      </section>

      {nextAction && (
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-500">
            Next recommended action
          </h2>
          <p className="text-base font-medium text-zinc-900 dark:text-zinc-50">
            {nextAction.title}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {nextAction.description}
          </p>
        </section>
      )}

      {milestones !== null && milestones.length === 0 && (
        <section className="rounded-lg border border-dashed border-zinc-300 p-4 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            We couldn&apos;t match anything to this goal yet — try adding more
            detail (a specific skill or role) in chat.
          </p>
          <Link
            href="/"
            className="mt-2 inline-block text-sm font-medium underline underline-offset-4"
          >
            Back to chat →
          </Link>
        </section>
      )}

      <section className="flex flex-col gap-4">
        {(milestones ?? []).map(milestone => (
          <div key={milestone.title}>
            <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {milestone.title}
            </h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {milestone.courses.map(course => (
                <li
                  key={course.id}
                  className="flex flex-col justify-between gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {course.title}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${ITEM_TYPE_BADGE_CLASSES[course.type]}`}
                        >
                          {ITEM_TYPE_LABELS[course.type]}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {course.description}
                      </p>
                    </div>
                    {course.completed ? (
                      <span className="shrink-0 text-xs font-medium text-green-600 dark:text-green-400">
                        Complete
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markComplete(course.id)}
                        disabled={updatingId === course.id}
                        className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-zinc-700"
                      >
                        Mark complete
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {course.skillsTaught.map(skill => (
                      <span
                        key={skill}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  {explanations[course.id] ? (
                    <div className="text-xs italic text-zinc-600 dark:text-zinc-400">
                      <MarkdownText text={explanations[course.id]} />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => explainCourse(course.id)}
                      disabled={explaining === course.id}
                      className="self-start text-xs font-medium text-zinc-500 underline underline-offset-4 disabled:opacity-50"
                    >
                      {explaining === course.id
                        ? 'Thinking…'
                        : `Why this ${nounForItemType(course.type)}?`}
                    </button>
                  )}

                  {actionErrors[course.id] && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {actionErrors[course.id]}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {refreshing && (
        <p aria-live="polite" className="text-center text-xs text-zinc-400">
          Updating…
        </p>
      )}
    </div>
  );
}
