import {createReadStream} from 'node:fs';
import {parse} from 'csv-parse';

export type MinedCourse = {
  title: string;
  reviewCount: number;
  /** Up to 3 sample reviews, used as grounding context for the LLM metadata pass. */
  sampleReviews: string[];
};

const SAMPLES_PER_COURSE = 3;

/**
 * Streams Round 1's train.csv and groups reviews by course title — reused
 * for its realistic course-name/topic vocabulary as the catalog seed, since
 * no licensed real course catalog was available for this submission.
 */
export async function mineCourses(csvPath: string): Promise<MinedCourse[]> {
  const byTitle = new Map<string, MinedCourse>();

  const parser = createReadStream(csvPath).pipe(
    parse({columns: true, skip_empty_lines: true}),
  );

  for await (const record of parser as AsyncIterable<Record<string, string>>) {
    const title = record.Course?.trim();
    const review = record.Reviews?.trim();
    if (!title || !review) {
      continue;
    }

    let entry = byTitle.get(title);
    if (!entry) {
      entry = {title, reviewCount: 0, sampleReviews: []};
      byTitle.set(title, entry);
    }
    entry.reviewCount++;
    if (entry.sampleReviews.length < SAMPLES_PER_COURSE) {
      entry.sampleReviews.push(review);
    }
  }

  return [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title));
}
