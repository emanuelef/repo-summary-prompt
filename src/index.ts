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
  tryOllama,
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
  if (starsData?.stars?.length) {
    // Skip last day (partial data if early in UTC day)
    const full = starsData.stars.slice(0, -1);
    console.error(`@@METRICS@@${JSON.stringify({
      type: "stars",
      data: { series: full, total: full.length > 0 ? full[full.length - 1][2] : 0 }
    })}`);
  }

  const commitsData = await tracked("commits", () => fetchCommits(repo));
  if (commitsData?.commits?.length) {
    const full = commitsData.commits.slice(0, -1);
    console.error(`@@METRICS@@${JSON.stringify({
      type: "commits",
      data: { series: full, total: full.length > 0 ? full[full.length - 1][2] : 0 }
    })}`);
  }

  const prsData = await tracked("PRs", () => fetchPRs(repo));
  if (prsData?.prs?.length) {
    // PRs: [date, opened, closed, merged, openedCumul, closedCumul, mergedCumul, ?, ?]
    const full = prsData.prs.slice(0, -1);
    console.error(`@@METRICS@@${JSON.stringify({
      type: "prs",
      data: { series: full.map((e: any) => [e[0], e[1], e[2], e[3]]) }
    })}`);
  }

  const issuesData = await tracked("issues", () => fetchIssues(repo));
  if (issuesData?.issues?.length) {
    const full = issuesData.issues.slice(0, -1);
    console.error(`@@METRICS@@${JSON.stringify({
      type: "issues",
      data: { series: full.map((e: any) => [e[0], e[1], e[2]]) }
    })}`);
  }

  const forksData = await tracked("forks", () => fetchForks(repo));
  if (forksData?.forks?.length) {
    const full = forksData.forks.slice(0, -1);
    console.error(`@@METRICS@@${JSON.stringify({
      type: "forks",
      data: { series: full, total: full.length > 0 ? full[full.length - 1][2] : 0 }
    })}`);
  }

  const contributorsData = await tracked("contributors", () => fetchContributors(repo));
  if (contributorsData?.contributors?.length) {
    const full = contributorsData.contributors.slice(0, -1);
    console.error(`@@METRICS@@${JSON.stringify({
      type: "contributors",
      data: { series: full, total: full.length > 0 ? full[full.length - 1][2] : 0 }
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

  // Run Ollama analysis if enabled
  if (process.env.USE_OLLAMA === 'true') {
    console.error(`  → Ollama: running analysis...`);
    const ollamaResult = await tryOllama(prompt);
    if (ollamaResult) {
      console.error(`  ✓ Ollama: done`);
      console.error(`@@METRICS@@${JSON.stringify({
        type: "ollama",
        data: { response: ollamaResult, model: process.env.OLLAMA_MODEL || 'unknown' }
      })}`);
    } else {
      console.error(`  ✗ Ollama: failed`);
    }
  }

  console.log(prompt);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
