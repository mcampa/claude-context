# @mcampa/ai-deno-search

Semantic code search for Deno - a lightweight package for searching codebases indexed with [@mcampa/ai-context-core](../core).

## Overview

This package provides **search-only** functionality for Deno applications. It allows you to perform semantic searches on codebases that have been indexed using the Node.js core package.

### Why Deno Search?

- **Native Deno Support**: Built specifically for Deno with TypeScript and modern APIs
- **No Native Dependencies**: Pure HTTP/fetch-based, no Node.js bindings required
- **Type-Safe**: Full TypeScript support with types shared from core package
- **Lightweight**: ~500 LOC vs 1500+ LOC in core (search-only, no indexing)
- **HTTP-Only**: Uses Milvus REST API (no gRPC dependencies)

## Two-Step Workflow

```mermaid
graph LR
    A[1. Index with Node.js<br/>@mcampa/ai-context-core] --> B[Milvus Vector DB]
    B --> C[2. Search with Deno<br/>@mcampa/ai-deno-search]
```

1. **Index** your codebase using Node.js core package
2. **Search** from Deno applications using this package

## Installation

### Using JSR (Recommended)

```bash
deno add @mcampa/ai-deno-search
```

### Direct Import

```typescript
import {
  SearchContext,
  OpenAIEmbedding,
  MilvusRestfulVectorDatabase,
} from "https://deno.land/x/deno_search@v0.0.1/mod.ts";
```

## Prerequisites

### Environment Variables

Set the following environment variables:

```bash
# OpenAI API Key for embeddings
export OPENAI_API_KEY=sk-your-openai-api-key

# Milvus/Zilliz Cloud connection
export MILVUS_ADDRESS=your-zilliz-cloud-endpoint
export MILVUS_TOKEN=your-zilliz-cloud-api-key

# Optional: Override hybrid search mode (default: true)
export HYBRID_MODE=true
```

### Indexed Codebase

You must first index your codebase using the Node.js core package:

```typescript
// Node.js - index your codebase
import { Context } from "@mcampa/ai-context-core";

const context = new Context({
  name: "my-project", // Remember this name!
  embedding: /* ... */,
  vectorDatabase: /* ... */,
});

await context.indexCodebase("./my-project");
```

## Quick Start

```typescript
import {
  SearchContext,
  OpenAIEmbedding,
  MilvusRestfulVectorDatabase,
} from "@mcampa/ai-deno-search";

// 1. Initialize embedding provider
const embedding = new OpenAIEmbedding({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
  model: "text-embedding-3-small",
});

// 2. Initialize vector database (REST API only)
const vectorDatabase = new MilvusRestfulVectorDatabase({
  address: Deno.env.get("MILVUS_ADDRESS")!,
  token: Deno.env.get("MILVUS_TOKEN")!,
});

// 3. Create search context
// IMPORTANT: Use same name as during indexing
const searchContext = new SearchContext({
  name: "my-project", // Must match indexing name
  embedding,
  vectorDatabase,
});

// 4. Check if index exists
const hasIndex = await searchContext.hasIndex();
if (!hasIndex) {
  console.error("Index not found. Please index first with @mcampa/ai-context-core");
  Deno.exit(1);
}

// 5. Perform semantic search
const results = await searchContext.semanticSearch(
  "function that handles user authentication",
  5 // top K results
);

// 6. Process results
results.forEach((result) => {
  console.log(`${result.relativePath}:${result.startLine}-${result.endLine}`);
  console.log(`Score: ${result.score}`);
  console.log(`Language: ${result.language}`);
  console.log(result.content);
});
```

## Running the Example

```bash
# Set environment variables
export OPENAI_API_KEY=sk-your-key
export MILVUS_ADDRESS=your-endpoint
export MILVUS_TOKEN=your-token

# Run the example
deno run --allow-env --allow-net examples/basic-search.ts
```

## API Reference

### SearchContext

Main class for performing semantic searches.

```typescript
const searchContext = new SearchContext(config: SearchContextConfig)
```

#### Configuration

```typescript
interface SearchContextConfig {
  name?: string;              // Context name (must match indexing)
  embedding: Embedding;       // Embedding provider
  vectorDatabase: VectorDatabase; // Vector database instance
  hybridMode?: boolean;       // Enable hybrid search (default: true)
}
```

#### Methods

##### `semanticSearch()`

Perform a semantic search on the indexed codebase.

```typescript
async semanticSearch(
  query: string,
  topK?: number,        // Default: 5
  threshold?: number,   // Default: 0.5
  filterExpr?: string   // Optional filter expression
): Promise<SemanticSearchResult[]>
```

**Example:**

```typescript
const results = await searchContext.semanticSearch(
  "database connection handler",
  10,
  0.6,
  'fileExtension == ".ts"'
);
```

##### `hasIndex()`

Check if an index exists for this context.

```typescript
async hasIndex(): Promise<boolean>
```

##### `getEmbedding()`, `getVectorDatabase()`, `getName()`, `isHybridMode()`

Getter methods for accessing context properties.

### Embedding Providers

#### OpenAI Embeddings

```typescript
const embedding = new OpenAIEmbedding({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
  model: "text-embedding-3-small", // or text-embedding-3-large
  baseURL?: "https://api.openai.com/v1", // Optional custom endpoint
});
```

**Supported Models:**
- `text-embedding-3-small` (1536 dimensions, recommended)
- `text-embedding-3-large` (3072 dimensions)
- `text-embedding-ada-002` (1536 dimensions, legacy)

#### VoyageAI Embeddings

```typescript
const embedding = new VoyageAIEmbedding({
  apiKey: Deno.env.get("VOYAGEAI_API_KEY")!,
  model: "voyage-code-3", // Optimized for code
});
```

