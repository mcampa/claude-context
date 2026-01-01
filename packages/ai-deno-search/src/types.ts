// Re-export search result types from core
export type { SemanticSearchResult } from "../../core/src/types.ts";

// Re-export embedding types
export type { EmbeddingVector } from "../../core/src/embedding/base-embedding.ts";

export { Embedding } from "../../core/src/embedding/base-embedding.ts";

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
} from "../../core/src/vectordb/types.ts";

export { COLLECTION_LIMIT_MESSAGE } from "../../core/src/vectordb/types.ts";
