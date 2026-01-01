import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { findConfigFile, loadConfig } from "./config-loader.js";

// Test directory for temporary files
const TEST_DIR = join(process.cwd(), ".test-temp");

// Counter for unique file names to avoid ESM import caching
let testCounter = 0;

function getUniqueConfigPath(ext: string = "js"): string {
  testCounter++;
  return join(TEST_DIR, `test-config-${testCounter}.${ext}`);
}

describe("config-loader", () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe("findConfigFile", () => {
    it("should return null when no config file exists", () => {
      const result = findConfigFile(TEST_DIR);
      expect(result).toBeNull();
    });

    it("should find ai-context.config.ts", () => {
      const configPath = join(TEST_DIR, "ai-context.config.ts");
      writeFileSync(configPath, "export default {};");

      const result = findConfigFile(TEST_DIR);
      expect(result).toBe(configPath);
    });

    it("should find ai-context.config.js", () => {
      const configPath = join(TEST_DIR, "ai-context.config.js");
      writeFileSync(configPath, "export default {};");

      const result = findConfigFile(TEST_DIR);
      expect(result).toBe(configPath);
    });

    it("should prefer .ts over .js", () => {
      const tsConfigPath = join(TEST_DIR, "ai-context.config.ts");
      const jsConfigPath = join(TEST_DIR, "ai-context.config.js");
      writeFileSync(tsConfigPath, "export default {};");
      writeFileSync(jsConfigPath, "export default {};");

      const result = findConfigFile(TEST_DIR);
      expect(result).toBe(tsConfigPath);
    });
  });

  describe("loadConfig", () => {
    it("should throw error when no config file found", async () => {
      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        await expect(loadConfig()).rejects.toThrow("No config file found");
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("should throw error when specified config file not found", async () => {
      await expect(loadConfig("/nonexistent/config.ts")).rejects.toThrow(
        "Config file not found",
      );
    });

    it("should load and validate a valid JavaScript config", async () => {
      const configPath = getUniqueConfigPath("js");
      const configContent = `
        export default {
          name: "test-project",
          embeddingConfig: {
            apiKey: "test-key",
            model: "text-embedding-3-small",
          },
          vectorDatabaseConfig: {
            address: "localhost:19530",
          },
        };
      `;
      writeFileSync(configPath, configContent);

      const config = await loadConfig(configPath);

      expect(config.name).toBe("test-project");
      expect(config.embeddingConfig?.apiKey).toBe("test-key");
      expect(config.embeddingConfig?.model).toBe("text-embedding-3-small");
      expect(config.vectorDatabaseConfig?.address).toBe("localhost:19530");
    });

    it("should throw error for missing embeddingConfig", async () => {
      const configPath = getUniqueConfigPath("js");
      const configContent = `
        export default {
          vectorDatabaseConfig: {
            address: "localhost:19530",
          },
        };
      `;
      writeFileSync(configPath, configContent);

      await expect(loadConfig(configPath)).rejects.toThrow(
        "Missing required field: embeddingConfig",
      );
    });

    it("should throw error for missing embeddingConfig.apiKey", async () => {
      const configPath = getUniqueConfigPath("js");
      const configContent = `
        export default {
          embeddingConfig: {
            model: "text-embedding-3-small",
          },
          vectorDatabaseConfig: {
            address: "localhost:19530",
          },
        };
      `;
      writeFileSync(configPath, configContent);

      await expect(loadConfig(configPath)).rejects.toThrow(
        "Missing required field: embeddingConfig.apiKey",
      );
    });

    it("should throw error for missing embeddingConfig.model", async () => {
      const configPath = getUniqueConfigPath("js");
      const configContent = `
        export default {
          embeddingConfig: {
            apiKey: "test-key",
          },
          vectorDatabaseConfig: {
            address: "localhost:19530",
          },
        };
      `;
      writeFileSync(configPath, configContent);

      await expect(loadConfig(configPath)).rejects.toThrow(
        "Missing required field: embeddingConfig.model",
      );
    });

    it("should throw error for missing vectorDatabaseConfig", async () => {
      const configPath = getUniqueConfigPath("js");
      const configContent = `
        export default {
          embeddingConfig: {
            apiKey: "test-key",
            model: "text-embedding-3-small",
          },
        };
      `;
      writeFileSync(configPath, configContent);

      await expect(loadConfig(configPath)).rejects.toThrow(
        "Missing required field: vectorDatabaseConfig",
      );
    });

    it("should throw error when vectorDatabaseConfig has neither address nor token", async () => {
      const configPath = getUniqueConfigPath("js");
      const configContent = `
        export default {
          embeddingConfig: {
            apiKey: "test-key",
            model: "text-embedding-3-small",
          },
          vectorDatabaseConfig: {
            ssl: true,
          },
        };
      `;
      writeFileSync(configPath, configContent);

      await expect(loadConfig(configPath)).rejects.toThrow(
        "vectorDatabaseConfig requires either 'address' or 'token' to be set",
      );
    });

    it("should accept config with token instead of address", async () => {
      const configPath = getUniqueConfigPath("js");
      const configContent = `
        export default {
          embeddingConfig: {
            apiKey: "test-key",
            model: "text-embedding-3-small",
          },
          vectorDatabaseConfig: {
            token: "zilliz-token",
          },
        };
      `;
      writeFileSync(configPath, configContent);

      const config = await loadConfig(configPath);
      expect(config.vectorDatabaseConfig?.token).toBe("zilliz-token");
    });

    it("should throw error for invalid supportedExtensions type", async () => {
      const configPath = getUniqueConfigPath("js");
      const configContent = `
        export default {
          embeddingConfig: {
            apiKey: "test-key",
            model: "text-embedding-3-small",
          },
          vectorDatabaseConfig: {
            address: "localhost:19530",
          },
          supportedExtensions: "not-an-array",
        };
      `;
      writeFileSync(configPath, configContent);

      await expect(loadConfig(configPath)).rejects.toThrow(
        "supportedExtensions must be an array of strings",
      );
    });

    it("should throw error for non-string values in supportedExtensions", async () => {
      const configPath = getUniqueConfigPath("js");
      const configContent = `
        export default {
          embeddingConfig: {
            apiKey: "test-key",
            model: "text-embedding-3-small",
          },
          vectorDatabaseConfig: {
            address: "localhost:19530",
          },
          supportedExtensions: [".ts", 123],
        };
      `;
      writeFileSync(configPath, configContent);

      await expect(loadConfig(configPath)).rejects.toThrow(
        "supportedExtensions contains non-string value",
      );
    });

    it("should accept valid optional arrays", async () => {
      const configPath = getUniqueConfigPath("js");
      const configContent = `
        export default {
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
      `;
      writeFileSync(configPath, configContent);

      const config = await loadConfig(configPath);
      expect(config.supportedExtensions).toEqual([".ts", ".js"]);
      expect(config.ignorePatterns).toEqual(["node_modules/**"]);
      expect(config.customExtensions).toEqual([".vue"]);
      expect(config.customIgnorePatterns).toEqual(["*.test.ts"]);
    });
  });
});