**Supported Models:**
- `voyage-code-3` (recommended for code)
- `voyage-3.5`, `voyage-3.5-lite`
- `voyage-3-large`

#### Gemini Embeddings

```typescript
const embedding = new GeminiEmbedding({
  apiKey: Deno.env.get("GEMINI_API_KEY")!,
  model: "gemini-embedding-001",
  outputDimensionality: 768, // Optional: 256, 768, 1536, or 3072
});
```

#### Ollama Embeddings

```typescript
const embedding = new OllamaEmbedding({
  model: "nomic-embed-text",
  host: "http://localhost:11434", // Optional
});
```

### Vector Database

#### MilvusRestfulVectorDatabase

```typescript
const vectorDatabase = new MilvusRestfulVectorDatabase({
  address: "https://your-endpoint.api.gcp-us-west1.zillizcloud.com",
  token: "your-zilliz-cloud-api-key",
  database?: "default", // Optional database name
});
```

## Search Results

```typescript
interface SemanticSearchResult {
  content: string;        // Code content
  relativePath: string;   // File path relative to codebase root
  startLine: number;      // Starting line number
  endLine: number;        // Ending line number
  language: string;       // Programming language
  score: number;          // Similarity score (0-1)
}
```

## Important Notes

### Name Matching

The context `name` **must match** the name used during indexing:

```typescript
// Node.js - Indexing
const context = new Context({ name: "my-project", ... });

// Deno - Searching
const searchContext = new SearchContext({ name: "my-project", ... });
```

### Hybrid Mode

By default, hybrid search is enabled (combines dense vectors + BM25 sparse vectors). This provides better search results than dense vectors alone.

To disable hybrid mode:

```typescript
const searchContext = new SearchContext({
  name: "my-project",
  embedding,
  vectorDatabase,
  hybridMode: false, // Use dense vectors only
});
```

Or set environment variable:

```bash
export HYBRID_MODE=false
```

### Limitations

1. **Indexing Not Supported**: Use `@mcampa/ai-context-core` (Node.js) for indexing
2. **REST API Only**: Milvus gRPC SDK not available in Deno
3. **No File Operations**: This package only performs searches
4. **Environment Compatibility**: Requires Deno 1.40+

## Comparison with Core Package

| Feature | Core (Node.js) | Deno Search |
|---------|---------------|-------------|
| Indexing | ✅ | ❌ |
| Searching | ✅ | ✅ |
| File Operations | ✅ | ❌ |
| AST Code Splitting | ✅ | ❌ |
| Milvus gRPC | ✅ | ❌ |
| Milvus REST | ✅ | ✅ |
| Size | ~1500 LOC | ~500 LOC |

## Examples

### Advanced Search with Filters

```typescript
// Search only TypeScript files
const tsResults = await searchContext.semanticSearch(
  "authentication middleware",
  5,
  0.5,
  'fileExtension in [".ts", ".tsx"]'
);

// Search in specific directory (requires relativePath in metadata)
const apiResults = await searchContext.semanticSearch(
  "API endpoint handler",
  10,
  0.6,
  'relativePath like "src/api/%"'
);
```

### Using Different Embedding Providers

```typescript
// VoyageAI (optimized for code)
const voyageEmbedding = new VoyageAIEmbedding({
  apiKey: Deno.env.get("VOYAGEAI_API_KEY")!,
  model: "voyage-code-3",
});

// Gemini
const geminiEmbedding = new GeminiEmbedding({
  apiKey: Deno.env.get("GEMINI_API_KEY")!,
  model: "gemini-embedding-001",
});

// Local Ollama
const ollamaEmbedding = new OllamaEmbedding({
  model: "nomic-embed-text",
  host: "http://localhost:11434",
});
```

### Error Handling

```typescript
try {
  const results = await searchContext.semanticSearch(query);
  
  if (results.length === 0) {
    console.log("No results found. Try a different query.");
  }
} catch (error) {
  if (error.message.includes("collection not found")) {
    console.error("Index not found. Please index the codebase first.");
  } else if (error.message.includes("API key")) {
    console.error("Invalid API key. Check your environment variables.");
  } else {
    console.error("Search failed:", error);
  }
}
```

## Troubleshooting

### "Collection not found"

The codebase hasn't been indexed yet, or you're using a different context name.

**Solution:** Index with `@mcampa/ai-context-core` using the same context name.

### "API key invalid"

Your OpenAI/VoyageAI/Gemini API key is incorrect or not set.

**Solution:** Check your environment variables:

```bash
echo $OPENAI_API_KEY
echo $MILVUS_ADDRESS
echo $MILVUS_TOKEN
```

### "Connection refused"

Cannot connect to Milvus/Zilliz Cloud.

**Solution:** Verify your Milvus address and token. Ensure the endpoint includes `https://` if using Zilliz Cloud.

### Empty Results

Search returns no results even though code exists.

**Possible causes:**
1. Query is too specific or uses wrong terminology
2. Threshold is too high (try 0.3-0.5)
3. Index doesn't contain the expected files

**Solution:** Try broader queries and lower threshold values.

## Development

### Run Tests

```bash
deno test --allow-read --allow-net --allow-env
```

### Type Check

```bash
deno check mod.ts
```

### Format Code

```bash
deno fmt
```

## Related Packages

- [@mcampa/ai-context-core](../core) - Core indexing engine (Node.js)
- [@mcampa/ai-context-mcp](../mcp) - MCP server integration

## License

MIT - See [LICENSE](../../LICENSE) for details.

## Contributing

Contributions are welcome! Please see the [main repository](../../README.md) for contribution guidelines.

