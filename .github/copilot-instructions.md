# GitHub Copilot Instructions

## Project: RepoChronicle (repo-summary-prompt)

TypeScript CLI + Hono web server that fetches GitHub repo metrics and generates structured Markdown prompts for LLM analysis of project health and trajectory.

## Stack

- **Runtime**: Node.js ≥ 18, ESM modules (`"type": "module"`)
- **Language**: TypeScript 5 (CLI), plain JS (UI server + frontend)
- **Server**: Hono (`ui/server.mjs`)
- **Frontend**: Vanilla JS (`ui/main.js`) — no framework, no bundler
- **CLI runner**: `tsx` (TypeScript execute)

## Code style

- TypeScript: strict mode, no `any` unless unavoidable
- ESM imports: always use `.js` extension for local imports (even when source is `.ts`)
- Keep frontend in vanilla JS — do not introduce React, Vue, or other frameworks
- Prefer `fetch` with `AbortController` for HTTP calls with timeouts
- Error handling: log to `console.error`, return `null` for optional data, don't throw from fetch helpers

## Architecture patterns

### Adding a new data source
1. Add types and a `fetchXxx(name, githubRepo)` function to `src/api.ts`
   - Always verify the source links back to `githubRepo` before returning data
2. Import and call in `src/index.ts` alongside existing parallel fetches
   - Emit `→ ID: fetching...` before and `✓/✗ ID: done/no data` after
3. Add the metric to `RegistryData` (or appropriate type) in `src/prompt.ts` and add a prompt line
4. Add `{ id: 'ID', label: 'Label' }` to `FETCH_STEPS` in `ui/main.js`
5. Render a metric card in the `updateDashboard()` function in `ui/main.js`

### SSE protocol (`ui/server.mjs` → browser)
- `progress` events: raw stderr lines for the fetch tracker
- `metrics` events: `@@METRICS@@`-prefixed JSON objects emitted from `src/index.ts`
- `prompt` event: final stdout output (the Markdown prompt)

## Do not

- Start the web server from the `ui/` directory — always run from project root
- Add frontend framework dependencies to `ui/package.json`
- Store any user data or GitHub tokens server-side
