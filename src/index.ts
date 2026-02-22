#!/usr/bin/env npx tsx
import {
  fetchStats,
  fetchStars,
  fetchCommits,
  fetchPRs,
  fetchIssues,
  fetchForks,
  fetchContributors,
  fetchGHMentions,
  fetchHNMentions,
  fetchRedditMentions,
  fetchYouTubeMentions,
  fetchReleases,
  setApiUrl,
} from "./api.js";
import {
  summarizeTimeSeries,
  summarizeStars,
  summarizePRs,
  summarizeIssues,
  assessActivity,
  summarizeGHMentions,
  summarizeHN,
  summarizeReddit,
  summarizeYouTube,
  summarizeReleases,
  computeEvolution,
  analyzeGovernance,
  analyzeBuzz,
} from "./summarize.js";
import { buildPrompt } from "./prompt.js";

function usage(): never {
  console.error(`Usage: repo-summary-prompt <owner/repo> [--api-url <url>]

Examples:
  npx tsx src/index.ts golang/go
  npx tsx src/index.ts kubernetes/kubernetes --api-url http://localhost:8090

Environment:
  REPO_STATS_API_URL  Override the default API base URL`);
  process.exit(1);
}

function parseArgs(argv: string[]): { repo: string } {
  const args = argv.slice(2);
  let repo: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--api-url" && args[i + 1]) {
      setApiUrl(args[++i]);
    } else if (args[i] === "--help" || args[i] === "-h") {
      usage();
    } else if (!args[i].startsWith("-")) {
      repo = args[i];
    }
  }

  if (!repo || !repo.includes("/")) {
    console.error("Error: Please provide a repo in owner/repo format.\n");
    usage();
  }

  return { repo };
}

