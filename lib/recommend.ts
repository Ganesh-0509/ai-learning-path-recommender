import {cosineSimilarity} from './embeddings';
import {LEVEL_RANK, type CourseLike, type Level} from './types';

export type RankedCourse<T extends CourseLike> = {
  course: T;
  similarity: number;
  /** Final ranking score after the level re-weight (docs/TRD.md §4.1 step 4). */
  score: number;
  levelMismatch: boolean;
};

const LEVEL_MISMATCH_PENALTY = 0.15;

/**
 * Ranks courses by similarity to a learner's goal, filtering out completed
 * courses and penalizing (not excluding) a level mismatch — an ambitious
 * beginner still sees a stretch course, just flagged and ranked lower than an
 * equally-similar course at their level (SRS FR-3.3, FR-3.4).
 *
 * Generic over T so callers passing a richer course type (e.g. CourseRecord,
 * which also carries display fields) get it back on `course` without a cast.
 */
export function rankCourses<T extends CourseLike>(
  learner: {goalEmbedding: number[]; level: Level},
  courses: T[],
  completedCourseIds: ReadonlySet<string>,
): RankedCourse<T>[] {
  const learnerRank = LEVEL_RANK[learner.level];

  return courses
    .filter(course => !completedCourseIds.has(course.id))
    .map(course => {
      const similarity = cosineSimilarity(
        learner.goalEmbedding,
        course.embedding,
      );
      const levelDelta = Math.abs(LEVEL_RANK[course.level] - learnerRank);
      const levelMismatch = levelDelta > 0;
      const score = similarity - levelDelta * LEVEL_MISMATCH_PENALTY;
      return {course, similarity, score, levelMismatch};
    })
    .sort((a, b) => b.score - a.score);
}
