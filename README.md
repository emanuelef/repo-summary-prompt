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

## Example output

```
npx tsx src/index.ts emanuelef/daily-stars-explorer
Fetching data for emanuelef/daily-stars-explorer...
You are a software project analyst specialising in open-source ecosystem dynamics. Based on the following data about the GitHub repository **emanuelef/daily-stars-explorer**, provide a comprehensive summary of how this project is **evolving** — its trajectory, momentum, and the direction it is heading.

## Repository Info
- Name: emanuelef/daily-stars-explorer
- Language: JavaScript
- Created: 2023-09-22
- Stars: 322 | Forks: 9 | Open Issues: 4
- Mentionable Users: 3
- Archived: No
- Size: 1,602 KB
- Default Branch: main

## Activity Assessment
- Activity Level: **very active**
- Liveness Score: 90/100
- Last Commit: 2026-02-12 (0 days ago)
- Last Star: 2026-02-12
- Last Release: 2026-02-07 (5 days ago)

## Star History Summary
- Total (tracked period): 321
- Avg per month: 11
- Last 30 days: 20
- Last 10 days: 3
- Peak day: 25-11-2024 (19)
- Trend: growing
- Tracked period: 22-09-2023 to 11-02-2026 (874 days)
- All-time peak day: 25-11-2024 (19 stars)
- Peak period: 23-11-2024 to 02-12-2024 (40 stars)

## Commit Activity Summary
- Total (tracked period): 604
- Avg per month: 21
- Last 30 days: 65
- Last 10 days: 32
- Peak day: 01-10-2023 (14)
- Trend: growing
- Tracked period: 22-09-2023 to 12-02-2026 (875 days)

## Pull Request Activity
- Total (tracked period): 203
- Avg per month: 7
- Last 30 days: 15
- Last 10 days: 9
- Peak day: 08-04-2024 (11)
- Trend: growing
- Tracked period: 22-09-2023 to 12-02-2026 (875 days)
- Total opened: 203 | Total closed: 129 | Total merged: 35,237
- Merge rate: 17358% | Close rate: 64%
- Last 30 days — opened: 15, closed: 1, merged: 1,899
- PR velocity trend: accelerating

## Issue Activity
- Total (tracked period): 28
- Avg per month: 1
- Last 30 days: 1
- Last 10 days: 0
- Peak day: 05-03-2024 (3)
- Trend: growing
- Tracked period: 22-09-2023 to 12-02-2026 (875 days)
- Total opened: 28 | Total closed: 14,095
- Resolution rate: 50339%
- Last 30 days — opened: 1, closed: 859 (net: -858)
- Backlog trend: shrinking

## Fork Activity Summary
- Total (tracked period): 9
- Avg per month: 0
- Last 30 days: 1
- Last 10 days: 1
- Peak day: 17-10-2024 (1)
- Trend: growing
- Tracked period: 22-09-2023 to 12-02-2026 (875 days)

## Contributor Growth
- Total (tracked period): 3
- Avg per month: 0
- Last 30 days: 0
- Last 10 days: 0
- Peak day: 24-09-2023 (1)
- Trend: stable
- Tracked period: 22-09-2023 to 12-02-2026 (875 days)

## Releases
- Total releases: 9
- Latest release: v0.1.0 (2026-02-08)
- Releases in last 90 days: 2
- Avg days between releases: 92

## GitHub Mentions (references in other repos)
- Total mentions: 2
- Issues: 0 | PRs: 2 | Discussions: 0
- Mentions in last 30 days: 1

## YouTube Presence
- Total videos: 15
- Total views: 762
- Top video: "Cosmic Stream (feat. Matrineasial & Ky Adeyemo)" (548 views)

## Project Momentum & Evolution
- Overall momentum: **strong growth**
- Star growth MoM: +82%
- Commit activity MoM: +210%
- PR activity MoM: +999%
- Issue activity MoM: +999%
- Fork growth MoM: +999%

### Key Signals
- Commit frequency is increasing
- Star growth is accelerating
- PR velocity is accelerating
- High PR merge rate — contributions are actively being integrated
- Issue backlog is shrinking — maintainers are catching up
- Very recent commits — active development

---

Based on all the data above, provide a comprehensive analysis of **how this project is evolving**. Structure your answer as follows:

1. **Trajectory Summary** — Is this project accelerating, cruising, decelerating, or stalling? Describe the overall direction in 2-3 sentences.
2. **Development Velocity** — How has commit, PR, and release activity changed recently? Is the team shipping faster or slower?
3. **Community & Adoption Trends** — Are stars, forks, and contributors growing? Is external interest (HN, Reddit, YouTube) rising or fading?
4. **Maintenance Health** — Are issues being resolved? Is the PR merge rate healthy? Is the backlog under control?
5. **Key Strengths** — What is going well for this project?
6. **Key Risks & Concerns** — What signals suggest potential problems?
7. **6-Month Outlook** — Based on current trends, what is this project likely to look like in 6 months?
```

## License

MIT
