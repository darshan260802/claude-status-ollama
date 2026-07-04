import chalk from "chalk";

const BAR_WIDTH = 10;
const MAX_EMAIL_LEN = 24;
const MAX_LINE_LEN = 118;
const ANSI_RE = /\[[0-9;]*m/g;

const MODEL_ALIASES = {
  "claude-opus-4-8": "Opus 4.8",
  "claude-opus-4": "Opus 4",
  "claude-opus": "Opus",
  "claude-sonnet-5": "Sonnet 5",
  "claude-sonnet-4": "Sonnet 4",
  "claude-sonnet": "Sonnet",
  "claude-haiku-4-5": "Haiku 4.5",
  "claude-haiku-4": "Haiku 4",
  "claude-haiku": "Haiku",
  "claude-fable-5": "Fable 5",
  "claude-fable": "Fable",
};

function detectClaudeModel() {
  const raw =
    process.env.CLAUDE_MODEL ||
    process.env.CLAUDE_CODE_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    "";

  if (!raw) return "Claude";

  const lower = raw.toLowerCase();
  for (const [prefix, alias] of Object.entries(MODEL_ALIASES)) {
    if (lower.includes(prefix)) return alias;
  }
  return raw;
}

function detectThinking() {
  const level = process.env.CLAUDE_THINKING;
  const effort = process.env.CLAUDE_EFFORT;
  if (!level && !effort) return null;
  return { level, effort };
}

function sanitizeEmail(email) {
  if (!email) return null;
  const str = String(email).trim();
  if (str.length <= MAX_EMAIL_LEN) return str;
  return str.slice(0, MAX_EMAIL_LEN - 1) + "…";
}

function progressBar(percent) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = Math.round((p / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function formatDuration(targetDate) {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return null;
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "now";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function usageSegment(label, usage, colorize) {
  if (!usage) return "";
  const percent = Math.round(usage.percent ?? 0);
  const bar = progressBar(percent);
  const coloredBar = percent >= 90
    ? colorize.red(bar)
    : percent >= 70
      ? colorize.yellow(bar)
      : colorize.green(bar);
  return `${label}[${coloredBar}] ${percent}%`;
}

function autoSwitchSegment(autoSwitch, colorize) {
  if (!autoSwitch) return colorize.gray("Auto OFF");
  const on = autoSwitch.enabled !== false;
  const label = on ? "Auto ON" : "Auto OFF";
  const colored = on ? colorize.green(label) : colorize.red(label);
  return colored;
}

function noColorChalk() {
  return new Proxy(Object.create(null), {
    get(_, prop) {
      return (value) => String(value ?? "");
    },
  });
}

function visibleLength(str) {
  return str.replace(ANSI_RE, "").length;
}

function truncateVisible(str, maxLen) {
  if (visibleLength(str) <= maxLen) return str;

  let result = "";
  let visible = 0;
  let inAnsi = false;
  for (const char of str) {
    if (char === "") inAnsi = true;
    if (inAnsi) {
      result += char;
      if (char === "m") inAnsi = false;
      continue;
    }
    if (visible >= maxLen - 1) break;
    result += char;
    visible++;
  }
  // Reset any open ANSI sequences so the ellipsis inherits terminal default color.
  return result + "[0m…";
}

export function buildStatusLine(apiResult, { plain = false } = {}) {
  const colorize = plain ? noColorChalk() : chalk;

  const model = detectClaudeModel();
  const thinking = detectThinking();

  if (apiResult?.noToken) {
    let line = `${colorize.cyan(model)}`;
    if (thinking) {
      line += ` | ${colorize.magenta("Think: " + (thinking.level || thinking.effort))}`;
    }
    return line;
  }

  if (!apiResult?.ok) {
    let line = `${colorize.cyan(model)}`;
    if (apiResult?.error) {
      line += ` | ${colorize.gray("API: " + apiResult.error.replace(/\s+/g, " ").slice(0, 40))}`;
    }
    if (thinking) {
      line += ` | ${colorize.magenta("Think: " + (thinking.level || thinking.effort))}`;
    }
    return line;
  }

  const data = apiResult.data || {};
  const email = sanitizeEmail(data.email || data.account?.email);
  const autoSwitch = data.autoSwitch || data.auto_switch;
  const sessionUsage = data.sessionUsage || data.session_usage || data.session;
  const weeklyUsage = data.weeklyUsage || data.weekly_usage || data.weekly;
  const resets = data.resets || data.resetTimes || {};
  const triggered = autoSwitch?.triggered === true;

  const segments = [];

  if (triggered) {
    segments.push(colorize.yellow("Switched →"));
  }

  segments.push(colorize.cyan(model));

  if (email) {
    segments.push(colorize.white(email));
  }

  const sess = usageSegment("Sess ", sessionUsage, colorize);
  if (sess) segments.push(sess);

  const week = usageSegment("Week ", weeklyUsage, colorize);
  if (week) segments.push(week);

  segments.push(autoSwitchSegment(autoSwitch, colorize));

  const sessionReset = formatDuration(resets.session || resets.sessionReset);
  const weeklyReset = formatDuration(resets.weekly || resets.weeklyReset);
  if (sessionReset || weeklyReset) {
    const label = `Resets ${sessionReset || "-"}/${weeklyReset || "-"}`;
    segments.push(colorize.gray(label));
  }

  if (thinking) {
    segments.push(colorize.magenta("Think: " + (thinking.level || thinking.effort)));
  }

  const separator = plain ? " | " : " " + chalk.dim("|") + " ";
  const line = segments.join(separator);

  console.log('line', line, visibleLength(line), MAX_LINE_LEN)
  // Hard cap to keep the line readable in narrow terminals.
  // truncateVisible preserves ANSI escape sequences so colors do not bleed.
  return visibleLength(line) > MAX_LINE_LEN ? truncateVisible(line, MAX_LINE_LEN) : line;
}

export function buildJsonStatus(apiResult) {
  const data = apiResult?.data || {};
  return {
    model: detectClaudeModel(),
    thinking: detectThinking(),
    ok: apiResult?.ok ?? false,
    noToken: apiResult?.noToken ?? false,
    error: apiResult?.error || null,
    email: data.email || data.account?.email || null,
    autoSwitch: data.autoSwitch || data.auto_switch || null,
    sessionUsage: data.sessionUsage || data.session_usage || data.session || null,
    weeklyUsage: data.weeklyUsage || data.weekly_usage || data.weekly || null,
    resets: data.resets || data.resetTimes || null,
  };
}
