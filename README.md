# repo-summary-prompt

CLI tool that fetches GitHub repo metrics from a stats API and generates a structured LLM prompt summarizing a project's health, momentum, and evolution trajectory.

## What it does

Given an `owner/repo`, the tool:

1. Fetches stars, commits, PRs, issues, forks, contributors, releases, and social mentions (GitHub, Hacker News, Reddit, YouTube) in parallel.
2. Computes summaries for each metric — totals, 30-day windows, trends, merge/close rates, backlog health.
3. Derives an overall **momentum & evolution** assessment (month-over-month growth rates, key signals).
4. Outputs a single Markdown prompt ready to paste into any LLM for analysis.

## Requirements

- **Node.js** ≥ 18 (uses native `fetch`)
- **npm** or any compatible package manager

## Install

```bash
git clone <this-repo>
cd repo-summary-prompt
npm install
```

## Usage

```bash
# Run directly with tsx
npx tsx src/index.ts <owner/repo>

# Examples
npx tsx src/index.ts golang/go
npx tsx src/index.ts facebook/react
npx tsx src/index.ts charmbracelet/gum
```

The generated prompt is printed to **stdout**. Progress/error messages go to **stderr**, so you can pipe the prompt cleanly:

```bash
npx tsx src/index.ts kubernetes/kubernetes > prompt.md
```

### Custom API URL

By default the tool talks to `https://emafuma.mywire.org:8090`. Override with a flag or env var:

```bash
# Flag
npx tsx src/index.ts golang/go --api-url http://localhost:8090

# Environment variable
REPO_STATS_API_URL=http://localhost:8090 npx tsx src/index.ts golang/go
```

### Using as a global CLI

```bash
npm link
repo-summary-prompt golang/go
```

## Build

```bash
npm run build   # compiles to dist/
```

## Project structure

```
src/
  index.ts       CLI entry point — arg parsing, parallel fetching, orchestration
  api.ts         API client — types and fetch functions for each endpoint
  summarize.ts   Data crunching — time-series analysis, PR/issue rates, evolution metrics
  prompt.ts      Prompt builder — assembles all summaries into a structured Markdown prompt
```

## Output sections

The generated prompt includes:

| Section | Data |
|---|---|
| Repository Info | Language, age, stars, forks, size, archived status |
| Activity Assessment | Liveness score, last commit/star/release dates |
| Star History | Totals, 30d/10d counts, trend, peak day/period |
| Commit Activity | Same time-series breakdown |
| Pull Request Activity | Opened/closed/merged counts, merge rate, velocity trend |
| Issue Activity | Opened/closed counts, resolution rate, backlog trend |
| Fork & Contributor Growth | Time-series trends |
| Releases | Total, latest, cadence, recent frequency |
| GitHub Mentions | Cross-repo references in issues/PRs/discussions |
| Hacker News / Reddit / YouTube | Social reach and top posts |
| **Momentum & Evolution** | MoM growth rates, aggregate momentum signal, key signals |
| Analysis Request | Structured questions asking for trajectory, velocity, health, risks, 6-month outlook |

## License

MIT
