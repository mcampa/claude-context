#!/usr/bin/env node

/**
 * AI Context CLI - Entry point
 *
 * Runs the CLI directly with Node.js.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliRoot = join(__dirname, "..");

const mainScript = join(cliRoot, "dist", "index.js");

// Set NODE_PATH to include the cli package's node_modules
const nodePath = join(cliRoot, "node_modules");
const existingNodePath = process.env.NODE_PATH || "";
const newNodePath = existingNodePath
  ? `${nodePath}:${existingNodePath}`
  : nodePath;

const env = {
  ...process.env,
  NODE_PATH: newNodePath,
  // Pass the cli package root for tsx resolution in config-loader
  AI_CONTEXT_CLI_ROOT: cliRoot,
};

const child = spawn(process.execPath, [mainScript, ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
  cwd: process.cwd(),
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error("Failed to start CLI:", err.message);
  process.exit(1);
});
