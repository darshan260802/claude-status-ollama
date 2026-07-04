import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const STATUS_LINE_CONFIG = {
  type: "command",
  command: "npx claude-status-ollama --status",
  refreshInterval: 10,
  padding: 2,
};

function getGlobalSettingsPath() {
  return resolve(homedir(), ".claude", "settings.json");
}

function getProjectSettingsPath() {
  return resolve(process.cwd(), ".claude", "settings.json");
}

function readJson(path) {
  try {
    const text = readFileSync(path, { encoding: "utf8" });
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function ensureDir(path) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function runSetup({ global = false } = {}) {
  const projectPath = getProjectSettingsPath();
  const globalPath = getGlobalSettingsPath();

  let targetPath;
  let targetLabel;

  if (global) {
    targetPath = globalPath;
    targetLabel = "global";
  } else if (existsSync(dirname(projectPath))) {
    targetPath = projectPath;
    targetLabel = "project";
  } else {
    targetPath = globalPath;
    targetLabel = "global";
  }

  const settings = readJson(targetPath);
  settings.statusLine = STATUS_LINE_CONFIG;

  ensureDir(targetPath);
  writeFileSync(targetPath, JSON.stringify(settings, null, 2) + "\n", { encoding: "utf8" });

  return {
    ok: true,
    targetPath,
    targetLabel,
    config: STATUS_LINE_CONFIG,
  };
}
