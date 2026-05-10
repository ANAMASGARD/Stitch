import { PINECONE_INDEX_NAME, pinecone, pineconeIndex } from "@/lib/pinecone";
import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";

type CodebaseFile = {
  path: string;
  content: string;
};

type RagMetadata = {
  repoId: string;
  path: string;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  content: string;
};

type PendingChunkMetadata = Omit<RagMetadata, "repoId">;

type RetrievedChunk = {
  score?: number;
  path?: string;
  chunkIndex?: number;
  startOffset?: number;
  endOffset?: number;
  content?: string;
};

type SearchRecordsHit = {
  _score?: number;
  fields?: Record<string, unknown>;
};

type DocumentSearchMatch = Record<string, unknown> & {
  _score?: number;
};

type DocumentSearchResponse = {
  matches?: DocumentSearchMatch[];
};

type IndexCodebaseResult = {
  repoId: string;
  indexedFiles: number;
  chunkCount: number;
  embeddingBatchCount: number;
  upsertBatchCount: number;
  samplePaths: string[];
};

const googleEmbeddingModel = google.embeddingModel("gemini-embedding-2");

const CHUNK_SIZE = 1600;
const CHUNK_OVERLAP = 200;
const EMBEDDING_BATCH_SIZE = 32;
const UPSERT_BATCH_SIZE = 100;
const EMBEDDING_DIMENSIONS = 1024;
const DOCUMENTS_NAMESPACE = "__default__";

let pineconeIndexHostPromise: Promise<string> | null = null;

function formatDocumentForEmbedding(path: string, content: string) {
  return `title: ${path} | text: ${content}`;
}

function formatQueryForEmbedding(query: string) {
  return `task: code retrieval | query: ${query}`;
}

