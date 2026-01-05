// Vectorize helper: stores embeddings of previous turns and retrieves relevant context

export interface EnvWithVector {
  VEC: VectorizeIndex;
}

export async function upsertMemory(
  env: EnvWithVector,
  sessionId: string,
  text: string,
  idSuffix: string
) {
  const id = `${sessionId}:${idSuffix}:${Date.now()}`;
  // Using Workers AI embeddings model
  // If your environment differs, replace with an embeddings model you have enabled
  const embedding = await (env as any).AI.run("@cf/baai/bge-base-en-v1.5", { text });

  await env.VEC.upsert([
    {
      id,
      values: embedding.data?.[0] ?? embedding,
      metadata: { sessionId, text },
    },
  ]);

  return id;
}

export async function queryMemory(
  env: EnvWithVector,
  sessionId: string,
  query: string,
  topK = 3
) {
  const embedding = await (env as any).AI.run("@cf/baai/bge-base-en-v1.5", { text: query });

  const res = await env.VEC.query(embedding.data?.[0] ?? embedding, {
    topK,
    filter: { sessionId },
  });

  const matches = res.matches ?? [];
  return matches
    .map((m: any) => m.metadata?.text)
    .filter(Boolean)
    .slice(0, topK);
}
