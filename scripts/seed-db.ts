import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {db} from '../lib/db';

/**
 * Fast, deterministic DB seed — reads the already-generated
 * data/courses.seed.json (see scripts/generate-course-catalog.ts) and upserts
 * it into the database. No LLM or embedding computation happens here, which
 * is what makes this safe to run at deploy time without an Ollama dependency
 * (docs/TRD.md §7).
 */

const SEED_PATH = path.resolve(
  import.meta.dirname,
  '../data/courses.seed.json',
);

const levelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);

const seedCourseSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  level: levelSchema,
  description: z.string(),
  skillsTaught: z.array(z.string()),
  prerequisites: z.array(z.string()),
  embedding: z.array(z.number()),
});

async function main() {
  const raw = await readFile(SEED_PATH, 'utf-8');
  const courses = z.array(seedCourseSchema).parse(JSON.parse(raw));

  const validIds = new Set(courses.map(c => c.id));
  for (const course of courses) {
    const badPrereq = course.prerequisites.filter(id => !validIds.has(id));
    if (badPrereq.length > 0) {
      throw new Error(
        `Course "${course.id}" references unknown prerequisite id(s): ${badPrereq.join(', ')}`,
      );
    }
  }

  for (const course of courses) {
    await db.course.upsert({
      where: {id: course.id},
      create: {
        id: course.id,
        title: course.title,
        category: course.category,
        description: course.description,
        level: course.level,
        skillsTaught: JSON.stringify(course.skillsTaught),
        prerequisites: JSON.stringify(course.prerequisites),
        embedding: JSON.stringify(course.embedding),
      },
      update: {
        title: course.title,
        category: course.category,
        description: course.description,
        level: course.level,
        skillsTaught: JSON.stringify(course.skillsTaught),
        prerequisites: JSON.stringify(course.prerequisites),
        embedding: JSON.stringify(course.embedding),
      },
    });
  }

  console.log(`Seeded ${courses.length} courses.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
