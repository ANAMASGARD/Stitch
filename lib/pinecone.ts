import { Pinecone } from "@pinecone-database/pinecone";

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_DB_API_KEY!,
});

export const PINECONE_INDEX_NAME = "stitch-ai";

export const pineconeIndex = pinecone.index({ name: PINECONE_INDEX_NAME });