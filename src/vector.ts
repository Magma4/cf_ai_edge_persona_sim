/**
 * Vectorize helpers - Give the agent "memory" using semantic search
 *
 * How it works:
 * 1. Convert text to embeddings using Workers AI
 * 2. Store embeddings in Vectorize (vector database)
 * 3. Later, search for similar text using cosine similarity
 *
 * This lets the agent remember context across sessions without
 * storing every single message in SQL.
 */

export interface EnvWithVector {
  VEC: VectorizeIndex;
}

/**
 * Store a message in vector memory
 * Each message gets converted to a 768-dimensional embedding
 */
export async function upsertMemory(
  env: EnvWithVector,
  sessionId: string,
  text: string,
  idSuffix: string
) {
  // Create unique ID: session + type + timestamp
  const id = `${sessionId}:${idSuffix}:${Date.now()}`;

  // Convert text to vector embedding using Workers AI
  const embedding = await (env as any).AI.run("@cf/baai/bge-base-en-v1.5", { text });

  // Store in Vectorize with metadata
  await env.VEC.upsert([
    {
      id,
      values: embedding.data?.[0] ?? embedding,
      metadata: { sessionId, text }, // Store original text for retrieval
    },
  ]);

  return id;
}

/**
 * Search for relevant past messages using semantic similarity
 * Returns the actual text of the top K most similar messages
 */
export async function queryMemory(
  env: EnvWithVector,
  sessionId: string,
  query: string,
  topK = 3
) {
  // Convert query to embedding
  const embedding = await (env as any).AI.run("@cf/baai/bge-base-en-v1.5", { text: query });

  // Search Vectorize for similar embeddings (cosine similarity)
  const res = await env.VEC.query(embedding.data?.[0] ?? embedding, {
    topK,
    filter: { sessionId }, // Only search this session's messages
  });

  // Extract the original text from the matches
  const matches = res.matches ?? [];
  return matches
    .map((m: any) => m.metadata?.text)
    .filter(Boolean)
    .slice(0, topK);
}
