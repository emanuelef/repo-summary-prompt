# AGENTS.md

Instructions for AI coding agents (OpenAI Codex, Devin, etc.) working in this repository.

## Project overview

**repo-summary-prompt** is a GitHub repo analysis tool with two parts:
- A TypeScript CLI (`src/`) that fetches metrics and outputs a structured Markdown prompt
- A web UI (`ui/`) with a Hono server and vanilla JS frontend that wraps the CLI

## Setup

```bash
npm install
cd ui && npm install && cd ..
```

## Running

```bash
# CLI
npx tsx src/index.ts <owner/repo>

# Web UI (must be started from project root)
./dev.sh
# or: node ui/server.mjs
```

## Key files

| File | Purpose |
|---|---|
| `src/index.ts` | CLI entry — arg parsing, parallel fetches, SSE progress, prompt output |
| `src/api.ts` | Fetch functions for GitHub stats API, NPM, PyPI, Cargo, Homebrew |
| `src/summarize.ts` | Metric summarization — time-series, PR/issue rates, evolution |
| `src/prompt.ts` | Assembles all summaries into the final Markdown prompt |
| `ui/server.mjs` | Hono server — spawns CLI, streams SSE to browser |
| `ui/main.js` | Vanilla JS frontend — SSE consumer, metric cards, fetch tracker |
| `ui/styles.css` | Frontend styles |
| `dev.sh` | Dev script with start / stop / restart |

## Important rules

- TypeScript uses ESM — import paths must end in `.js` (even for `.ts` files)
- Run server from the **project root**, not from `ui/`
- Stderr goes to SSE progress stream; stdout is the final prompt
- `@@METRICS@@` lines on stderr carry JSON metric payloads
- Package registry fetches (NPM, PyPI, Cargo, Homebrew) verify the `repository` field matches the GitHub repo before returning data

## Tests

There is no test suite currently. Verify changes manually with `npx tsx src/index.ts <owner/repo>` and by loading the web UI.
