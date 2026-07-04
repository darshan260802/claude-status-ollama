import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const DEFAULT_TOKEN_PATH = resolve(homedir(), ".claude", "ollama_tok.txt");

function readTokenFile(path) {
  if (!path) return null;
  try {
    const content = readFileSync(resolve(path), { encoding: "utf8" });
    const token = content.trim();
    return token || null;
  } catch {
    return null;
  }
}

export function resolveToken({ token, tokenFile } = {}) {
  // Priority 1: explicit --token argument
  if (token) return token;

  // Priority 2: OLLAMA_TOKEN environment variable
  const envToken = process.env.OLLAMA_TOKEN?.trim();
  if (envToken) return envToken;

  // Priority 3: OLLAMA_TOKEN_FILE environment variable
  const envFileToken = readTokenFile(process.env.OLLAMA_TOKEN_FILE);
  if (envFileToken) return envFileToken;

  // Priority 4: --token-file argument
  const argFileToken = readTokenFile(tokenFile);
  if (argFileToken) return argFileToken;

  // Priority 5: default ~/.claude/ollama_tok.txt
  return readTokenFile(DEFAULT_TOKEN_PATH);
}
