import "server-only";

import { pineconeIndex } from "@/lib/pinecone";
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

export async function retrieveContext(
  query: string,
  repoId: string,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  const embedding = await generateEmbedding(query);

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
}