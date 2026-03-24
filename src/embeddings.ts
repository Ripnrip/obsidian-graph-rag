import { requestUrl } from "obsidian";
import { VaultNode } from "./vaultParser";

export interface EmbeddingStore {
  [path: string]: {
    embedding: number[];
    hash: string; // content hash to detect changes
  };
}

/**
 * Simple string hash for change detection.
 */
export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generate embeddings for a batch of texts using OpenAI API.
 */
export async function generateEmbeddings(
  texts: string[],
  apiKey: string,
  model: string = "text-embedding-3-small"
): Promise<number[][]> {
  // Truncate texts to avoid token limits
  const truncated = texts.map((t) => t.slice(0, 8000));

  const response = await requestUrl({
    url: "https://api.openai.com/v1/embeddings",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: truncated,
      model: model,
    }),
  });

  const data = response.json;
  if (!data.data) {
    throw new Error(`Embedding API error: ${JSON.stringify(data)}`);
  }

  // Sort by index to ensure correct order
  const sorted = data.data.sort(
    (a: { index: number }, b: { index: number }) => a.index - b.index
  );
  return sorted.map((item: { embedding: number[] }) => item.embedding);
}

/**
 * Build or update the embedding store for vault nodes.
 * Only re-embeds notes whose content has changed.
 */
export async function buildEmbeddingStore(
  nodes: VaultNode[],
  existingStore: EmbeddingStore,
  apiKey: string,
  model: string = "text-embedding-3-small",
  onProgress?: (current: number, total: number) => void
): Promise<EmbeddingStore> {
  const store: EmbeddingStore = { ...existingStore };
  const toEmbed: { node: VaultNode; text: string }[] = [];

  for (const node of nodes) {
    const hash = hashContent(node.content);
    if (store[node.path] && store[node.path].hash === hash) {
      continue; // Already embedded and unchanged
    }
    // Prepare text: include name, tags, and content
    const text = `# ${node.name}\nTags: ${node.tags.join(", ")}\n\n${node.content}`;
    toEmbed.push({ node, text });
  }

  // Batch embed in groups of 20
  const batchSize = 20;
  for (let i = 0; i < toEmbed.length; i += batchSize) {
    const batch = toEmbed.slice(i, i + batchSize);
    const texts = batch.map((b) => b.text);

    try {
      const embeddings = await generateEmbeddings(texts, apiKey, model);
      for (let j = 0; j < batch.length; j++) {
        const { node } = batch[j];
        store[node.path] = {
          embedding: embeddings[j],
          hash: hashContent(node.content),
        };
      }
    } catch (e) {
      console.error("Embedding batch failed:", e);
      throw e;
    }

    if (onProgress) {
      onProgress(Math.min(i + batchSize, toEmbed.length), toEmbed.length);
    }
  }

  // Remove entries for deleted notes
  const validPaths = new Set(nodes.map((n) => n.path));
  for (const path of Object.keys(store)) {
    if (!validPaths.has(path)) {
      delete store[path];
    }
  }

  return store;
}

/**
 * Find top-K most similar notes to a query embedding.
 */
export function vectorSearch(
  queryEmbedding: number[],
  store: EmbeddingStore,
  topK: number = 5
): { path: string; score: number }[] {
  const results: { path: string; score: number }[] = [];

  for (const [path, entry] of Object.entries(store)) {
    const score = cosineSimilarity(queryEmbedding, entry.embedding);
    results.push({ path, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}