async function main() {
  const { repo } = parseArgs(process.argv);
  // Use full owner/repo for social search to reduce noise (e.g. "charmbracelet gum" not just "gum")
  const searchQuery = repo.replace("/", " ");

  console.error(`Fetching data for ${repo}...`);

  // Wrap each fetch to log progress to stderr
  async function tracked<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    console.error(`  → ${label}: fetching...`);
    const start = Date.now();
    try {
      const result = await fn();
      const secs = ((Date.now() - start) / 1000).toFixed(1);
      const ok = result != null;
      console.error(`  ${ok ? "✓" : "✗"} ${label}: ${ok ? "done" : "no data"} (${secs}s)`);
      return result;
    } catch {
      const secs = ((Date.now() - start) / 1000).toFixed(1);
      console.error(`  ✗ ${label}: failed (${secs}s)`);
      return null;
    }
  }

  // Run all API calls sequentially to avoid rate-limiting and excessive token usage
  const stats = await tracked("stats", () => fetchStats(repo));

  // If stats fetch failed, the repo likely doesn't exist — bail early
  if (!stats) {
    console.error(`\nError: Could not fetch data for "${repo}". The repository may not exist or the API is unavailable.`);
    process.exit(1);
  }

  // Emit stats metrics for UI dashboard
  if (stats) {
    console.error(`@@METRICS@@${JSON.stringify({
      type: "stats",
      data: {
        stars: stats.Stars,
        forks: stats.Forks,
        openIssues: stats.OpenIssues,
        language: stats.Language,
        created: stats.CreatedAt,
        archived: stats.Archived,
        size: stats.Size,
        mentionableUsers: stats.MentionableUsers,
        description: stats.Description || "",
      }
    })}`);
  }

  const starsData = await tracked("stars", () => fetchStars(repo));
  {
    // Skip last day (partial data if early in UTC day)
    const full = starsData?.stars?.length ? starsData.stars.slice(0, -1) : null;
    // noData=true means API responded but has no history (vs null = fetch failed)
    console.error(`@@METRICS@@${JSON.stringify({
      type: "stars",
      data: { series: full, total: full && full.length > 0 ? full[full.length - 1][2] : 0, noData: starsData != null && !full }
    })}`);
  }

  const commitsData = await tracked("commits", () => fetchCommits(repo));
  {
    const full = commitsData?.commits?.length ? commitsData.commits.slice(0, -1) : null;
    console.error(`@@METRICS@@${JSON.stringify({
      type: "commits",
      data: { series: full, total: full && full.length > 0 ? full[full.length - 1][2] : 0, noData: commitsData != null && !full }
    })}`);
  }

  const prsData = await tracked("PRs", () => fetchPRs(repo));
  {
    // PRs: [date, opened, closed, merged, openedCumul, closedCumul, mergedCumul, ?, ?]
    const full = prsData?.prs?.length ? prsData.prs.slice(0, -1) : null;
    console.error(`@@METRICS@@${JSON.stringify({
      type: "prs",
      data: { series: full ? full.map((e: any) => [e[0], e[1], e[2], e[3]]) : null, noData: prsData != null && !full }
    })}`);
  }

  const issuesData = await tracked("issues", () => fetchIssues(repo));
  {
    const full = issuesData?.issues?.length ? issuesData.issues.slice(0, -1) : null;
    console.error(`@@METRICS@@${JSON.stringify({
      type: "issues",
      data: { series: full ? full.map((e: any) => [e[0], e[1], e[2]]) : null, noData: issuesData != null && !full }
    })}`);
  }

  const forksData = await tracked("forks", () => fetchForks(repo));
  {
    const full = forksData?.forks?.length ? forksData.forks.slice(0, -1) : null;
    console.error(`@@METRICS@@${JSON.stringify({
      type: "forks",
      data: { series: full, total: full && full.length > 0 ? full[full.length - 1][2] : 0, noData: forksData != null && !full }
    })}`);
  }

  const contributorsData = await tracked("contributors", () => fetchContributors(repo));
  {
    const full = contributorsData?.contributors?.length ? contributorsData.contributors.slice(0, -1) : null;
    console.error(`@@METRICS@@${JSON.stringify({
      type: "contributors",
      data: { series: full, total: full && full.length > 0 ? full[full.length - 1][2] : 0, noData: contributorsData != null && !full }
    })}`);
  }

  const ghMentionsData = await tracked("GH mentions", () => fetchGHMentions(repo));
  const hnData = await tracked("HackerNews", () => fetchHNMentions(searchQuery));
  const redditData = await tracked("Reddit", () => fetchRedditMentions(repo));
  const youtubeData = await tracked("YouTube", () => fetchYouTubeMentions(searchQuery));
  const releasesData = await tracked("releases", () => fetchReleases(repo));

  // Signal that all metrics have been sent
  console.error(`@@METRICS@@${JSON.stringify({ type: "complete" })}`);

  // Summarize
  const stars = starsData ? summarizeStars(starsData) : null;
  const commits = commitsData ? summarizeTimeSeries(commitsData.commits) : null;
  const prs = prsData ? summarizePRs(prsData) : null;
  const issues = issuesData ? summarizeIssues(issuesData) : null;
  const forks = forksData ? summarizeTimeSeries(forksData.forks) : null;
  const contributors = contributorsData ? summarizeTimeSeries(contributorsData.contributors) : null;
  const activity = stats ? assessActivity(stats) : null;
  const ghMentions = ghMentionsData ? summarizeGHMentions(ghMentionsData) : null;
  const hn = hnData ? summarizeHN(hnData) : null;
  const reddit = redditData ? summarizeReddit(redditData) : null;
  const youtube = youtubeData ? summarizeYouTube(youtubeData) : null;
  const releases = releasesData ? summarizeReleases(releasesData) : null;

  // Governance & Buzz analysis
  const governance = analyzeGovernance({ stats, contributors, commits, prs, ghMentions: ghMentionsData });
  const buzz = analyzeBuzz({ hn, reddit, youtube, ghMentions, commits, stats });

  // Emit governance & buzz metrics for UI
  if (governance) {
    console.error(`@@METRICS@@${JSON.stringify({ type: "governance", data: governance })}`);
  }
  if (buzz) {
    console.error(`@@METRICS@@${JSON.stringify({ type: "buzz", data: buzz })}`);
  }

  // Compute evolution / momentum analysis
  const evolution = computeEvolution({ stars, commits, prs, issues, forks, activity, releases });

  // Build and print prompt
  const prompt = buildPrompt({
    repo,
    stats,
    stars,
    commits,
    prs,
    issues,
    forks,
    contributors,
    activity,
    ghMentions,
    hn,
    reddit,
    youtube,
    releases,
    evolution,
    governance,
    buzz,
  });

  // Emit a compact prompt for Ollama (avoids timeouts on small local models)
  {
    const s30 = (arr: any[] | undefined | null, i: number): number =>
      arr ? arr.slice(-30).reduce((t: number, e: any) => t + (Number(e[i]) || 0), 0) : 0;
    const lines = [
      `Repository: ${repo}`,
      stats?.Description ? `Description: ${stats.Description}` : "",
      `Language: ${stats?.Language || "unknown"}`,
      `Stars: ${(stats?.Stars || 0).toLocaleString()} (+${s30(starsData?.stars, 1)} in last 30d)`,
      `Forks: ${(stats?.Forks || 0).toLocaleString()} (+${s30(forksData?.forks, 1)} in last 30d)`,
      `Commits (30d): ${s30(commitsData?.commits, 1)}`,
      `Pull Requests (30d): ${s30(prsData?.prs, 1)} opened, ${s30(prsData?.prs, 3)} merged`,
      `Issues (30d): ${s30(issuesData?.issues, 1)} opened, ${s30(issuesData?.issues, 2)} closed (${stats?.OpenIssues || 0} currently open)`,
      `Active contributors (30d): ${s30(contributorsData?.contributors, 1)}`,
      governance ? `Governance: ${governance.label} — ${governance.description}` : "",
      buzz ? `Social buzz: ${buzz.label} (score: ${buzz.score}/100, ${buzz.totalMentions} total mentions)` : "",
    ].filter(Boolean).join("\n");
    const ollamaPrompt = `Analyze this GitHub repository:\n\n${lines}\n\nIn 3-4 concise sentences, summarize its current health, development momentum, and any notable trends.`;
    console.error(`@@METRICS@@${JSON.stringify({ type: "ollama-prompt", data: ollamaPrompt })}`);
  }

  console.log(prompt);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
