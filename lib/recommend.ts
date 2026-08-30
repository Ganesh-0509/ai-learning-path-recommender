import {cosineSimilarity} from './embeddings';
import {LEVEL_RANK, type CourseLike, type ItemType, type Level} from './types';

export type RankedCourse<T extends CourseLike> = {
  course: T;
  similarity: number;
  /** Final ranking score after the level re-weight (docs/TRD.md §4.1 step 4). */
  score: number;
  levelMismatch: boolean;
};

/** A relative (multiplicative) discount, not an absolute subtraction — a flat
 * subtraction penalizes a highly-relevant item by the same absolute amount as
 * a barely-relevant one, which can let a barely-relevant, level-matched item
 * outrank a strongly-relevant, one-tier-off item (observed: a goal centered
 * on "machine learning" ranked "Machine Learning Fundamentals" — one tier
 * off, similarity 0.454 — below an unrelated same-level course at
 * similarity 0.305, so the course never made it into the generated path at
 * all). Scaling the penalty by the item's own similarity keeps a strong
 * match resistant to being buried by a level mismatch, while still ordering
 * an exact-level match above an otherwise-identical mismatched one. */
const LEVEL_MISMATCH_PENALTY = 0.15;
const MIN_LEVEL_RANK = 0;
const MAX_LEVEL_RANK = 2;
/** Smaller than LEVEL_MISMATCH_PENALTY on purpose — a content-type
 * preference should nudge ranking, not dominate actual relevance. Only
 * applied when the learner has explicitly set a preference (never
 * inferred), so its effect on ranking stays predictable and testable. */
const CONTENT_PREFERENCE_BONUS = 0.05;

export type FeedbackCounts = {tooEasy: number; tooHard: number};

/**
 * Derives a level-rank adjustment from a learner's TOO_EASY/TOO_HARD
 * feedback — the adaptive half of SRS FR-4.4/FR-6.5. More TOO_HARD than
 * TOO_EASY nudges future ranking to treat the learner as one tier lower
 * (favoring gentler courses); the reverse nudges up a tier. A tie, or no
 * feedback at all, makes no adjustment. Pure and unit-tested so the
 * heuristic itself stays explainable, not just "the model decided."
 */
export function computeLevelAdjustment(feedback: FeedbackCounts): number {
  if (feedback.tooHard > feedback.tooEasy) return -1;
  if (feedback.tooEasy > feedback.tooHard) return 1;
  return 0;
}

/**
 * Ranks courses by similarity to a learner's goal, filtering out completed
 * courses and penalizing (not excluding) a level mismatch — an ambitious
 * beginner still sees a stretch course, just flagged and ranked lower than an
 * equally-similar course at their level (SRS FR-3.3, FR-3.4). `levelAdjustment`
 * (from computeLevelAdjustment) shifts the effective level used for that
 * comparison, clamped to a valid rank, without changing the learner's stated
 * `level` itself.
 *
 * Generic over T so callers passing a richer course type (e.g. CourseRecord,
 * which also carries display fields) get it back on `course` without a cast.
 */
export function rankCourses<T extends CourseLike>(
  learner: {
    goalEmbedding: number[];
    level: Level;
    levelAdjustment?: number;
    contentPreference?: ItemType | null;
  },
  courses: T[],
  completedCourseIds: ReadonlySet<string>,
): RankedCourse<T>[] {
  const learnerRank = Math.min(
    MAX_LEVEL_RANK,
    Math.max(
      MIN_LEVEL_RANK,
      LEVEL_RANK[learner.level] + (learner.levelAdjustment ?? 0),
    ),
  );

  return courses
    .filter(course => !completedCourseIds.has(course.id))
    .map(course => {
      const similarity = cosineSimilarity(
        learner.goalEmbedding,
        course.embedding,
      );
      const levelDelta = Math.abs(LEVEL_RANK[course.level] - learnerRank);
      const levelMismatch = levelDelta > 0;
      const preferenceBonus =
        learner.contentPreference && course.type === learner.contentPreference
          ? CONTENT_PREFERENCE_BONUS
          : 0;
      const score =
        similarity * (1 - levelDelta * LEVEL_MISMATCH_PENALTY) +
        preferenceBonus;
      return {course, similarity, score, levelMismatch};
    })
    .sort((a, b) => b.score - a.score);
}
