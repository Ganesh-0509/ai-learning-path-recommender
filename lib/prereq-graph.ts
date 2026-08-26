import type {CourseLike} from './types';

export type Milestone = {
  title: string;
  courseIds: string[];
};

const MILESTONE_TITLES = ['Foundations', 'Core Skill', 'Applied Practice'];

function titleForDepth(depth: number): string {
  return MILESTONE_TITLES[Math.min(depth, MILESTONE_TITLES.length - 1)];
}

/**
 * Walks prerequisite chains outward from `selectedIds` and returns the full
 * set including every prerequisite (recursively) — so a recommended course
 * never appears in a path without the courses it depends on (SRS FR-4.1,
 * TRD §4.2 step 2).
 */
export function expandWithPrerequisites(
  selectedIds: readonly string[],
  courseById: ReadonlyMap<string, CourseLike>,
): Set<string> {
  const expanded = new Set<string>();
  const stack = [...selectedIds];

  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || expanded.has(id)) {
      continue;
    }
    const course = courseById.get(id);
    if (!course) {
      throw new Error(`expandWithPrerequisites: unknown course id "${id}"`);
    }
    expanded.add(id);
    for (const prereqId of course.prerequisites) {
      if (!expanded.has(prereqId)) {
        stack.push(prereqId);
      }
    }
  }

  return expanded;
}

/**
 * Kahn's-algorithm topological sort over the given id set, restricted to
 * prerequisite edges that stay within that set (SRS FR-4.2). Throws on a
 * cycle rather than silently returning a partial/wrong order — a cycle would
 * mean a bug in prerequisite generation, not something to paper over here.
 */
export function topologicalSort(
  ids: readonly string[],
  courseById: ReadonlyMap<string, CourseLike>,
): string[] {
  const idSet = new Set(ids);
  const inDegree = new Map<string, number>(ids.map(id => [id, 0]));
  const dependents = new Map<string, string[]>(ids.map(id => [id, []]));

  for (const id of ids) {
    const course = courseById.get(id);
    if (!course) {
      throw new Error(`topologicalSort: unknown course id "${id}"`);
    }
    for (const prereqId of course.prerequisites) {
      if (!idSet.has(prereqId)) {
        continue; // prerequisite outside the requested set — not this call's concern
      }
      inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
      dependents.get(prereqId)?.push(id);
    }
  }

  const queue = ids.filter(id => inDegree.get(id) === 0);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;
    sorted.push(id);
    for (const dependentId of dependents.get(id) ?? []) {
      const remaining = (inDegree.get(dependentId) ?? 0) - 1;
      inDegree.set(dependentId, remaining);
      if (remaining === 0) {
        queue.push(dependentId);
      }
    }
  }

  if (sorted.length !== ids.length) {
    throw new Error(
      'topologicalSort: cycle detected in prerequisite graph among ' +
        `[${ids.join(', ')}] — this indicates a data bug, not a valid path.`,
    );
  }

  return sorted;
}

/**
 * Groups a topologically-sorted id list into milestones by graph depth
 * (longest prerequisite-chain distance from a root in this set) — TRD §4.2
 * step 4.
 */
export function groupIntoMilestones(
  sortedIds: readonly string[],
  courseById: ReadonlyMap<string, CourseLike>,
): Milestone[] {
  const idSet = new Set(sortedIds);
  const depth = new Map<string, number>();

  for (const id of sortedIds) {
    const course = courseById.get(id);
    if (!course) {
      throw new Error(`groupIntoMilestones: unknown course id "${id}"`);
    }
    const prereqDepths = course.prerequisites
      .filter(prereqId => idSet.has(prereqId))
      .map(prereqId => (depth.get(prereqId) ?? 0) + 1);
    depth.set(id, prereqDepths.length > 0 ? Math.max(...prereqDepths) : 0);
  }

  // Bucket by CLAMPED depth, not raw depth — titleForDepth already clamps
  // anything past MILESTONE_TITLES.length-1 to the same title text, so
  // bucketing by raw depth would otherwise produce two separate milestone
  // entries both titled "Applied Practice" instead of one merged milestone
  // (only reachable once something has a 3+-deep chain — e.g. a generated
  // PROJECT depending on a course whose own chain is already 2 deep; see
  // tests/unit/prereq-graph.test.ts).
  const byDepth = new Map<number, string[]>();
  for (const id of sortedIds) {
    const d = Math.min(depth.get(id) ?? 0, MILESTONE_TITLES.length - 1);
    const bucket = byDepth.get(d) ?? [];
    bucket.push(id);
    byDepth.set(d, bucket);
  }

  return [...byDepth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([d, courseIds]) => ({title: titleForDepth(d), courseIds}));
}

/**
 * Full path-generation pipeline: expand → sort → group (TRD §4.2).
 */
export function buildPath(
  recommendedIds: readonly string[],
  courseById: ReadonlyMap<string, CourseLike>,
): Milestone[] {
  const expanded = expandWithPrerequisites(recommendedIds, courseById);
  const sorted = topologicalSort([...expanded], courseById);
  return groupIntoMilestones(sorted, courseById);
}
