/**
 * Milvus RESTful Vector Database Implementation for Deno
 *
 * This implementation uses only HTTP/fetch requests, making it compatible with Deno.
 * It's adapted from the core package with ClusterManager removed.
 */

import type {
  HybridSearchOptions,
  HybridSearchRequest,
  HybridSearchResult,
  SearchOptions,
  VectorDatabase,
  VectorDocument,
  VectorSearchResult,
} from "./vectordb-types.ts";
import { COLLECTION_LIMIT_MESSAGE } from "./vectordb-types.ts";

export interface MilvusRestfulConfig {
  address: string; // Required - full address to Milvus server
  token: string; // Required - authentication token
  database?: string;
}

// REST API request/response types
interface MilvusRestResponse<T = unknown> {
  code: number;
  data?: T;
  message?: string;
}

interface MilvusSearchResultItem {
  id: string;
  distance?: number;
  score?: number;
  relativePath?: string;
  content?: string;
  startLine?: number;
  endLine?: number;
  fileExtension?: string;
  metadata?: string;
  [key: string]: unknown;
}

interface CollectionLoadState {
  loadState: string;
}

/**
 * Wrapper function to handle collection creation with limit detection
 */
async function createCollectionWithLimitCheck(
  makeRequestFn: (
    endpoint: string,
    method: "GET" | "POST",
    data?: Record<string, unknown>,
  ) => Promise<MilvusRestResponse>,
  collectionSchema: Record<string, unknown>,
): Promise<void> {
  try {
    await makeRequestFn("/collections/create", "POST", collectionSchema);
  } catch (error) {
    const errorMessage = String(error);
    if (/exceeded the limit number of collections/i.test(errorMessage)) {
      throw COLLECTION_LIMIT_MESSAGE;
    }
    throw error;
  }
}

/**
 * Milvus Vector Database implementation using REST API for Deno
 */
export class MilvusRestfulVectorDatabase implements VectorDatabase {
  protected config: MilvusRestfulConfig;
  private baseUrl: string | null = null;
  protected initializationPromise: Promise<void>;

  constructor(config: MilvusRestfulConfig) {
    this.config = config;
    this.initializationPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.initializeClient(this.config.address);
  }

  private async initializeClient(address: string): Promise<void> {
    // Ensure address has protocol prefix
    let processedAddress = address;
    if (
      !processedAddress.startsWith("http://") &&
      !processedAddress.startsWith("https://")
    ) {
      processedAddress = `https://${processedAddress}`;
    }

    this.baseUrl = processedAddress.replace(/\/$/, "") + "/v2/vectordb";

    console.log(`🔌 Connecting to Milvus REST API at: ${processedAddress}`);
  }

  /**
   * Ensure initialization is complete before method execution
   */
  protected async ensureInitialized(): Promise<void> {
    await this.initializationPromise;
    if (!this.baseUrl) {
      throw new Error("Base URL not initialized");
    }
  }

