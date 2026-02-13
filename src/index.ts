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
  const starsData = await tracked("stars", () => fetchStars(repo));
  const commitsData = await tracked("commits", () => fetchCommits(repo));
  const prsData = await tracked("PRs", () => fetchPRs(repo));
  const issuesData = await tracked("issues", () => fetchIssues(repo));
  const forksData = await tracked("forks", () => fetchForks(repo));
  const contributorsData = await tracked("contributors", () => fetchContributors(repo));
  const ghMentionsData = await tracked("GH mentions", () => fetchGHMentions(repo));
  const hnData = await tracked("HackerNews", () => fetchHNMentions(searchQuery));
  const redditData = await tracked("Reddit", () => fetchRedditMentions(searchQuery));
  const youtubeData = await tracked("YouTube", () => fetchYouTubeMentions(searchQuery));
  const releasesData = await tracked("releases", () => fetchReleases(repo));

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
  });

  console.log(prompt);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
