#!/usr/bin/env node
import cac from "cac";
import { fetchStatus } from "./src/api.js";
import { resolveToken } from "./src/config.js";
import { runSetup } from "./src/setup.js";
import { buildJsonStatus, buildStatusLine } from "./src/status.js";

const cli = cac("claude-status-ollama");

cli
  .option("--status", "Fetch status and print the status line (default command shows help)")
  .option("--token <token>", "Ollama API token")
  .option("--token-file <path>", "Path to a file containing the Ollama API token")
  .option("--plain", "Disable colors and emoji for plain terminal/script output")
  .option("--json", "Print raw JSON instead of a formatted status line")
  .option("--watch <seconds>", "Refresh the status line every N seconds (manual testing mode)")
  .help()
  .version("1.0.0");

cli.command("setup", "Configure Claude Code status-line hook in settings.json")
  .option("--global", "Write to ~/.claude/settings.json instead of the project file")
  .action((options) => {
    try {
      const result = runSetup({ global: options.global });
      console.log(`Wrote ${result.targetLabel} Claude Code settings to ${result.targetPath}`);
      console.log("Status-line hook configured:");
      console.log(JSON.stringify(result.config, null, 2));
      process.exitCode = 0;
    } catch (err) {
      console.error(`Setup failed: ${err.message || err}`);
      process.exitCode = 1;
    }
  });

async function runStatus({ token, tokenFile, plain, json, watchSeconds }) {
  console.log('hi', token, tokenFile, plain, json, watchSeconds)
  const resolvedToken = resolveToken({ token, tokenFile });
  const apiResult = await fetchStatus(resolvedToken);
  console.log('apiResult', apiResult, resolvedToken)

  if (json) {
    const output = buildJsonStatus(apiResult);
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(buildStatusLine(apiResult, { plain }));
  }
}

async function main() {
  const parsed = cli.parse();
  const options = parsed.options;

  // cac already prints help/version when these flags are present.
  if (options.help || options.version) {
    return;
  }

  if (parsed.command) {
    // setup command handled by cac action above
    return;
  }

  if (!options.status) {
    cli.outputHelp();
    return;
  }

  const watchSeconds = options.watch ? Number(options.watch) : NaN;
  if (options.watch && (Number.isNaN(watchSeconds) || watchSeconds <= 0)) {
    console.error("Error: --watch requires a positive number of seconds");
    process.exitCode = 1;
    return;
  }

  try {
    await runStatus({
      token: options.token,
      tokenFile: options.tokenFile,
      plain: options.plain,
      json: options.json,
      watchSeconds,
    });

    if (watchSeconds > 0) {
      const interval = setInterval(async () => {
        try {
          await runStatus({
            token: options.token,
            tokenFile: options.tokenFile,
            plain: options.plain,
            json: options.json,
            watchSeconds,
          });
        } catch (err) {
          console.error(`Watch refresh failed: ${err.message || err}`);
        }
      }, watchSeconds * 1000);

      process.on("SIGINT", () => {
        clearInterval(interval);
        process.exitCode = 0;
      });
      process.on("SIGTERM", () => {
        clearInterval(interval);
        process.exitCode = 0;
      });
    }
  } catch (err) {
    console.error(`Error: ${err.message || err}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
