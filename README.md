# claude-status-ollama

A tiny, dependency-light [Claude Code](https://claude.ai/code) status-line hook that shows the current Claude model, your Ollama account email, usage bars, and auto-switch state.

## Install

```bash
npx claude-status-ollama setup
```

Or install globally / locally so it is always available:

```bash
npm install -g claude-status-ollama
# or
npm install --save-dev claude-status-ollama
```

You can also run it straight from a local path without publishing:

```bash
cd claude-status-ollama
npx . setup
```

## Setup

The `setup` subcommand writes the Claude Code `statusLine` hook into the most appropriate settings file:

- Project settings: `.claude/settings.json` (used by default if a `.claude` directory already exists)
- Global settings: `~/.claude/settings.json`

```bash
# Project settings
npx claude-status-ollama setup

# Global settings
npx claude-status-ollama setup --global
```

The generated configuration looks like this:

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx claude-status-ollama --status",
    "refreshInterval": 10,
    "padding": 2
  }
}
```

## Authentication

The token is resolved in this priority order:

1. `--token <token>` CLI argument
2. `OLLAMA_TOKEN` environment variable
3. File path from `OLLAMA_TOKEN_FILE` environment variable
4. `--token-file <path>` CLI argument
5. Default file: `~/.claude/ollama_tok.txt`

If no token is found, the status line still renders the current Claude model without making an API call.

## Usage

```bash
# Print the status line (requires --status)
npx claude-status-ollama --status

# Script-friendly JSON
npx claude-status-ollama --status --json

# Plain, colorless output
npx claude-status-ollama --status --plain

# Refresh every 5 seconds for manual testing
npx claude-status-ollama --status --watch 5

# Override token for one run
npx claude-status-ollama --status --token "ollama_..."
```

## What the status line shows

A typical line looks like:

```
Sonnet 5 | user@example.com | Sess [██████░░░░] 60% | Week [████████░░] 80% | Auto ON | Resets 2h/3d
```

- **Model** — detected from `CLAUDE_MODEL`, `CLAUDE_CODE_MODEL`, or `ANTHROPIC_MODEL`
- **Email** — sanitized and truncated if too long
- **Session usage** — colored ASCII progress bar
- **Weekly usage** — colored ASCII progress bar
- **Auto-switch** — `ON`/`OFF` indicator
- **Reset timers** — time until session/weekly reset
- **Switched →** — yellow prefix when `autoSwitch.triggered` is `true`

## Environment variables

| Variable | Purpose |
| --- | --- |
| `OLLAMA_TOKEN` | Ollama API token |
| `OLLAMA_TOKEN_FILE` | Path to a file containing the token |
| `CLAUDE_MODEL` / `CLAUDE_CODE_MODEL` / `ANTHROPIC_MODEL` | Detect the current Claude model name |
| `CLAUDE_THINKING` / `CLAUDE_EFFORT` | Optional thinking level / effort indicator |
| `NO_COLOR` | Disables colors (also auto-detected via `chalk`) |

## Flags

| Flag | Description |
| --- | --- |
| `--status` | Emit the status line |
| `--token <token>` | Provide the API token inline |
| `--token-file <path>` | Read the API token from a file |
| `--plain` | No colors, no emoji, scripting-friendly |
| `--json` | Output raw JSON instead of the formatted line |
| `--watch <seconds>` | Refresh every N seconds |
| `--global` | With `setup`, write to global settings |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

## Development

```bash
cd claude-status-ollama
npm install
node index.js --help
node index.js --status --plain
npm test
```

## License

MIT
