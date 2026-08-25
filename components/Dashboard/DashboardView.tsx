'use client';

import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';

// SRS FR-6: dashboard — progress, skills, milestones, next recommended
// action. Reads /api/profile + /api/path (which already reflects Progress
// rows), and writes back through /api/progress — FR-6.5's feedback loop.

type Course = {
  id: string;
  title: string;
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

export default function DashboardView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explaining, setExplaining] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
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
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({courseId, status: 'COMPLETE'}),
      });
      await load();
    } finally {
      setUpdatingId(null);
    }
  }

  async function explainCourse(courseId: string) {
    setExplaining(courseId);
    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({courseId}),
      });
      if (response.ok) {
        const data = await response.json();
        setExplanations(prev => ({...prev, [courseId]: data.explanation}));
      }
    } finally {
      setExplaining(null);
    }
  }

  if (loading) {
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
    <div className="flex w-full max-w-2xl flex-col gap-6">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">Goal</h2>
        <p className="text-lg text-zinc-900 dark:text-zinc-50">
          {profile.goal || '—'}
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full bg-zinc-900 dark:bg-zinc-100"
            style={{width: `${progressPercent}%`}}
          />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {completedCount} / {allCourses.length} courses complete (
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

      <section className="flex flex-col gap-4">
        {(milestones ?? []).map(milestone => (
          <div key={milestone.title}>
            <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {milestone.title}
            </h2>
            <ul className="flex flex-col gap-2">
              {milestone.courses.map(course => (
                <li
                  key={course.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {course.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {course.description}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {course.skillsTaught.map(skill => (
                        <span
                          key={skill}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                    {explanations[course.id] ? (
                      <p className="mt-2 text-xs italic text-zinc-600 dark:text-zinc-400">
                        {explanations[course.id]}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => explainCourse(course.id)}
                        disabled={explaining === course.id}
                        className="mt-2 text-xs font-medium text-zinc-500 underline underline-offset-4 disabled:opacity-50"
                      >
                        {explaining === course.id
                          ? 'Thinking…'
                          : 'Why this course?'}
                      </button>
                    )}
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
                      className="shrink-0 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium disabled:opacity-50 dark:border-zinc-700"
                    >
                      Mark complete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
