export const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_RANK: Record<Level, number> = {
  BEGINNER: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
};

export const ITEM_TYPES = ['COURSE', 'PROJECT', 'ASSESSMENT'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** Noun to use in generated copy/prompts for a given item type — e.g.
 * lib/explain.ts's "why this ___" framing. */
export function nounForItemType(
  type: ItemType,
): 'course' | 'project' | 'assessment' {
  if (type === 'PROJECT') return 'project';
  if (type === 'ASSESSMENT') return 'assessment';
  return 'course';
}

/** The subset of a Course row the pure logic in lib/recommend.ts and
 * lib/prereq-graph.ts needs — kept independent of Prisma's generated types so
 * these modules stay unit-testable without a database. */
export type CourseLike = {
  id: string;
  title: string;
  level: Level;
  prerequisites: string[];
  embedding: number[];
};
