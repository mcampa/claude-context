import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ContextConfig } from "./types.js";

// Create hoisted mock functions
const {
  mockIndexCodebase,
  mockContext,
  mockOpenAIEmbedding,
  mockMilvusVectorDatabase,
} = vi.hoisted(() => {
  const mockIndexCodebase = vi.fn();
  const mockContext = vi.fn(() => ({
    indexCodebase: mockIndexCodebase,
  }));
  const mockOpenAIEmbedding = vi.fn(() => ({}));
  const mockMilvusVectorDatabase = vi.fn(() => ({}));
  return {
    mockIndexCodebase,
    mockContext,
    mockOpenAIEmbedding,
    mockMilvusVectorDatabase,
  };
});

// Mock the core package
vi.mock("@mcampa/ai-context-core", () => ({
  Context: mockContext,
  OpenAIEmbedding: mockOpenAIEmbedding,
  MilvusVectorDatabase: mockMilvusVectorDatabase,
}));

// Import after mocking
import { runIndex } from "./indexer.js";

describe("indexer", () => {
  const validConfig: ContextConfig = {
    name: "test-project",
    embeddingConfig: {
      apiKey: "test-api-key",
      model: "text-embedding-3-small",
    },
    vectorDatabaseConfig: {
      address: "localhost:19530",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    mockIndexCodebase.mockResolvedValue({
      indexedFiles: 10,
      totalChunks: 50,
      status: "completed",
    });

    // Suppress console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("runIndex", () => {
    it("should initialize OpenAIEmbedding with config", async () => {
      await runIndex(validConfig);

      expect(mockOpenAIEmbedding).toHaveBeenCalledWith({
        apiKey: "test-api-key",
        model: "text-embedding-3-small",
        baseURL: undefined,
      });
    });

    it("should initialize OpenAIEmbedding with baseURL when provided", async () => {
      const configWithBaseURL: ContextConfig = {
        ...validConfig,
        embeddingConfig: {
          ...validConfig.embeddingConfig!,
          baseURL: "https://custom.api.com",
        },
      };

      await runIndex(configWithBaseURL);

      expect(mockOpenAIEmbedding).toHaveBeenCalledWith({
        apiKey: "test-api-key",
        model: "text-embedding-3-small",
        baseURL: "https://custom.api.com",
      });
    });

    it("should initialize MilvusVectorDatabase with config", async () => {
      await runIndex(validConfig);

      expect(mockMilvusVectorDatabase).toHaveBeenCalledWith({
        address: "localhost:19530",
        token: undefined,
        username: undefined,
        password: undefined,
        ssl: undefined,
      });
    });

    it("should initialize MilvusVectorDatabase with all options", async () => {
      const fullConfig: ContextConfig = {
        ...validConfig,
        vectorDatabaseConfig: {
          address: "localhost:19530",
          token: "my-token",
          username: "user",
          password: "pass",
          ssl: true,
        },
      };

      await runIndex(fullConfig);

      expect(mockMilvusVectorDatabase).toHaveBeenCalledWith({
        address: "localhost:19530",
        token: "my-token",
        username: "user",
        password: "pass",
        ssl: true,
      });
    });

    it("should create Context with all config options", async () => {
      const fullConfig: ContextConfig = {
        name: "my-project",
        embeddingConfig: {
          apiKey: "test-key",
          model: "text-embedding-3-small",
        },
        vectorDatabaseConfig: {
          address: "localhost:19530",
        },
        supportedExtensions: [".ts", ".js"],
        ignorePatterns: ["node_modules/**"],
        customExtensions: [".vue"],
        customIgnorePatterns: ["*.test.ts"],
      };

      await runIndex(fullConfig);

      expect(mockContext).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "my-project",
          supportedExtensions: [".ts", ".js"],
          ignorePatterns: ["node_modules/**"],
          customExtensions: [".vue"],
          customIgnorePatterns: ["*.test.ts"],
        }),
      );
    });

    it("should return indexing statistics", async () => {
      const result = await runIndex(validConfig);

      expect(result).toEqual({
        indexedFiles: 10,
        totalChunks: 50,
        status: "completed",
      });
    });

    it("should pass forceReindex flag to indexCodebase", async () => {
      await runIndex(validConfig, true);

      expect(mockIndexCodebase).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        true,
      );
    });

    it("should call indexCodebase with progress callback", async () => {
      await runIndex(validConfig);

      expect(mockIndexCodebase).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        false,
      );
    });

    it("should handle limit_reached status", async () => {
      mockIndexCodebase.mockResolvedValue({
        indexedFiles: 100,
        totalChunks: 450000,
        status: "limit_reached",
      });

      const result = await runIndex(validConfig);

      expect(result.status).toBe("limit_reached");
    });

    it("should use process.cwd() as the indexing path", async () => {
      await runIndex(validConfig);

      expect(mockIndexCodebase).toHaveBeenCalledWith(
        process.cwd(),
        expect.any(Function),
        false,
      );
    });
  });
});
