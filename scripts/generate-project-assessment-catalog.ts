import 'dotenv/config';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {slugify} from './lib/slugify';
import {chatStructured} from '../lib/llm';
import {embed, cosineSimilarity} from '../lib/embeddings';

/**
 * One-time (rerun-on-demand) build tool: adds one capstone PROJECT and one
 * checkpoint ASSESSMENT per existing course category, closing the brief's
 * "courses, projects and assessments" requirement. Deliberately derives
 * entirely from the already-generated data/courses.seed.json — no
 * archive_2026-08-25/train.csv dependency, unlike
 * scripts/generate-course-catalog.ts, since category/course data already
 * exists to ground these on.
 *
 * Rerunning this script is safe: it always regenerates PROJECT/ASSESSMENT
 * rows fresh from the current COURSE rows rather than accumulating them.
 */

const SEED_PATH = path.resolve(
  import.meta.dirname,
  '../data/courses.seed.json',
);

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
const LEVEL_RANK: Record<(typeof LEVELS)[number], number> = {
  BEGINNER: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
};

const seedCourseSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['COURSE', 'PROJECT', 'ASSESSMENT']).default('COURSE'),
  category: z.string(),
  level: z.enum(LEVELS),
  description: z.string(),
  skillsTaught: z.array(z.string()),
  prerequisites: z.array(z.string()),
  embedding: z.array(z.number()),
});

type SeedCourse = z.infer<typeof seedCourseSchema>;

const itemMetadataSchema = z.object({
  title: z.string(),
  description: z.string().min(10).max(400),
  skillsTaught: z.array(z.string().min(1)).min(3).max(6),
});

const categoryResponseSchema = z.object({
  project: itemMetadataSchema,
  assessment: itemMetadataSchema,
});

const CATEGORY_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    project: {
      type: 'object',
      properties: {
        title: {type: 'string'},
        description: {type: 'string'},
        skillsTaught: {
          type: 'array',
          items: {type: 'string'},
          minItems: 3,
          maxItems: 5,
        },
      },
      required: ['title', 'description', 'skillsTaught'],
    },
    assessment: {
      type: 'object',
      properties: {
        title: {type: 'string'},
        description: {type: 'string'},
        skillsTaught: {
          type: 'array',
          items: {type: 'string'},
          minItems: 3,
          maxItems: 5,
        },
      },
      required: ['title', 'description', 'skillsTaught'],
    },
  },
  required: ['project', 'assessment'],
};

async function generateForCategory(
  category: string,
  courses: SeedCourse[],
): Promise<z.infer<typeof categoryResponseSchema>> {
  const coursesBlock = courses
    .map(
      c =>
        `- ${c.title} (${c.level}): ${c.skillsTaught.slice(0, 4).join(', ')}`,
    )
    .join('\n');

  return chatStructured(
    [
      {
        role: 'system',
        content:
          'You are a curriculum designer adding one capstone project and ' +
          'one checkpoint assessment to an existing course category. Ground ' +
          "both in the category's existing course titles/skills below — do " +
          'not invent an unrelated subject. The project is a hands-on build ' +
          'that applies several of the category skills together; the ' +
          'assessment is a short skill-check, not a full exam. Give each a ' +
          'concrete, specific title (not "Category Project"/"Category ' +
          'Assessment"), a neutral factual description, and 3-6 skills it ' +
          'covers. Reply with JSON only, matching the schema.',
      },
      {
        role: 'user',
        content: `Category: ${category}\n\nExisting courses:\n${coursesBlock}`,
      },
    ],
    CATEGORY_RESPONSE_JSON_SCHEMA,
    categoryResponseSchema,
    {temperature: 0.3, timeoutMs: 90_000},
  );
}

/** Ranks `candidates` by embedding similarity to `targetEmbedding`,
 * descending — same technique as generate-course-catalog.ts's
 * buildPrerequisites, just parameterized over an arbitrary candidate list. */
