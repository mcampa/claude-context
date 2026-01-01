// Search result types
export interface SemanticSearchResult {
  content: string;
  relativePath: string;
  startLine: number;
  endLine: number;
  language: string;
  score: number;
}

// Re-export embedding types
export type { EmbeddingVector } from "./embedding/base-embedding.ts";
export { Embedding } from "./embedding/base-embedding.ts";

// Re-export vector DB types
export type {
  HybridSearchOptions,
  HybridSearchRequest,
  HybridSearchResult,
  RerankStrategy,
  SearchOptions,
  VectorDatabase,
  VectorDocument,
  VectorSearchResult,
} from "./vectordb/vectordb-types.ts";

export { COLLECTION_LIMIT_MESSAGE } from "./vectordb/vectordb-types.ts";
