export const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_RANK: Record<Level, number> = {
  BEGINNER: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
};

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
