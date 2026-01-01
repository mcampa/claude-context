/**
 * @mcampa/ai-deno-search - Semantic code search for Deno
 *
 * A lightweight Deno-native package for semantic search that works with
 * codebases indexed using @mcampa/ai-context-core.
 *
 * @example
 * ```typescript
 * import {
 *   SearchContext,
 *   OpenAIEmbedding,
 *   MilvusRestfulVectorDatabase,
 * } from "@mcampa/ai-deno-search";
 *
 * const embedding = new OpenAIEmbedding({
 *   apiKey: Deno.env.get("OPENAI_API_KEY")!,
 *   model: "text-embedding-3-small",
 * });
 *
 * const vectorDatabase = new MilvusRestfulVectorDatabase({
 *   address: Deno.env.get("MILVUS_ADDRESS")!,
 *   token: Deno.env.get("MILVUS_TOKEN")!,
 * });
 *
 * const searchContext = new SearchContext({
 *   name: "my-project",
 *   embedding,
 *   vectorDatabase,
 * });
 *
 * const results = await searchContext.semanticSearch(
 *   "function that handles authentication",
 *   5
 * );
 * ```
 *
 * @module
 */

// Main exports
export { SearchContext } from "./src/search-context.ts";
export type { SearchContextConfig } from "./src/search-context.ts";

// Type exports
export type {
  EmbeddingVector,
  HybridSearchOptions,
  HybridSearchRequest,
  HybridSearchResult,
  SearchOptions,
  SemanticSearchResult,
  VectorDatabase,
  VectorDocument,
  VectorSearchResult,
} from "./src/types.ts";

export { Embedding } from "./src/types.ts";

// Embedding providers
export { OpenAIEmbedding } from "./src/embedding/openai.ts";
export type { OpenAIEmbeddingConfig } from "./src/embedding/openai.ts";

export { VoyageAIEmbedding } from "./src/embedding/voyageai.ts";
export type { VoyageAIEmbeddingConfig } from "./src/embedding/voyageai.ts";

export { GeminiEmbedding } from "./src/embedding/gemini.ts";
export type { GeminiEmbeddingConfig } from "./src/embedding/gemini.ts";

export { OllamaEmbedding } from "./src/embedding/ollama.ts";
export type { OllamaEmbeddingConfig } from "./src/embedding/ollama.ts";

// Vector database
export { MilvusRestfulVectorDatabase } from "./src/vectordb/milvus-rest.ts";
export type { MilvusRestfulConfig } from "./src/vectordb/milvus-rest.ts";
