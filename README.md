# RepoChronicle

**Understand any GitHub repository at a glance** — activity, momentum, ecosystem impact, and social reach, all in one dashboard.

> **No sign-up. No ads. No cookies.** Use the [hosted version](https://emanuelef.github.io/repo-summary-prompt) instantly, or self-host your own instance in minutes.

<img width="1262" height="2010" alt="RepoChronicle screenshot" src="https://github.com/user-attachments/assets/19ab9dd0-6af5-4799-b67a-61e0255f0a6c" />

## What it tells you

Type any `owner/repo` and get an instant snapshot of:

- **Is this repo alive?** — commit frequency, last activity, liveness score, release cadence
- **Is it growing or stalling?** — star/fork/contributor trends, month-over-month momentum signals
- **Who's using it beyond GitHub?** — download counts from NPM, PyPI, Cargo, and Homebrew (auto-detected, verified by matching the package's repo URL)
- **Is the wider world talking about it?** — Hacker News posts, YouTube videos, cross-repo GitHub mentions
- **Is the project well maintained?** — PR merge rates, issue resolution rates, backlog trends, contributor concentration
- **Full LLM-ready summary** — everything above assembled into a structured Markdown prompt you can paste into any AI for a deep analysis

The hosted version runs on a shared GitHub PAT (also used by [Daily Stars Explorer](https://emanuelef.github.io/daily-stars-explorer)) and is rate-limited to protect it: **20 fetches/day**, with a **1-hour cooldown** on repos over 10k stars. For regular use, [self-host your own instance](#self-hosting-with-docker-compose) with your own PAT.

## Privacy

- **No account required** — just type a repo name and go
- **No tracking or analytics** — no cookies, no fingerprinting, no third-party scripts
- **No data stored** — results are computed on demand and cached in memory only (cleared at UTC midnight)
- **Self-hostable** — run your own instance with full control over your data and API token

## How it works

Given an `owner/repo`, RepoChronicle:

1. Fetches GitHub metrics: stars, commits, PRs, issues, forks, contributors, releases
2. Checks **package registries** (NPM, PyPI, Cargo, Homebrew) for download/install counts — verified by matching the package's `repository` URL back to the GitHub repo
3. Searches **social platforms**: Hacker News posts, YouTube videos, cross-repo GitHub mentions
4. Computes time-series summaries: 30-day windows, month-over-month growth rates, trend signals
5. Renders an **interactive dashboard** with metric cards and charts
6. Outputs a **structured Markdown prompt** ready to paste into ChatGPT, Claude, Gemini, or any LLM

## Requirements

- **Node.js** ≥ 18 (uses native `fetch`)
- **npm** or any compatible package manager

## Self-hosting with Docker Compose

The easiest way to run everything locally is with Docker Compose. It starts two containers:

- **`daily-stars-explorer`** — the stats API (port 8080) that powers the metrics
- **`repo-chronicle`** — the web UI + CLI (port 3000), pre-configured to talk to the stats API

**Requirements:** Docker, a GitHub Personal Access Token ([generate one](https://github.com/settings/tokens) — no repo access needed).

```bash
# 1. Copy the example env file and fill in your PAT
cp .env.example .env
# Edit .env and set PAT=your_github_token

# 2. Start both services
docker compose up
```

Open [http://localhost:3000](http://localhost:3000). Done.

To pull the latest images before starting:

```bash
docker compose pull && docker compose up
```

> The `REPO_STATS_API_URL` is automatically wired between containers — no manual configuration needed.

## Development

### Web UI

Use the included `dev.sh` script:

```bash
./dev.sh          # start the server (installs deps automatically)
./dev.sh restart  # kill any running instance, then start fresh
./dev.sh stop     # stop the server
```

The server starts at `http://localhost:3000`.

Optional environment variables:

```bash
PORT=8080 ./dev.sh
REPO_STATS_API_URL=http://localhost:8090 ./dev.sh
USE_OLLAMA=true OLLAMA_URL=http://localhost:11434 OLLAMA_MODEL=llama3 ./dev.sh
```

### CLI

The CLI can also be run directly — it prints a full Markdown prompt to stdout:

```bash
npm install
npx tsx src/index.ts golang/go
npx tsx src/index.ts facebook/react > prompt.md
```

Progress/error messages go to stderr so you can pipe the prompt cleanly.

#### Custom API URL

```bash
npx tsx src/index.ts golang/go --api-url http://localhost:8090
# or
REPO_STATS_API_URL=http://localhost:8090 npx tsx src/index.ts golang/go
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Web UI port |
| `REPO_STATS_API_URL` | `https://emafuma.mywire.org:8090` | Stats API base URL |
| `USE_OLLAMA` | — | Set to `true` to enable local AI analysis |
| `OLLAMA_URL` | — | Ollama server URL |
| `OLLAMA_MODEL` | — | Ollama model name |
| `MAX_DAILY_FETCHES` | `20` | Daily fetch quota (`unlimited` to disable) |

## Project structure

```
src/
  index.ts       CLI entry point — arg parsing, parallel fetching, orchestration
  api.ts         API client — types and fetch functions for each data source
  summarize.ts   Data crunching — time-series analysis, PR/issue rates, momentum metrics
  prompt.ts      Prompt builder — assembles all summaries into a structured Markdown prompt
ui/
  server.mjs     Hono web server — spawns CLI, streams results via SSE
  main.js        Frontend entry point
  dashboard.js   Metric cards and charts rendering
  handlers.js    UI interactions (theme, autocomplete, share, etc.)
  tracker.js     Fetch progress tracker and skeleton loading
  state.js       Shared frontend state
  config.js      Constants (fetch steps, language colours, API base)
  utils.js       Pure utility functions
```

## Dashboard sections

| Section | What it shows |
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
| Hacker News / YouTube | Social reach and top posts/videos |
| Governance | Leadership model, contributor concentration, bus factor signals |
| Social Buzz | Aggregate buzz score from HN, YouTube, GH mentions |
| Momentum & Evolution | MoM growth rates, aggregate momentum signal, key signals |
| Package Registry Downloads | NPM, PyPI, Cargo, Homebrew stats (auto-detected) |

## Example LLM analysis

<details>
<summary>ChatGPT analysis of <code>emanuelef/daily-stars-explorer</code></summary>

Below is a structured analysis of **emanuelef/daily-stars-explorer** and how it is evolving within the open-source ecosystem.

---

# 1️⃣ Trajectory Summary — **Clearly Accelerating**

This project is in a strong acceleration phase. Nearly all activity metrics (stars, commits, PRs, forks) show sharp month-over-month growth, and recent activity levels are significantly above historical averages. The repository is not just active — it is intensifying in momentum.

---

# 2️⃣ Development Velocity — **Shipping Much Faster**

* 604 total commits · 65 in the last 30 days (vs. 21/month average)
* MoM commit growth: **+210%** · PR activity MoM: **+999%**
* Latest release: 5 days ago · releases becoming more frequent

---

# 3️⃣ Community & Adoption Trends — **Interest Is Rising**

* 322 stars · 20 in last 30 days (well above 11/month avg) · MoM: **+82%**
* 15 YouTube videos (762 views) · 2 GitHub cross-repo mentions

---

# 4️⃣ Maintenance Health — **Strong Operational Discipline**

* Issues not accumulating · backlog shrinking · liveness score: 90/100
* High PR merge throughput — contributions actively integrated

---

# 5️⃣ Key Risks

* Only 3 contributors — high bus-factor risk
* Limited ecosystem footprint (low forks, minimal mentions)

---

# 6️⃣ 6-Month Outlook

450–600 stars · continued high commit frequency · possible v1.x stabilisation · 1–2 new contributors if outreach grows

</details>

## License

MIT