function rankBySimilarity(
  targetEmbedding: number[],
  candidates: {id: string; embedding: number[]}[],
): string[] {
  return candidates
    .map(c => ({
      id: c.id,
      similarity: cosineSimilarity(targetEmbedding, c.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .map(c => c.id);
}

async function main() {
  const raw = await readFile(SEED_PATH, 'utf-8');
  const allSeeded = z.array(seedCourseSchema).parse(JSON.parse(raw));

  // Regenerate fresh each run: keep only the base courses, drop any
  // previously-generated project/assessment rows.
  const baseCourses = allSeeded.filter(c => c.type === 'COURSE');

  const byCategory = new Map<string, SeedCourse[]>();
  for (const course of baseCourses) {
    const bucket = byCategory.get(course.category) ?? [];
    bucket.push(course);
    byCategory.set(course.category, bucket);
  }

  const newItems: SeedCourse[] = [];

  for (const [category, courses] of byCategory) {
    console.log(`Generating project + assessment for "${category}" ...`);
    const {project, assessment} = await generateForCategory(category, courses);

    const projectId = `${slugify(project.title)}-project`;
    const assessmentId = `${slugify(assessment.title)}-assessment`;

    console.log(`  Embedding "${project.title}" ...`);
    const projectEmbedding = await embed(
      `${project.title}. ${project.description} Skills: ${project.skillsTaught.join(', ')}.`,
    );
    console.log(`  Embedding "${assessment.title}" ...`);
    const assessmentEmbedding = await embed(
      `${assessment.title}. ${assessment.description} Skills: ${assessment.skillsTaught.join(', ')}.`,
    );

    // Level: deterministic, not LLM-judged — matches how category/
    // prerequisites are already deterministic elsewhere in the pipeline.
    const categoryLevels = courses.map(c => LEVEL_RANK[c.level]);
    const projectLevel = LEVELS[Math.max(...categoryLevels)] ?? 'INTERMEDIATE';
    const assessmentLevel = LEVELS[Math.min(...categoryLevels)] ?? 'BEGINNER';

    // Project prerequisites: the category's own courses, ranked by
    // similarity to the project itself, top 2 (same convention as
    // course-to-course prerequisites) — this is what naturally lands the
    // project in a late milestone tier via groupIntoMilestones' depth-based
    // grouping, with zero changes to that function.
    const projectPrereqs = rankBySimilarity(
      projectEmbedding,
      courses.map(c => ({id: c.id, embedding: c.embedding})),
    ).slice(0, 2);

    // Assessment prerequisites: a single early checkpoint — the category's
    // lowest-level course, tie-broken by similarity to the assessment.
    const lowestRank = Math.min(...categoryLevels);
    const lowestTierCourses = courses.filter(
      c => LEVEL_RANK[c.level] === lowestRank,
    );
    const assessmentPrereqs = rankBySimilarity(
      assessmentEmbedding,
      lowestTierCourses.map(c => ({id: c.id, embedding: c.embedding})),
    ).slice(0, 1);

    newItems.push({
      id: projectId,
      title: project.title,
      type: 'PROJECT',
      category,
      level: projectLevel,
      description: project.description,
      skillsTaught: project.skillsTaught,
      prerequisites: projectPrereqs,
      embedding: projectEmbedding,
    });
    newItems.push({
      id: assessmentId,
      title: assessment.title,
      type: 'ASSESSMENT',
      category,
      level: assessmentLevel,
      description: assessment.description,
      skillsTaught: assessment.skillsTaught,
      prerequisites: assessmentPrereqs,
      embedding: assessmentEmbedding,
    });
  }

  const merged = [...baseCourses, ...newItems].sort((a, b) =>
    a.title.localeCompare(b.title),
  );
  await writeFile(SEED_PATH, JSON.stringify(merged, null, 2));
  console.log(
    `Wrote ${merged.length} items to ${SEED_PATH} ` +
      `(${baseCourses.length} courses + ${newItems.length} new project/assessment items).`,
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
