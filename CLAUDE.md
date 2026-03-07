# CLAUDE.md

Instructions for Claude Code when working in this repository.

## Project overview

**repo-summary-prompt** (also known as RepoLens) is a GitHub repo analysis tool that fetches metrics and generates structured Markdown prompts for LLM analysis.

Architecture:
- `src/` — TypeScript CLI (`npx tsx src/index.ts <owner/repo>`)
- `ui/` — Hono web server (`ui/server.mjs`) + vanilla JS frontend (`ui/main.js`, `ui/styles.css`)
- The web server spawns the CLI as a child process and streams results to the browser via SSE

## Commands

```bash
# Run the CLI directly
npx tsx src/index.ts <owner/repo>

# Start the web UI (must run from project root)
node ui/server.mjs

# Or use the dev script (start / stop / restart)
./dev.sh

# Type-check
npx tsc --noEmit

# Build
npm run build
```

## Key conventions

- **Always run `node ui/server.mjs` from the project root** — the server spawns `src/index.ts` relative to `process.cwd()`, so starting from `ui/` will break module resolution.
- All TypeScript is ESM (`"type": "module"`) — imports must use `.js` extensions even for `.ts` source files.
- The CLI writes progress lines to **stderr** and the final prompt to **stdout**.
- Lines matching `@@METRICS@@` on stderr are JSON payloads parsed by the server and forwarded as SSE `metrics` events to the browser.

## Architecture details

### Fetch flow (`src/index.ts`)
1. GitHub stats via the upstream API (configurable via `REPO_STATS_API_URL` or `--api-url`)
2. Package registry stats in parallel: NPM, PyPI, Cargo, Homebrew — each verifies the package's `repository` URL matches the GitHub repo before returning data
3. Summaries computed in `src/summarize.ts`
4. Prompt assembled in `src/prompt.ts` and printed to stdout

### SSE streaming (`ui/server.mjs`)
- Spawns `npx tsx src/index.ts` as a child process
- Lines starting with `@@METRICS@@` → parsed and sent as SSE `metrics` events
- Other stderr lines → sent as SSE `progress` events
- Final stdout → sent as SSE `prompt` event

### Fetch tracker (`ui/main.js`)
- `FETCH_STEPS` array defines expected steps; `parseProgressLine()` matches `→ ID: fetching...` / `✓ ID: done` / `✗ ID: no data` patterns
- `updateDashboard()` re-renders metric cards on every `metrics` SSE event

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Web UI port |
| `REPO_STATS_API_URL` | `https://emafuma.mywire.org:8090` | Stats API base URL |
| `USE_OLLAMA` | — | Set to `true` to enable local AI analysis |
| `OLLAMA_URL` | — | Ollama server URL |
| `OLLAMA_MODEL` | — | Ollama model name |
| `MAX_DAILY_FETCHES` | `20` | Daily fetch quota (`unlimited` to disable) |