  /**
   * Ensure collection is loaded before search/query operations
   */
  protected async ensureLoaded(collectionName: string): Promise<void> {
    try {
      const response = await this.makeRequest(
        "/collections/get_load_state",
        "POST",
        {
          collectionName,
          dbName: this.config.database,
        },
      );

      const responseData = response.data as CollectionLoadState | undefined;
      const loadState = responseData?.loadState;
      if (loadState !== "LoadStateLoaded") {
        console.log(
          `[MilvusRestfulDB] 🔄 Loading collection '${collectionName}' to memory...`,
        );
        await this.loadCollection(collectionName);
      }
    } catch (error) {
      console.error(
        `[MilvusRestfulDB] ❌ Failed to ensure collection '${collectionName}' is loaded:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Make HTTP request to Milvus REST API
   */
  private async makeRequest(
    endpoint: string,
    method: "GET" | "POST" = "POST",
    data?: Record<string, unknown>,
  ): Promise<MilvusRestResponse> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Handle authentication
    if (this.config.token) {
      headers["Authorization"] = `Bearer ${this.config.token}`;
    }

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (data && method === "POST") {
      requestOptions.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = (await response.json()) as MilvusRestResponse;

      if (result.code !== 0 && result.code !== 200) {
        throw new Error(
          `Milvus API error: ${result.message || "Unknown error"}`,
        );
      }

      return result;
    } catch (error) {
      console.error(`[MilvusRestfulDB] Milvus REST API request failed:`, error);
      throw error;
    }
  }

  async createCollection(
    collectionName: string,
    dimension: number,
    _description?: string,
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const collectionSchema = {
        collectionName,
        dbName: this.config.database,
        schema: {
          enableDynamicField: false,
          fields: [
            {
              fieldName: "id",
              dataType: "VarChar",
              isPrimary: true,
              elementTypeParams: {
                max_length: 512,
              },
            },
            {
              fieldName: "vector",
              dataType: "FloatVector",
              elementTypeParams: {
                dim: dimension,
              },
            },
            {
              fieldName: "content",
              dataType: "VarChar",
              elementTypeParams: {
                max_length: 65535,
              },
            },
            {
              fieldName: "relativePath",
              dataType: "VarChar",
              elementTypeParams: {
                max_length: 1024,
              },
            },
            {
              fieldName: "startLine",
              dataType: "Int64",
            },
            {
              fieldName: "endLine",
              dataType: "Int64",
            },
            {
              fieldName: "fileExtension",
              dataType: "VarChar",
              elementTypeParams: {
                max_length: 32,
              },
            },
            {
              fieldName: "metadata",
              dataType: "VarChar",
              elementTypeParams: {
                max_length: 65535,
              },
            },
          ],
        },
      };

      await createCollectionWithLimitCheck(
        this.makeRequest.bind(this),
        collectionSchema,
      );

      await this.createIndex(collectionName);
      await this.loadCollection(collectionName);
    } catch (error) {
      console.error(
        `[MilvusRestfulDB] ❌ Failed to create collection '${collectionName}':`,
        error,
      );
      throw error;
    }
  }

  /**
   * Create index for vector field
   */
  private async createIndex(collectionName: string): Promise<void> {
    try {
      const indexParams = {
        collectionName,
        dbName: this.config.database,
        indexParams: [
          {
            fieldName: "vector",
            indexName: "vector_index",
            metricType: "COSINE",
            index_type: "AUTOINDEX",
          },
        ],
      };

      await this.makeRequest("/indexes/create", "POST", indexParams);
    } catch (error) {
      console.error(
        `[MilvusRestfulDB] ❌ Failed to create index for collection '${collectionName}':`,
        error,
      );
      throw error;
    }
  }

  /**
   * Load collection to memory for searching
   */
  private async loadCollection(collectionName: string): Promise<void> {
    try {
      await this.makeRequest("/collections/load", "POST", {
        collectionName,
        dbName: this.config.database,
      });
    } catch (error) {
      console.error(
        `[MilvusRestfulDB] ❌ Failed to load collection '${collectionName}':`,
        error,
      );
      throw error;
    }
  }

  async dropCollection(collectionName: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.makeRequest("/collections/drop", "POST", {
        collectionName,
        dbName: this.config.database,
      });
    } catch (error) {
      console.error(
        `[MilvusRestfulDB] ❌ Failed to drop collection '${collectionName}':`,
        error,
      );
      throw error;
    }
  }

  async hasCollection(collectionName: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const response = await this.makeRequest("/collections/has", "POST", {
        collectionName,
        dbName: this.config.database,
      });

      const responseData = response.data as { has?: boolean } | undefined;
      const exists = responseData?.has || false;
      return exists;
    } catch (error) {
      console.error(
        `[MilvusRestfulDB] ❌ Failed to check collection '${collectionName}' existence:`,
        error,
      );
      throw error;
    }
  }

  async listCollections(): Promise<string[]> {
    await this.ensureInitialized();

    try {
      const response = await this.makeRequest("/collections/list", "POST", {
        dbName: this.config.database,
      });

      const collections = response.data as string[] | undefined;
      return collections || [];
    } catch (error) {
      console.error(`[MilvusRestfulDB] ❌ Failed to list collections:`, error);
      throw error;
    }
  }

  async insert(
    collectionName: string,
    documents: VectorDocument[],
  ): Promise<void> {
    await this.ensureInitialized();
    await this.ensureLoaded(collectionName);

    try {
      const data = documents.map((doc) => ({
        id: doc.id,
        vector: doc.vector,
        content: doc.content,
        relativePath: doc.relativePath,
        startLine: doc.startLine,
        endLine: doc.endLine,
        fileExtension: doc.fileExtension,
        metadata: JSON.stringify(doc.metadata),
      }));

      const insertRequest = {
        collectionName,
        data,
        dbName: this.config.database,
      };

      await this.makeRequest("/entities/insert", "POST", insertRequest);
    } catch (error) {
      console.error(
        `[MilvusRestfulDB] ❌ Failed to insert documents into collection '${collectionName}':`,
        error,
      );
      throw error;
    }
  }

  async search(
    collectionName: string,
    queryVector: number[],
    options?: SearchOptions,
  ): Promise<VectorSearchResult[]> {
    await this.ensureInitialized();
    await this.ensureLoaded(collectionName);

    const topK = options?.topK || 10;

    try {
      const searchRequest: {
        collectionName: string;
        dbName?: string;
        data: number[][];
        annsField: string;
        limit: number;
        outputFields: string[];
        searchParams: { metricType: string; params: Record<string, unknown> };
        filter?: string;
      } = {
        collectionName,
        dbName: this.config.database,
        data: [queryVector],
        annsField: "vector",
        limit: topK,
        outputFields: [
          "content",
          "relativePath",
          "startLine",
          "endLine",
          "fileExtension",
          "metadata",
        ],
        searchParams: {
          metricType: "COSINE",
          params: {},
        },
      };

      if (options?.filterExpr && options.filterExpr.trim().length > 0) {
        searchRequest.filter = options.filterExpr;
      }

      const response = await this.makeRequest(
        "/entities/search",
        "POST",
        searchRequest as unknown as Record<string, unknown>,
      );

      const searchData = (response.data || []) as MilvusSearchResultItem[];
      const results: VectorSearchResult[] = searchData.map((item) => {
        let metadata = {};
        try {
          metadata = JSON.parse(item.metadata || "{}");
        } catch (error) {
          console.warn(
            `[MilvusRestfulDB] Failed to parse metadata for item ${item.id}:`,
            error,
          );
          metadata = {};
        }

        return {
          document: {
            id: item.id?.toString() || "",
            vector: queryVector,
            content: item.content || "",
            relativePath: item.relativePath || "",
            startLine: item.startLine || 0,
            endLine: item.endLine || 0,
            fileExtension: item.fileExtension || "",
            metadata: metadata,
          },
          score: item.distance || 0,
        };
      });

      return results;
    } catch (error) {
      console.error(
        `[MilvusRestfulDB] ❌ Failed to search in collection '${collectionName}':`,
        error,
      );
      throw error;
    }
  }

  async delete(collectionName: string, ids: string[]): Promise<void> {
    await this.ensureInitialized();
    await this.ensureLoaded(collectionName);

    try {
      const filter = `id in [${ids.map((id) => `"${id}"`).join(", ")}]`;

      const deleteRequest = {
        collectionName,
        filter,
        dbName: this.config.database,
      };

      await this.makeRequest("/entities/delete", "POST", deleteRequest);
    } catch (error) {
      console.error(
        `[MilvusRestfulDB] ❌ Failed to delete documents from collection '${collectionName}':`,
        error,
      );
      throw error;
    }
  }

  async query(
    collectionName: string,
    filter: string,
    outputFields: string[],
    limit?: number,
  ): Promise<Record<string, unknown>[]> {
    await this.ensureInitialized();
    await this.ensureLoaded(collectionName);

    try {
      const queryRequest = {
        collectionName,
        dbName: this.config.database,
        filter,
        outputFields,
        limit: limit || 16384,
        offset: 0,
      };

      const response = await this.makeRequest(
        "/entities/query",
        "POST",
        queryRequest,
      );

      if (response.code !== 0) {
        throw new Error(
          `Failed to query Milvus: ${response.message || "Unknown error"}`,
        );
      }

      return (response.data || []) as Record<string, unknown>[];
    } catch (error) {
      console.error(
        `[MilvusRestfulDB] ❌ Failed to query collection '${collectionName}':`,
        error,
      );
      throw error;
    }
  }

  async createHybridCollection(
    collectionName: string,
    dimension: number,
    _description?: string,
  ): Promise<void> {
    try {
      const collectionSchema = {
        collectionName,
        dbName: this.config.database,
        schema: {
          enableDynamicField: false,
          functions: [
            {
              name: "content_bm25_emb",
              description: "content bm25 function",
              type: "BM25",
              inputFieldNames: ["content"],
              outputFieldNames: ["sparse_vector"],
              params: {},
            },
          ],
          fields: [
            {
              fieldName: "id",
              dataType: "VarChar",
              isPrimary: true,
              elementTypeParams: {
                max_length: 512,
              },
            },
            {
              fieldName: "content",
              dataType: "VarChar",
              elementTypeParams: {
                max_length: 65535,
                enable_analyzer: true,
              },
            },
            {
              fieldName: "vector",
              dataType: "FloatVector",
              elementTypeParams: {
                dim: dimension,
              },
            },
            {
              fieldName: "sparse_vector",
              dataType: "SparseFloatVector",
            },
            {
              fieldName: "relativePath",
              dataType: "VarChar",
              elementTypeParams: {
                max_length: 1024,
              },
            },
            {
              fieldName: "startLine",
              dataType: "Int64",
            },
            {
              fieldName: "endLine",
              dataType: "Int64",
            },
            {
              fieldName: "fileExtension",
              dataType: "VarChar",
              elementTypeParams: {
                max_length: 32,
              },
            },
            {
              fieldName: "metadata",
              dataType: "VarChar",
              elementTypeParams: {
                max_length: 65535,
              },
            },
          ],
        },
      };

      await createCollectionWithLimitCheck(
        this.makeRequest.bind(this),
        collectionSchema,
      );

      await this.createHybridIndexes(collectionName);
      await this.loadCollection(collectionName);
    } catch (error) {
      console.error(
        `[MilvusRestfulDB] ❌ Failed to create hybrid collection '${collectionName}':`,
        error,
      );
      throw error;
    }
  }

  private async createHybridIndexes(collectionName: string): Promise<void> {
    try {
      const denseIndexParams = {
        collectionName,
        dbName: this.config.database,
        indexParams: [
          {
            fieldName: "vector",
            indexName: "vector_index",
            metricType: "COSINE",
            index_type: "AUTOINDEX",
          },
        ],
      };
      await this.makeRequest("/indexes/create", "POST", denseIndexParams);

      const sparseIndexParams = {
        collectionName,
        dbName: this.config.database,
        indexParams: [
          {
            fieldName: "sparse_vector",
            indexName: "sparse_vector_index",
            metricType: "BM25",
            index_type: "SPARSE_INVERTED_INDEX",
          },
        ],
      };
      await this.makeRequest("/indexes/create", "POST", sparseIndexParams);
    } catch (error) {
      console.error(
        `[MilvusRestfulDB] ❌ Failed to create hybrid indexes for collection '${collectionName}':`,
        error,
      );
      throw error;
    }
  }

  async insertHybrid(
    collectionName: string,
    documents: VectorDocument[],
  ): Promise<void> {
    await this.ensureInitialized();
    await this.ensureLoaded(collectionName);

    try {
      const data = documents.map((doc) => ({
        id: doc.id,
        content: doc.content,
        vector: doc.vector,
        relativePath: doc.relativePath,
        startLine: doc.startLine,
        endLine: doc.endLine,
        fileExtension: doc.fileExtension,
        metadata: JSON.stringify(doc.metadata),
      }));

      const insertRequest = {
        collectionName,
        dbName: this.config.database,
        data: data,
      };

      const response = await this.makeRequest(
        "/entities/insert",
        "POST",
        insertRequest,
      );

      if (response.code !== 0) {
        throw new Error(
          `Insert failed: ${response.message || "Unknown error"}`,
        );
      }
    } catch (error) {
      console.error(
        `[MilvusRestfulDB] ❌ Failed to insert hybrid documents to collection '${collectionName}':`,
        error,
      );
      throw error;
    }
  }

  async hybridSearch(
    collectionName: string,
    searchRequests: HybridSearchRequest[],
    options?: HybridSearchOptions,
  ): Promise<HybridSearchResult[]> {
    await this.ensureInitialized();
    await this.ensureLoaded(collectionName);

    try {
      console.log(
        `[MilvusRestfulDB] 🔍 Preparing hybrid search for collection: ${collectionName}`,
      );

      const denseData = searchRequests[0].data;
      const search_param_1 = {
        data: Array.isArray(denseData) ? [denseData] : [[denseData]],
        annsField: searchRequests[0].anns_field,
        limit: searchRequests[0].limit,
        outputFields: ["*"],
        searchParams: {
          metricType: "COSINE",
          params: (searchRequests[0].param as Record<string, unknown>) || {
            nprobe: 10,
          },
        },
        filter: undefined as string | undefined,
      };

      const sparseData = searchRequests[1].data;
      const search_param_2 = {
        data: typeof sparseData === "string" ? [sparseData] : sparseData,
        annsField: searchRequests[1].anns_field,
        limit: searchRequests[1].limit,
        outputFields: ["*"],
        searchParams: {
          metricType: "BM25",
          params: (searchRequests[1].param as Record<string, unknown>) || {
            drop_ratio_search: 0.2,
          },
        },
        filter: undefined as string | undefined,
      };

      if (options?.filterExpr && options.filterExpr.trim().length > 0) {
        search_param_1.filter = options.filterExpr;
        search_param_2.filter = options.filterExpr;
      }

      const rerank_strategy = {
        strategy: "rrf",
        params: {
          k: 100,
        },
      };

      const hybridSearchRequest = {
        collectionName,
        dbName: this.config.database,
        search: [search_param_1, search_param_2],
        rerank: rerank_strategy,
        limit: options?.limit || searchRequests[0]?.limit || 10,
        outputFields: [
          "id",
          "content",
          "relativePath",
          "startLine",
          "endLine",
          "fileExtension",
          "metadata",
        ],
      };

      console.log(`[MilvusRestfulDB] 🔍 Executing REST API hybrid search...`);
      const response = await this.makeRequest(
        "/entities/hybrid_search",
        "POST",
        hybridSearchRequest as unknown as Record<string, unknown>,
      );

      if (response.code !== 0) {
        throw new Error(
          `Hybrid search failed: ${response.message || "Unknown error"}`,
        );
      }

      const results = (response.data || []) as MilvusSearchResultItem[];
      console.log(
        `[MilvusRestfulDB] ✅ Found ${results.length} results from hybrid search`,
      );

      return results.map((result) => ({
        document: {
          id: result.id || "",
          content: result.content || "",
          vector: [],
          relativePath: result.relativePath || "",
          startLine: result.startLine || 0,
          endLine: result.endLine || 0,
          fileExtension: result.fileExtension || "",
          metadata: JSON.parse(result.metadata || "{}") as Record<
            string,
            unknown
          >,
        },
        score: result.score || result.distance || 0,
      }));
    } catch (error) {
      console.error(
        `[MilvusRestfulDB] ❌ Failed to perform hybrid search on collection '${collectionName}':`,
        error,
      );
      throw error;
    }
  }

  async checkCollectionLimit(): Promise<boolean> {
    console.warn(
      "[MilvusRestfulDB] ⚠️  checkCollectionLimit not implemented for REST API - returning true",
    );
    return true;
  }
}
