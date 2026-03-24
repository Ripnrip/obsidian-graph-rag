import { requestUrl } from "obsidian";
import { VaultGraph, VaultNode, graphTraversal } from "./vaultParser";
import {
  EmbeddingStore,
  generateEmbeddings,
  vectorSearch,
} from "./embeddings";

export interface RAGResult {
  answer: string;
  relevantNodes: number[]; // node indices that were used as context
  vectorHits: number[]; // nodes found via vector search
  graphHits: number[]; // additional nodes found via graph traversal
}

/**
 * Perform Graph RAG: vector search + graph traversal + LLM generation.
 */
export async function queryGraphRAG(
  query: string,
  graph: VaultGraph,
  embeddingStore: EmbeddingStore,
  apiKey: string,
  options: {
    embeddingModel?: string;
    chatModel?: string;
    topK?: number;
    graphHops?: number;
    maxContextLength?: number;
    systemPrompt?: string;
  } = {}
): Promise<RAGResult> {
  const {
    embeddingModel = "text-embedding-3-small",
    chatModel = "gpt-4.1-mini",
    topK = 5,
    graphHops = 2,
    maxContextLength = 12000,
    systemPrompt = "You are a knowledgeable assistant that answers questions based on the user's personal notes. Use the provided context from their knowledge base to give accurate, helpful answers. Always reference which notes your information comes from.",
  } = options;

  // Step 1: Embed the query
  const [queryEmbedding] = await generateEmbeddings([query], apiKey, embeddingModel);

  // Step 2: Vector search for most similar notes
  const vectorResults = vectorSearch(queryEmbedding, embeddingStore, topK);
  const vectorHits: number[] = [];
  for (const result of vectorResults) {
    const idx = graph.nodeMap.get(result.path);
    if (idx !== undefined) {
      vectorHits.push(idx);
    }
  }

  // Step 3: Graph traversal from vector hits
  const graphExpanded = graphTraversal(graph.adjacency, vectorHits, graphHops);
  const graphHits: number[] = [];
  for (const idx of graphExpanded) {
    if (!vectorHits.includes(idx)) {
      graphHits.push(idx);
    }
  }

  // Step 4: Assemble context (prioritize vector hits, then graph neighbors)
  const allRelevant = [...vectorHits, ...graphHits];
  let context = "";
  const usedNodes: number[] = [];

  // Add vector hits first (most relevant)
  for (const idx of vectorHits) {
    const node = graph.nodes[idx];
    const snippet = truncateContent(node, 2000);
    if (context.length + snippet.length > maxContextLength) break;
    context += snippet;
    usedNodes.push(idx);
  }

  // Add graph-traversed nodes (contextually related)
  for (const idx of graphHits) {
    const node = graph.nodes[idx];
    const snippet = truncateContent(node, 800);
    if (context.length + snippet.length > maxContextLength) break;
    context += snippet;
    usedNodes.push(idx);
  }

  // Step 5: Call LLM
  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Here is context from my knowledge base:\n\n${context}\n\n---\n\nQuestion: ${query}`,
    },
  ];

  const response = await requestUrl({
    url: "https://api.openai.com/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: chatModel,
      messages: messages,
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  const data = response.json;
  const answer =
    data.choices?.[0]?.message?.content || "Sorry, I could not generate an answer.";

  return {
    answer,
    relevantNodes: usedNodes,
    vectorHits,
    graphHits,
  };
}

function truncateContent(node: VaultNode, maxLen: number): string {
  const header = `\n---\n📄 **${node.name}** (${node.path})\nTags: ${node.tags.join(", ") || "none"}\nLinks to: ${node.links.map((l) => l.replace(/\.md$/, "")).join(", ") || "none"}\n\n`;
  const content = node.content.length > maxLen
    ? node.content.slice(0, maxLen) + "..."
    : node.content;
  return header + content + "\n";
}
