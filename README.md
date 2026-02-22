# repo-summary-prompt

CLI tool that fetches GitHub repo metrics from a stats API and generates a structured LLM prompt summarizing a project's health, momentum, and evolution trajectory.

> **No sign-up. No ads. No cookies.** Use the [hosted version](https://emanuelef.github.io/repo-summary-prompt) instantly, or self-host your own instance in minutes.

<img width="1262" height="2010" alt="screencapture-localhost-3000-2026-02-13-17_09_11" src="https://github.com/user-attachments/assets/19ab9dd0-6af5-4799-b67a-61e0255f0a6c" />

## Privacy

- **No account required** — just type a repo name and go
- **No tracking or analytics** — no cookies, no fingerprinting, no third-party scripts
- **No data stored** — results are computed on demand and cached in memory only (cleared at UTC midnight)
- **Self-hostable** — run your own instance with full control over your data and API token

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

## Self-hosting with Docker Compose

The easiest way to run everything locally is with Docker Compose. It starts two containers:

- **`daily-stars-explorer`** — the stats API (port 8080) that powers the metrics
- **`repo-summary-prompt`** — the web UI + CLI (port 3000), pre-configured to talk to the stats API

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

The project has two parts: a CLI backend and a web UI frontend.

### Backend (CLI)

```bash
npm install
npx tsx src/index.ts <owner/repo>
```

### Frontend (Web UI)

```bash
cd ui
npm install
cd ..
node ui/server.mjs
```

The web UI starts at `http://localhost:3000`. It spawns the CLI as a child process and streams progress via SSE.

To override the stats API URL, set `REPO_STATS_API_URL`:

```bash
REPO_STATS_API_URL=http://localhost:8090 node ui/server.mjs
```

### Running both together

```bash
# Terminal 1 — install deps
npm install && cd ui && npm install && cd ..

# Terminal 1 — start the web UI (serves frontend + runs CLI on demand)
node ui/server.mjs
```

Then open `http://localhost:3000` in your browser.

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

## Example ChatGPT response

Below is a structured analysis of **emanuelef/daily-stars-explorer** and how it is evolving within the open-source ecosystem.

---

# 1️⃣ Trajectory Summary — **Clearly Accelerating**

This project is in a strong acceleration phase. Nearly all activity metrics (stars, commits, PRs, forks) show sharp month-over-month growth, and recent activity levels are significantly above historical averages. The repository is not just active — it is intensifying in momentum.

It appears to be transitioning from a stable niche tool into a rapidly evolving and increasingly visible project.

---

# 2️⃣ Development Velocity — **Shipping Much Faster**

### 🔹 Commits

* 604 total commits
* 65 in the last 30 days (vs. 21/month average)
* 32 in the last 10 days
* MoM growth: **+210%**
* Trend: growing

Commit frequency is substantially higher than baseline, indicating active feature work, refactoring, or scaling efforts. Development is currently operating at roughly **3x historical velocity**.

### 🔹 Pull Requests

* 15 opened in last 30 days
* 9 in last 10 days
* PR velocity trend: accelerating
* MoM growth: **+999%**

The PR layer shows explosive recent activity. Even accounting for anomalous merge statistics, the direction is clear: contribution throughput has sharply increased.

### 🔹 Releases

* 9 total releases
* 2 releases in last 90 days
* Latest release: 5 days ago
* Avg 92 days between releases

Releases are becoming more frequent, and the very recent release suggests a stabilization and packaging phase accompanying higher dev velocity.

**Conclusion:** The team is shipping faster than at any previous time in the project’s history.

---

# 3️⃣ Community & Adoption Trends — **Interest Is Rising**

### ⭐ Stars

* 322 total
* 20 in last 30 days (well above 11/month average)
* MoM star growth: **+82%**
* Trend: growing

Star growth is accelerating. The project had a breakout spike in November 2024, but recent growth suggests a *second wave of traction*.

### 🍴 Forks

* 9 total
* 1 in last 30 days
* MoM fork growth: +999%

Fork activity remains modest in absolute terms but is trending upward. This suggests experimentation and possibly downstream reuse.

### 👥 Contributors

* 3 total contributors
* Stable over time

Contributor count is not expanding. The project remains effectively maintainer-driven.

### 📢 External Signals

* 2 GitHub mentions (1 in last 30 days)
* 15 YouTube videos (762 views total)

External visibility is emerging but still niche. The presence of YouTube content suggests early ecosystem formation, though overall reach is still limited.

**Conclusion:** Adoption is rising, but the contributor base remains narrow. The project is gaining attention faster than it is decentralizing.

---

# 4️⃣ Maintenance Health — **Strong Operational Discipline**

### 🧹 Issues

* 28 opened total
* Only 4 currently open
* Backlog shrinking
* Resolution rate extremely high
* Net -858 in last 30 days (indicates cleanup automation or bulk closures)

Despite anomalies in resolution metrics, the signal is clear: issues are not accumulating. The backlog is tightly controlled.

### 🔄 PR Handling

* High merge throughput
* Active integration of contributions
* PR velocity accelerating

Even though merge statistics appear inflated, the pattern suggests that maintainers are integrating changes quickly and not letting work stagnate.

### 🟢 Liveness Score: 90/100

Very recent commits and release activity confirm active stewardship.

**Conclusion:** The project is well maintained, responsive, and not suffering from backlog decay.

---

# 5️⃣ Key Strengths

### 🚀 1. Strong Upward Momentum

All growth signals — stars, commits, PRs — are accelerating simultaneously.

### ⚡ 2. High Development Energy

Recent 30-day commit and PR volume significantly exceed historical averages.

### 🧹 3. Backlog Under Control

Issues are being resolved faster than they accumulate.

### 📦 4. Release Discipline

Recent releases show maturation beyond experimental phase.

### 📈 5. Second-Wave Traction

After a 2024 peak, growth is resuming — suggesting sustained rather than one-off interest.

---

# 6️⃣ Key Risks & Concerns

### ⚠️ 1. Low Contributor Diversity

Only 3 contributors across 875 days. If most work is driven by a single maintainer, scaling risk exists.

### ⚠️ 2. PR & Issue Metric Anomalies

The extremely high merge and resolution percentages suggest automation artifacts or data irregularities. If much of the activity is automated, apparent velocity may overstate organic community engagement.

### ⚠️ 3. Limited Ecosystem Footprint

* Low forks
* Minimal GitHub mentions
* Modest YouTube engagement

The project is growing, but not yet embedded deeply in the broader open-source ecosystem.

### ⚠️ 4. Star-to-Fork Ratio

322 stars but only 9 forks indicates interest without heavy downstream development adoption.

---

# 7️⃣ 6-Month Outlook

If current trends persist:

### Likely Scenario (Most Probable)

* 450–600 stars
* Continued high commit frequency
* More frequent releases (potential move toward v1.x stabilization)
* Slight contributor growth (possibly 1–2 new contributors)

### Structural Evolution

The project appears to be moving from:

> "Interesting tool with periodic spikes"
> to
> "Actively evolving product with consistent momentum"

If contributor growth begins matching star growth, it could transition into a small but healthy ecosystem project.

### Risk Scenario

If activity is primarily maintainer-driven and unsustainable, velocity could normalize sharply after this burst phase.

---

# 📊 Overall Assessment

**Status: High-Growth Phase with Maintainer-Driven Acceleration**

daily-stars-explorer is currently in a pronounced expansion cycle — development velocity, adoption, and release cadence are all rising simultaneously. Operational health is strong, backlog is controlled, and momentum signals are positive.

The key inflection point ahead is contributor diversification.
If community participation expands, the project could mature into a durable open-source tool.
If not, it remains a high-energy but centrally driven effort.

At present, the trajectory is clearly upward.
```

## License

MIT
