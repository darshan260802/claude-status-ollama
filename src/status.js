import chalk from "chalk";

const BAR_WIDTH = 10;
const MAX_EMAIL_LEN = 24;
const DEFAULT_MAX_WIDTH = 200;
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

function usageSegment(label, percent, colorize) {
  if (percent === null || percent === undefined) return "";
  const rounded = parseFloat(percent);
  const bar = progressBar(rounded);
  const coloredBar = rounded >= 90
    ? colorize.red(bar)
    : rounded >= 70
      ? colorize.yellow(bar)
      : colorize.green(bar);
  return `${label}[${coloredBar}] ${rounded}%`;
}

function autoSwitchSegment(autoSwitch, colorize) {
  if (!autoSwitch) return colorize.gray("Auto Switch OFF");
  const on = autoSwitch.enabled !== false;
  const label = on ? "Auto Switch ON" : "Auto Switch OFF";
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

function parsePercent(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = String(value).trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*%?$/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function parseHumanDuration(text) {
  if (!text) return null;
  const match = String(text)
    .trim()
    .toLowerCase()
    .match(/^([0-9]+(?:\.[0-9]+)?)\s*(second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months)s?\.?$/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;

  const unit = match[2];
  const msPerUnit = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  };
  return Math.round(amount * (msPerUnit[unit] || 0));
}

function durationStringToDate(text) {
  const ms = parseHumanDuration(text);
  return ms === null ? null : new Date(Date.now() + ms).toISOString();
}

function normalizeUsage(data) {
  // New API shape: usage.session.usage and usage.weekly.usage as percent strings.
  if (data.usage?.session?.usage !== undefined) {
    return {
      session: parsePercent(data.usage.session.usage),
      weekly: parsePercent(data.usage.weekly.usage),
    };
  }
  // Alternative new shape on connectedAccount.
  if (data.connectedAccount?.sessionUsage !== undefined) {
    return {
      session: parsePercent(data.connectedAccount.sessionUsage),
      weekly: parsePercent(data.connectedAccount.weeklySessionUsage),
    };
  }
  // Legacy shape.
  return {
    session:
      parsePercent(data.sessionUsage?.percent) ??
      parsePercent(data.session_usage?.percent) ??
      parsePercent(data.session?.percent),
    weekly:
      parsePercent(data.weeklyUsage?.percent) ??
      parsePercent(data.weekly_usage?.percent) ??
      parsePercent(data.weekly?.percent),
  };
}

function normalizeResets(data) {
  // New API shape: usage.session.reset and usage.weekly.reset as human durations.
  if (data.usage?.session?.reset !== undefined) {
    return {
      session: durationStringToDate(data.usage.session.reset),
      weekly: durationStringToDate(data.usage.weekly.reset),
    };
  }
  // Alternative new shape on connectedAccount.
  if (data.connectedAccount?.sessionResetIn !== undefined) {
    return {
      session: durationStringToDate(data.connectedAccount.sessionResetIn),
      weekly: durationStringToDate(data.connectedAccount.weeklySessionResetIn),
    };
  }
  // Legacy ISO date shape.
  return data.resets || data.resetTimes || {};
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

function truncateByRemovingSegments(segments, separator, maxVisible) {
  // Start with the full line; if it does not fit, drop the lowest-priority
  // segment(s) from the end until it does. We never force an ellipsis.
  const sep = visibleLength(separator);
  for (let i = segments.length; i > 0; i--) {
    const keep = segments.slice(0, i);
    const line = keep.join(separator);
    const len = visibleLength(line) + (keep.length > 1 ? sep * (keep.length - 1) : 0);
    if (len <= maxVisible) return line;
  }
  return segments[0] || "";
}

function resolveMaxWidth(widthOption) {
  if (widthOption !== undefined && Number.isFinite(widthOption) && widthOption > 0) {
    return Math.floor(widthOption);
  }
  const columns = process.stdout?.columns || 0;
  return columns > 0 ? Math.min(columns, DEFAULT_MAX_WIDTH) : DEFAULT_MAX_WIDTH;
}

export function buildStatusLine(apiResult, { plain = false, width } = {}) {
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

  const email = sanitizeEmail(
    data.connectedAccount?.email || data.email || data.account?.email
  );
  const autoSwitch = data.autoSwitch || data.auto_switch;
  const usage = normalizeUsage(data);
  const resets = normalizeResets(data);
  const triggered = autoSwitch?.triggered === true;

  const segments = [];

  if (triggered) {
    segments.push(colorize.yellow("Switched →"));
  }

  segments.push(colorize.cyan(model));

  if (email) {
    segments.push(colorize.white(email));
  }

  const sessionReset = formatDuration(resets.session || resets.sessionReset);
  const weeklyReset = formatDuration(resets.weekly || resets.weeklyReset);

  const sess = usageSegment("Sess ", usage.session, colorize);
  if (sess) {
    segments.push(sess + colorize.gray(` | reset: ${sessionReset || "-"}`));
  }

  const week = usageSegment("Week ", usage.weekly, colorize);
  if (week) {
    segments.push(week + colorize.gray(` | reset: ${weeklyReset || "-"}`));
  }

  segments.push(autoSwitchSegment(autoSwitch, colorize));

  if (thinking) {
    segments.push(colorize.magenta("Think: " + (thinking.level || thinking.effort)));
  }

  const separator = plain ? " | " : " " + chalk.dim("|") + " ";
  const line = segments.join(separator);

  // Use the terminal width when available, capped at a reasonable maximum.
  // In non-TTY / piped output, fall back to DEFAULT_MAX_WIDTH.
  const maxWidth = resolveMaxWidth(width);

  // Only truncate as a last resort, and prefer dropping low-priority segments
  // (thinking, auto switch, weekly, session) before forcing an ellipsis.
  if (visibleLength(line) <= maxWidth) return line;
  return truncateByRemovingSegments(segments, separator, maxWidth);
}

export function buildJsonStatus(apiResult) {
  const data = apiResult?.data || {};
  const usage = normalizeUsage(data);
  const resets = normalizeResets(data);
  return {
    model: detectClaudeModel(),
    thinking: detectThinking(),
    ok: apiResult?.ok ?? false,
    noToken: apiResult?.noToken ?? false,
    error: apiResult?.error || null,
    email: data.connectedAccount?.email || data.email || data.account?.email || null,
    device: data.device || null,
    connectedAccount: data.connectedAccount || null,
    autoSwitch: data.autoSwitch || data.auto_switch || null,
    sessionUsage: usage.session,
    weeklyUsage: usage.weekly,
    sessionResetIn: data.usage?.session?.reset || data.connectedAccount?.sessionResetIn || null,
    weeklyResetIn: data.usage?.weekly?.reset || data.connectedAccount?.weeklySessionResetIn || null,
    resets,
  };
}
