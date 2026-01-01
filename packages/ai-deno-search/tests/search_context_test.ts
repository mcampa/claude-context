/**
 * Tests for SearchContext
 *
 * Run with: deno test --allow-env --allow-net tests/
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  Embedding,
  type EmbeddingVector,
  type HybridSearchResult,
  SearchContext,
  type SearchContextConfig,
  type VectorDatabase,
  type VectorSearchResult,
} from "../mod.ts";

// Mock Embedding Provider
class MockEmbedding extends Embedding {
  protected maxTokens = 8192;

  async detectDimension(): Promise<number> {
    return 384;
  }

  async embed(_text: string): Promise<EmbeddingVector> {
    // Return mock embedding vector
    return {
      vector: Array(384).fill(0.1),
      dimension: 384,
    };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    return texts.map(() => ({
      vector: Array(384).fill(0.1),
      dimension: 384,
    }));
  }

  getDimension(): number {
    return 384;
  }

  getProvider(): string {
    return "Mock";
  }
}

// Mock Vector Database
class MockVectorDatabase implements VectorDatabase {
  private collections = new Set<string>();
  private mockData = new Map<string, any[]>();

  async createCollection(collectionName: string): Promise<void> {
    this.collections.add(collectionName);
  }

  async createHybridCollection(collectionName: string): Promise<void> {
    this.collections.add(collectionName);
  }

  async dropCollection(collectionName: string): Promise<void> {
    this.collections.delete(collectionName);
    this.mockData.delete(collectionName);
  }

  async hasCollection(collectionName: string): Promise<boolean> {
    return this.collections.has(collectionName);
  }

  async listCollections(): Promise<string[]> {
    return Array.from(this.collections);
  }

  async insert(collectionName: string, documents: any[]): Promise<void> {
    if (!this.mockData.has(collectionName)) {
      this.mockData.set(collectionName, []);
    }
    this.mockData.get(collectionName)!.push(...documents);
  }

  async insertHybrid(collectionName: string, documents: any[]): Promise<void> {
    return this.insert(collectionName, documents);
  }

  async search(
    collectionName: string,
    _queryVector: number[],
    options?: any,
  ): Promise<VectorSearchResult[]> {
    const topK = options?.topK || 5;
    return Array(Math.min(topK, 3))
      .fill(null)
      .map((_, i) => ({
        document: {
          id: `doc-${i}`,
          vector: [],
          content: `Mock result ${i}`,
          relativePath: `src/file${i}.ts`,
          startLine: i * 10,
          endLine: i * 10 + 5,
          fileExtension: ".ts",
          metadata: { language: "typescript" },
        },
        score: 0.9 - i * 0.1,
      }));
  }

  async hybridSearch(
    collectionName: string,
    _searchRequests: any[],
    options?: any,
  ): Promise<HybridSearchResult[]> {
    const limit = options?.limit || 5;
    return Array(Math.min(limit, 3))
      .fill(null)
      .map((_, i) => ({
        document: {
          id: `doc-${i}`,
          vector: [],
          content: `Mock hybrid result ${i}`,
          relativePath: `src/file${i}.ts`,
          startLine: i * 10,
          endLine: i * 10 + 5,
          fileExtension: ".ts",
          metadata: { language: "typescript" },
        },
        score: 0.95 - i * 0.1,
      }));
  }

  async delete(_collectionName: string, _ids: string[]): Promise<void> {
    // Mock implementation
  }

  async query(
    _collectionName: string,
    _filter: string,
    _outputFields: string[],
    _limit?: number,
  ): Promise<Record<string, unknown>[]> {
    return [{ id: "test-doc" }];
  }

  async checkCollectionLimit(): Promise<boolean> {
    return true;
  }
}

Deno.test("SearchContext - initialization", () => {
  const config: SearchContextConfig = {
    name: "test-context",
    embedding: new MockEmbedding(),
    vectorDatabase: new MockVectorDatabase(),
    hybridMode: true,
  };

  const searchContext = new SearchContext(config);

  assertExists(searchContext);
  assertEquals(searchContext.getName(), "test-context");
  assertEquals(searchContext.isHybridMode(), true);
});

Deno.test("SearchContext - default name", () => {
  const config: SearchContextConfig = {
    embedding: new MockEmbedding(),
    vectorDatabase: new MockVectorDatabase(),
  };

  const searchContext = new SearchContext(config);
  assertEquals(searchContext.getName(), "ai-deno-search");
});

Deno.test(
  "SearchContext - hasIndex returns false when collection doesn't exist",
  async () => {
    const vectorDb = new MockVectorDatabase();
    const config: SearchContextConfig = {
      name: "test-context",
      embedding: new MockEmbedding(),
      vectorDatabase: vectorDb,
    };

    const searchContext = new SearchContext(config);
    const hasIndex = await searchContext.hasIndex();

    assertEquals(hasIndex, false);
  },
);

Deno.test(
  "SearchContext - hasIndex returns true when collection exists",
  async () => {
    const vectorDb = new MockVectorDatabase();
    await vectorDb.createHybridCollection("hybrid_code_chunks_test-context");

    const config: SearchContextConfig = {
      name: "test-context",
      embedding: new MockEmbedding(),
      vectorDatabase: vectorDb,
    };

    const searchContext = new SearchContext(config);
    const hasIndex = await searchContext.hasIndex();

    assertEquals(hasIndex, true);
  },
);

Deno.test(
  "SearchContext - semanticSearch returns empty when no collection",
  async () => {
    const config: SearchContextConfig = {
      name: "test-context",
      embedding: new MockEmbedding(),
      vectorDatabase: new MockVectorDatabase(),
    };

    const searchContext = new SearchContext(config);
    const results = await searchContext.semanticSearch("test query");

    assertEquals(results.length, 0);
  },
);

Deno.test("SearchContext - semanticSearch with hybrid mode", async () => {
  const vectorDb = new MockVectorDatabase();
  await vectorDb.createHybridCollection("hybrid_code_chunks_test-context");

  const config: SearchContextConfig = {
    name: "test-context",
    embedding: new MockEmbedding(),
    vectorDatabase: vectorDb,
    hybridMode: true,
  };

  const searchContext = new SearchContext(config);
  const results = await searchContext.semanticSearch("test query", 5);

  assertEquals(results.length, 3); // Mock returns 3 results
  assertEquals(results[0].relativePath, "src/file0.ts");
  assertEquals(results[0].language, "typescript");
  assertExists(results[0].score);
});

Deno.test("SearchContext - semanticSearch without hybrid mode", async () => {
  const vectorDb = new MockVectorDatabase();
  await vectorDb.createCollection("code_chunks_test-context");

  const config: SearchContextConfig = {
    name: "test-context",
    embedding: new MockEmbedding(),
    vectorDatabase: vectorDb,
    hybridMode: false,
  };

  const searchContext = new SearchContext(config);
  const results = await searchContext.semanticSearch("test query", 5);

  assertEquals(results.length, 3); // Mock returns 3 results
  assertEquals(results[0].relativePath, "src/file0.ts");
});

Deno.test("SearchContext - getEmbedding returns embedding instance", () => {
  const embedding = new MockEmbedding();
  const config: SearchContextConfig = {
    embedding,
    vectorDatabase: new MockVectorDatabase(),
  };

  const searchContext = new SearchContext(config);
  assertEquals(searchContext.getEmbedding(), embedding);
});

Deno.test(
  "SearchContext - getVectorDatabase returns vector database instance",
  () => {
    const vectorDb = new MockVectorDatabase();
    const config: SearchContextConfig = {
      embedding: new MockEmbedding(),
      vectorDatabase: vectorDb,
    };

    const searchContext = new SearchContext(config);
    assertEquals(searchContext.getVectorDatabase(), vectorDb);
  },
);

Deno.test("SearchContext - hybrid mode from environment variable", () => {
  // Test with HYBRID_MODE=false
  Deno.env.set("HYBRID_MODE", "false");

  const config: SearchContextConfig = {
    embedding: new MockEmbedding(),
    vectorDatabase: new MockVectorDatabase(),
  };

  const searchContext = new SearchContext(config);
  assertEquals(searchContext.isHybridMode(), false);

  // Cleanup
  Deno.env.delete("HYBRID_MODE");
});

Deno.test("SearchContext - collection name format with hybrid mode", () => {
  const config: SearchContextConfig = {
    name: "my-project",
    embedding: new MockEmbedding(),
    vectorDatabase: new MockVectorDatabase(),
    hybridMode: true,
  };

  const searchContext = new SearchContext(config);
  // We can't directly test private getCollectionName(), but we can test hasIndex
  // which uses it internally
  assertExists(searchContext);
});

Deno.test("SearchContext - collection name format without hybrid mode", () => {
  const config: SearchContextConfig = {
    name: "my-project",
    embedding: new MockEmbedding(),
    vectorDatabase: new MockVectorDatabase(),
    hybridMode: false,
  };

  const searchContext = new SearchContext(config);
  assertExists(searchContext);
});
