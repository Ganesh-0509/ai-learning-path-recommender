import {
  pipeline,
  type FeatureExtractionPipeline,
} from '@huggingface/transformers';

/**
 * Local sentence-embedding model — runs in-process, no network call after the
 * model weights are cached on first use. Used for both catalog seeding and
 * runtime recommendation matching (docs/TRD.md §4.1).
 */

let extractorPromise: Promise<FeatureExtractionPipeline> | undefined;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    const model = process.env.EMBEDDING_MODEL ?? 'Xenova/all-MiniLM-L6-v2';
    extractorPromise = pipeline('feature-extraction', model);
  }
  return extractorPromise;
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, {pooling: 'mean', normalize: true});
  return Array.from(output.data as Float32Array);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  // Both vectors are already normalized (pooling+normalize above), so cosine
  // similarity reduces to the dot product.
  return dot;
}
