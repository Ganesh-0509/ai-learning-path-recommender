import 'dotenv/config';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {mineCourses} from './lib/mine-train-csv';
import {categoryFor} from './lib/course-categories';
import {slugify} from './lib/slugify';
import {chatStructured} from '../lib/llm';
import {embed} from '../lib/embeddings';

/**
 * One-time (rerun-on-demand) build tool: mines the Round 1 dataset, runs a
 * local-LLM pass per category to judge each course's level/description/
 * skills, builds the prerequisite graph deterministically, computes
 * embeddings, and writes the result to data/courses.seed.json.
 *
 * Deliberately NOT run at deploy time — see docs/TRD.md §7 and the note at
 * the bottom of this file for why catalog generation and DB seeding are two
 * separate scripts.
 */

const TRAIN_CSV = path.resolve(
  import.meta.dirname,
  '../archive_2026-08-25/train.csv',
);
const OUTPUT_PATH = path.resolve(
  import.meta.dirname,
  '../data/courses.seed.json',
);

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
const LEVEL_RANK: Record<(typeof LEVELS)[number], number> = {
  BEGINNER: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
};

const courseMetadataSchema = z.object({
  id: z.string(),
  level: z.enum(LEVELS),
  description: z.string().min(10).max(400),
  skillsTaught: z.array(z.string().min(1)).min(3).max(6),
});

const categoryResponseSchema = z.object({
  courses: z.array(courseMetadataSchema),
});

type CourseMetadata = z.infer<typeof courseMetadataSchema>;

type SeededCourse = CourseMetadata & {
  title: string;
  category: string;
  prerequisites: string[];
  embedding: number[];
};

function buildJsonSchema(courseIds: string[]) {
  return {
    type: 'object',
    properties: {
      courses: {
        type: 'array',
        minItems: courseIds.length,
        maxItems: courseIds.length,
        items: {
          type: 'object',
          properties: {
            id: {type: 'string', enum: courseIds},
            level: {type: 'string', enum: LEVELS},
            description: {type: 'string'},
            skillsTaught: {
              type: 'array',
              items: {type: 'string'},
              minItems: 3,
              maxItems: 6,
            },
          },
          required: ['id', 'level', 'description', 'skillsTaught'],
        },
      },
    },
    required: ['courses'],
  };
}

async function classifyCategory(
  category: string,
  courses: {id: string; title: string; sampleReviews: string[]}[],
): Promise<CourseMetadata[]> {
  const courseIds = courses.map(c => c.id);
  const coursesBlock = courses
    .map(
      c =>
        `- id: ${c.id}\n  title: ${c.title}\n  sample review excerpts: ${c.sampleReviews
          .map(r => r.slice(0, 220))
          .join(' | ')}`,
    )
    .join('\n');

  const result = await chatStructured(
    [
      {
        role: 'system',
        content:
          'You are a curriculum designer building an online course catalog. ' +
          'For each course, output a neutral factual description (not review ' +
          'tone — never say "I" or "the reviewer"), a difficulty level relative ' +
          'to the OTHER courses in the same category, and 3-6 concrete ' +
          'skills/topics it teaches. Reply with JSON only, matching the schema.',
      },
      {
        role: 'user',
        content:
          `Category: ${category}\n\n` +
          'Assign BEGINNER/INTERMEDIATE/ADVANCED relative to each other within ' +
          "this category (it's fine for multiple courses to share a level if " +
          `they're genuinely at the same depth). Courses:\n\n${coursesBlock}`,
      },
    ],
    buildJsonSchema(courseIds),
    categoryResponseSchema,
    {temperature: 0.2},
  );

  const returnedIds = new Set(result.courses.map(c => c.id));
  const missing = courseIds.filter(id => !returnedIds.has(id));
  if (missing.length > 0) {
    throw new Error(
      `LLM response for category "${category}" is missing courses: ${missing.join(', ')}`,
    );
  }

  return result.courses;
}

function buildPrerequisites(
  coursesInCategory: {id: string; level: CourseMetadata['level']}[],
): Map<string, string[]> {
  const byLevel = new Map<number, string[]>();
  for (const course of coursesInCategory) {
    const rank = LEVEL_RANK[course.level];
    const bucket = byLevel.get(rank) ?? [];
    bucket.push(course.id);
    byLevel.set(rank, bucket);
  }

  const prerequisites = new Map<string, string[]>();
  for (const course of coursesInCategory) {
    const rank = LEVEL_RANK[course.level];
    // Walk down to the nearest non-empty lower tier so an ADVANCED course in a
    // category with no INTERMEDIATE entry still gets a sensible prerequisite.
    let lowerRank = rank - 1;
    while (lowerRank >= 0 && !byLevel.get(lowerRank)?.length) {
      lowerRank--;
    }
    const lowerTier = lowerRank >= 0 ? (byLevel.get(lowerRank) ?? []) : [];
    prerequisites.set(course.id, lowerTier.slice(0, 2));
  }
  return prerequisites;
}

async function main() {
  console.log(`Mining courses from ${TRAIN_CSV} ...`);
  const mined = await mineCourses(TRAIN_CSV);
  console.log(`Found ${mined.length} unique courses.`);

  const withIds = mined.map(course => ({
    ...course,
    id: slugify(course.title),
    category: categoryFor(course.title),
  }));

  const byCategory = new Map<string, typeof withIds>();
  for (const course of withIds) {
    const bucket = byCategory.get(course.category) ?? [];
    bucket.push(course);
    byCategory.set(course.category, bucket);
  }

  const metadataById = new Map<string, CourseMetadata>();
  for (const [category, courses] of byCategory) {
    console.log(
      `Classifying category "${category}" (${courses.length} courses) ...`,
    );
    const results = await classifyCategory(category, courses);
    for (const result of results) {
      metadataById.set(result.id, result);
    }
  }

  const seeded: SeededCourse[] = [];
  for (const [category, courses] of byCategory) {
    const levels = courses.map(c => {
      const metadata = metadataById.get(c.id);
      if (!metadata) {
        throw new Error(`Missing LLM metadata for course id "${c.id}"`);
      }
      return {id: c.id, level: metadata.level};
    });
    const prerequisites = buildPrerequisites(levels);

    for (const course of courses) {
      const metadata = metadataById.get(course.id);
      if (!metadata) {
        throw new Error(`Missing LLM metadata for course id "${course.id}"`);
      }
      const embeddingText = `${course.title}. ${metadata.description} Skills: ${metadata.skillsTaught.join(', ')}.`;
      console.log(`Embedding "${course.title}" ...`);
      const embedding = await embed(embeddingText);

      seeded.push({
        ...metadata,
        title: course.title,
        category,
        prerequisites: prerequisites.get(course.id) ?? [],
        embedding,
      });
    }
  }

  seeded.sort((a, b) => a.title.localeCompare(b.title));
  await writeFile(OUTPUT_PATH, JSON.stringify(seeded, null, 2));
  console.log(`Wrote ${seeded.length} courses to ${OUTPUT_PATH}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
