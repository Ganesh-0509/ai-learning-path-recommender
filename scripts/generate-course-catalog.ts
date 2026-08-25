import 'dotenv/config';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {mineCourses} from './lib/mine-train-csv';
import {categoryFor} from './lib/course-categories';
import {slugify} from './lib/slugify';
import {chatStructured} from '../lib/llm';
import {embed, cosineSimilarity} from '../lib/embeddings';

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

// Deliberately NOT enum-constraining `id` against the batch's course ids: an
// enum repeated inside a fixed-length array item schema turned out to make
// Ollama's CPU-side constrained decoding pathologically slow — it hung the
// server outright on a 13-course batch (see PLAN.md §8). We validate the
// returned ids against the expected set in code instead (classifyCategory
// below), which is just as strict without the grammar blowup.
function buildJsonSchema(itemCount: number) {
  return {
    type: 'object',
    properties: {
      courses: {
        type: 'array',
        minItems: itemCount,
        maxItems: itemCount,
        items: {
          type: 'object',
          properties: {
            id: {type: 'string'},
            level: {type: 'string', enum: LEVELS},
            description: {type: 'string'},
            skillsTaught: {
              type: 'array',
              items: {type: 'string'},
              minItems: 3,
              maxItems: 5,
            },
          },
          required: ['id', 'level', 'description', 'skillsTaught'],
        },
      },
    },
    required: ['courses'],
  };
}

/** Small batches keep each LLM call's prompt/response — and its JSON Schema
 * grammar — cheap, which is what actually keeps CPU-bound Ollama responsive. */
const BATCH_SIZE = 4;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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
    buildJsonSchema(courseIds.length),
    categoryResponseSchema,
    {temperature: 0.2, timeoutMs: 90_000},
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

/**
 * Picks prerequisites from the nearest non-empty lower level tier *within the
 * same category*, ranked by embedding similarity to the course itself — not
 * an arbitrary first-N pick.
 *
 * Category alone isn't a fine enough grouping: "Programming Fundamentals"
 * spans Python, JavaScript, C++, Go, etc., so a first-N pick was assigning
 * "Advanced Python Development" a prerequisite of "Modern JavaScript ES6
 * Plus" — same category, wrong subject. Embedding similarity naturally
 * clusters same-subject courses together even inside one coarse category,
 * without hand-splitting every category by language (PLAN.md §8).
 */
function buildPrerequisites(
  coursesInCategory: {id: string; level: CourseMetadata['level']}[],
  embeddingById: ReadonlyMap<string, number[]>,
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
    let lowerRank = rank - 1;
    while (lowerRank >= 0 && !byLevel.get(lowerRank)?.length) {
      lowerRank--;
    }
    const lowerTier = lowerRank >= 0 ? (byLevel.get(lowerRank) ?? []) : [];

    const courseEmbedding = embeddingById.get(course.id);
    if (!courseEmbedding) {
      throw new Error(`Missing embedding for course id "${course.id}"`);
    }
    const ranked = lowerTier
      .map(candidateId => {
        const candidateEmbedding = embeddingById.get(candidateId);
        if (!candidateEmbedding) {
          throw new Error(`Missing embedding for course id "${candidateId}"`);
        }
        return {
          id: candidateId,
          similarity: cosineSimilarity(courseEmbedding, candidateEmbedding),
        };
      })
      .sort((a, b) => b.similarity - a.similarity);

    prerequisites.set(
      course.id,
      ranked.slice(0, 2).map(r => r.id),
    );
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
    const batches = chunk(courses, BATCH_SIZE);
    console.log(
      `Classifying category "${category}" (${courses.length} courses, ` +
        `${batches.length} batch(es) of up to ${BATCH_SIZE}) ...`,
    );
    for (const [i, batch] of batches.entries()) {
      console.log(`  batch ${i + 1}/${batches.length} ...`);
      const results = await classifyCategory(category, batch);
      for (const result of results) {
        metadataById.set(result.id, result);
      }
    }
  }

  // Embeddings are computed before prerequisites — buildPrerequisites needs
  // them to rank same-category candidates by subject relevance.
  const embeddingById = new Map<string, number[]>();
  for (const course of withIds) {
    const metadata = metadataById.get(course.id);
    if (!metadata) {
      throw new Error(`Missing LLM metadata for course id "${course.id}"`);
    }
    const embeddingText = `${course.title}. ${metadata.description} Skills: ${metadata.skillsTaught.join(', ')}.`;
    console.log(`Embedding "${course.title}" ...`);
    embeddingById.set(course.id, await embed(embeddingText));
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
    const prerequisites = buildPrerequisites(levels, embeddingById);

    for (const course of courses) {
      const metadata = metadataById.get(course.id);
      if (!metadata) {
        throw new Error(`Missing LLM metadata for course id "${course.id}"`);
      }
      const embedding = embeddingById.get(course.id);
      if (!embedding) {
        throw new Error(`Missing embedding for course id "${course.id}"`);
      }

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