function assertEmbeddingDimension(embedding: number[]) {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`
    );
  }
}

function getPineconeIndexHost() {
  pineconeIndexHostPromise ??= pinecone
    .describeIndex(PINECONE_INDEX_NAME)
    .then((index) => {
      if (!index.host) {
        throw new Error(`Pinecone index ${PINECONE_INDEX_NAME} has no host`);
      }
      return index.host;
    });
  return pineconeIndexHostPromise;
}

function documentSearchTextFromMatch(match: DocumentSearchMatch) {
  for (const key of ["content", "text", "chunk_text", "body"]) {
    const value = match[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}

async function searchDocumentIndex(
  query: string,
  repoId: string,
  topK: number
): Promise<RetrievedChunk[]> {
  const apiKey = process.env.PINECONE_DB_API_KEY;
  if (!apiKey) {
    throw new Error("PINECONE_DB_API_KEY is required for Pinecone document search");
  }

  const host = await getPineconeIndexHost();
  const response = await fetch(
    `https://${host}/namespaces/${DOCUMENTS_NAMESPACE}/documents/search`,
    {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
        "X-Pinecone-Api-Version": "2026-01.alpha",
      },
      body: JSON.stringify({
        include_fields: ["*"],
        score_by: [{ type: "query_string", query }],
        filter: { repoId: { $eq: repoId } },
        top_k: topK,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pinecone documents search failed: ${response.status} ${body}`);
  }

  const results = (await response.json()) as DocumentSearchResponse;
  return (results.matches ?? [])
    .map((match) => ({
      score: match._score,
      path: match.path as string | undefined,
      chunkIndex: match.chunkIndex as number | undefined,
      startOffset: match.startOffset as number | undefined,
      endOffset: match.endOffset as number | undefined,
      content: documentSearchTextFromMatch(match),
    }))
    .filter((match) => Boolean(match.content));
}

export async function generateEmbedding(text: string) {
  const { embedding } = await embed({
    model: googleEmbeddingModel,
    value: formatQueryForEmbedding(text),
    providerOptions: {
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    },
  });

  assertEmbeddingDimension(embedding);

  return embedding;
}

function sanitizeRecordIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function chunkFile(file: CodebaseFile) {
  const fullContent = formatDocumentForEmbedding(file.path, file.content);
  const chunks: Array<{
    id: string;
    text: string;
    metadata: PendingChunkMetadata;
  }> = [];

  let startOffset = 0;
  let chunkIndex = 0;

  while (startOffset < fullContent.length) {
    const endOffset = Math.min(startOffset + CHUNK_SIZE, fullContent.length);
    const chunkText = fullContent.slice(startOffset, endOffset).trim();

    if (chunkText) {
      chunks.push({
        id: `${sanitizeRecordIdPart(file.path)}-${chunkIndex}`,
        text: chunkText,
        metadata: {
          path: file.path,
          chunkIndex,
          startOffset,
          endOffset,
          content: chunkText,
        } satisfies PendingChunkMetadata,
      });
    }

    if (endOffset >= fullContent.length) {
      break;
    }

    startOffset += CHUNK_SIZE - CHUNK_OVERLAP;
    chunkIndex += 1;
  }

  return chunks;
}

export async function indexCodebase(
  repoId: string,
  files: CodebaseFile[]
): Promise<IndexCodebaseResult> {
  let pendingRecords: Array<{
    id: string;
    text: string;
    metadata: PendingChunkMetadata;
  }> = [];
  let chunkCount = 0;
  let embeddingBatchCount = 0;
  let upsertBatchCount = 0;
  const samplePaths = Array.from(
    new Set(files.map((file) => file.path).filter(Boolean))
  ).slice(0, 5);

  const flushPendingRecords = async () => {
    if (pendingRecords.length === 0) {
      return;
    }

    const values = pendingRecords.map((record) => record.text);
    embeddingBatchCount += 1;
    const { embeddings } = await embedMany({
      model: googleEmbeddingModel,
      values,
      providerOptions: {
        google: {
          outputDimensionality: EMBEDDING_DIMENSIONS,
        },
      },
    });

    for (const embedding of embeddings) {
      assertEmbeddingDimension(embedding);
    }

    const records = pendingRecords.map((record, index) => ({
      id: `${sanitizeRecordIdPart(repoId)}-${record.id}`,
      values: embeddings[index],
      metadata: {
        ...record.metadata,
        repoId,
      } satisfies RagMetadata,
    }));

    for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
      upsertBatchCount += 1;
      await pineconeIndex.upsert({
        records: records.slice(i, i + UPSERT_BATCH_SIZE),
      });
    }

    pendingRecords = [];
  };

  for (const file of files) {
    const chunks = chunkFile(file);
    chunkCount += chunks.length;

    for (const chunk of chunks) {
      pendingRecords.push(chunk);

      if (pendingRecords.length >= EMBEDDING_BATCH_SIZE) {
        await flushPendingRecords();
      }
    }
  }

  await flushPendingRecords();

  console.log("indexing complete");

  return {
    repoId,
    indexedFiles: files.length,
    chunkCount,
    embeddingBatchCount,
    upsertBatchCount,
    samplePaths,
  };
}

export async function hasIndexedCodebase(repoId: string): Promise<boolean> {
  const prefix = `${sanitizeRecordIdPart(repoId)}-`;

  try {
    const results = await pineconeIndex.listPaginated({ prefix, limit: 1 });
    return (results.vectors?.length ?? 0) > 0;
  } catch (e) {
    console.error("[rag] failed to check indexed codebase", e);
    return false;
  }
}

export async function retrieveContext(
  query: string,
  repoId: string,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  try {
    return await searchDocumentIndex(query, repoId, topK);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("must be queried using the documents API")) {
      throw e;
    }
  }

  try {
    const results = await pineconeIndex.searchRecords({
      query: {
        inputs: { text: query },
        filter: { repoId },
        topK,
      },
      fields: [
        "path",
        "chunkIndex",
        "startOffset",
        "endOffset",
        "content",
        "text",
      ],
    });

    return ((results.result?.hits ?? []) as SearchRecordsHit[])
      .map((hit) => {
        const fields = hit.fields ?? {};
        const content =
          typeof fields.content === "string"
            ? fields.content
            : typeof fields.text === "string"
              ? fields.text
              : undefined;

        return {
          score: hit._score,
          path: fields.path as string | undefined,
          chunkIndex: fields.chunkIndex as number | undefined,
          startOffset: fields.startOffset as number | undefined,
          endOffset: fields.endOffset as number | undefined,
          content,
        };
      })
      .filter((match) => Boolean(match.content));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("documents API")) {
      return [];
    }

    const embedding = await generateEmbedding(query);

    try {
      const results = await pineconeIndex.query({
        vector: embedding,
        filter: { repoId },
        topK,
        includeMetadata: true,
      });

      return results.matches
        .map((match) => ({
          score: match.score,
          path: match.metadata?.path as string | undefined,
          chunkIndex: match.metadata?.chunkIndex as number | undefined,
          startOffset: match.metadata?.startOffset as number | undefined,
          endOffset: match.metadata?.endOffset as number | undefined,
          content: match.metadata?.content as string | undefined,
        }))
        .filter((match) => Boolean(match.content));
    } catch (queryError) {
      const queryMessage =
        queryError instanceof Error ? queryError.message : String(queryError);
      if (queryMessage.includes("documents API")) {
        return [];
      }
      throw queryError;
    }
  }
}