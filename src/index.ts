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

  // Fire all API calls in parallel
  const [
    statsResult,
    starsResult,
    commitsResult,
    prsResult,
    issuesResult,
    forksResult,
    contributorsResult,
    ghMentionsResult,
    hnResult,
    redditResult,
    youtubeResult,
    releasesResult,
  ] = await Promise.allSettled([
    fetchStats(repo),
    fetchStars(repo),
    fetchCommits(repo),
    fetchPRs(repo),
    fetchIssues(repo),
    fetchForks(repo),
    fetchContributors(repo),
    fetchGHMentions(repo),
    fetchHNMentions(searchQuery),
    fetchRedditMentions(searchQuery),
    fetchYouTubeMentions(searchQuery),
    fetchReleases(repo),
  ]);

  // Extract values (null if rejected or returned null)
  const val = <T>(r: PromiseSettledResult<T | null>): T | null =>
    r.status === "fulfilled" ? r.value : null;

  const stats = val(statsResult);
  const starsData = val(starsResult);
  const commitsData = val(commitsResult);
  const prsData = val(prsResult);
  const issuesData = val(issuesResult);
  const forksData = val(forksResult);
  const contributorsData = val(contributorsResult);
  const ghMentionsData = val(ghMentionsResult);
  const hnData = val(hnResult);
  const redditData = val(redditResult);
  const youtubeData = val(youtubeResult);
  const releasesData = val(releasesResult);

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
