import {db} from './db';
import type {CourseLike, ItemType, Level} from './types';

/** Superset of CourseLike with the display fields the API responses need —
 * lib/recommend.ts and lib/prereq-graph.ts only read the CourseLike subset,
 * so this stays a drop-in wherever a CourseLike is expected. */
export type CourseRecord = CourseLike & {
  type: ItemType;
  category: string;
  description: string;
  skillsTaught: string[];
};

/** Loads the full course catalog from the DB, parsing the JSON-encoded
 * columns into plain objects. */
export async function loadCourseMap(): Promise<Map<string, CourseRecord>> {
  const rows = await db.course.findMany();
  return new Map(
    rows.map(row => [
      row.id,
      {
        id: row.id,
        title: row.title,
        type: row.type as ItemType,
        level: row.level as Level,
        category: row.category,
        description: row.description,
        skillsTaught: JSON.parse(row.skillsTaught) as string[],
        prerequisites: JSON.parse(row.prerequisites) as string[],
        embedding: JSON.parse(row.embedding) as number[],
      },
    ]),
  );
}

export async function getCompletedCourseIds(
  learnerId: string,
): Promise<Set<string>> {
  const rows = await db.progress.findMany({
    where: {learnerId, status: 'COMPLETE'},
    select: {courseId: true},
  });
  return new Set(rows.map(r => r.courseId));
}

/** Feeds lib/recommend.ts's computeLevelAdjustment — SRS FR-4.4/FR-6.5. */
export async function getFeedbackCounts(
  learnerId: string,
): Promise<{tooEasy: number; tooHard: number}> {
  const [tooEasy, tooHard] = await Promise.all([
    db.progress.count({where: {learnerId, feedback: 'TOO_EASY'}}),
    db.progress.count({where: {learnerId, feedback: 'TOO_HARD'}}),
  ]);
  return {tooEasy, tooHard};
}
