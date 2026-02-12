const DEFAULT_API_URL = "https://emafuma.mywire.org:8090";

function getApiUrl(): string {
  return process.env.REPO_STATS_API_URL || DEFAULT_API_URL;
}

// --- Types ---

export interface RepoStats {
  GHPath: string;
  Stars: number;
  Commits: number;
  Size: number;
  Language: string;
  OpenIssues: number;
  Forks: number;
  Archived: boolean;
  DefaultBranch: string;
  MentionableUsers: number;
  CreatedAt: string;
  LastReleaseDate: string;
  LivenessScore: number;
  LastStarDate: string;
  StarsTimeline: [string, number, number][];
  LastCommitDate: string;
  CommitsTimeline: [string, number, number][];
  DifferentAuthors: number;
  Description?: string;
}

// Time-series entry: [date DD-MM-YYYY, daily count, cumulative]
export type TimeSeriesEntry = [string, number, number];

export interface AllStarsResponse {
  stars: TimeSeriesEntry[];
  newLast10Days: number;
  maxPeriods: { StartDay: string; EndDay: string; TotalStars: number }[];
  maxPeaks: { Day: string; Stars: number }[];
}

export interface AllCommitsResponse {
  commits: TimeSeriesEntry[];
}

// PRs have 9 elements: [date, opened, openedCumul, closed, closedCumul, merged, mergedCumul, ?, ?]
export type PREntry = [string, ...number[]];

export interface AllPRsResponse {
  prs: PREntry[];
}

// Issues have 7 elements: [date, opened, openedCumul, closed, closedCumul, ?, ?]
export type IssueEntry = [string, ...number[]];

export interface AllIssuesResponse {
  issues: IssueEntry[];
}

export interface AllForksResponse {
  forks: TimeSeriesEntry[];
}

export interface AllContributorsResponse {
  contributors: [string, number, number][];
}

export interface GHMention {
  Type: string;
  Title: string;
  URL: string;
  Repository: string;
  CreatedAt: string;
  UpdatedAt: string;
  State: string;
  Author: string;
  Body: string;
  IsClosed: boolean;
}

export interface GHMentionsResponse {
  targetRepo: string;
  totalMentions: number;
  issuesCount: number;
  pullRequestsCount: number;
  discussionsCount: number;
  mentions: GHMention[];
}

export interface HNItem {
  Title: string;
  CreatedAt: string;
  Points: number;
  NumComments: number;
  URL: string;
  HNURL: string;
  MatchedWords: string[];
}

export interface RedditItem {
  title: string;
  created: string;
  ups: number;
  num_comments: number;
  url: string;
  content: string;
}

export interface YouTubeItem {
  video_id: string;
  title: string;
  view_count: number;
  published_at: string;
  video_url: string;
}

export interface Release {
  createdAt: string;
  publishedAt: string;
  name: string;
  tagName: string;
  isPrerelease: boolean;
  isDraft: boolean;
  url: string;
  authorLogin: string;
  totalReleases: number;
}

// --- Fetch helpers ---

async function fetchJson<T>(path: string, params: Record<string, string>, timeoutMs = 120_000): Promise<T | null> {
  const url = new URL(path, getApiUrl());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      console.error(`[API] ${path} returned ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[API] ${path} failed: ${msg}`);
    return null;
  }
}

// --- Public fetch functions ---

export function fetchStats(repo: string) {
  return fetchJson<RepoStats>("/stats", { repo });
}

export function fetchStars(repo: string) {
  return fetchJson<AllStarsResponse>("/allStars", { repo });
}

export function fetchCommits(repo: string) {
  return fetchJson<AllCommitsResponse>("/allCommits", { repo });
}

export function fetchPRs(repo: string) {
  return fetchJson<AllPRsResponse>("/allPRs", { repo });
}

export function fetchIssues(repo: string) {
  return fetchJson<AllIssuesResponse>("/allIssues", { repo });
}

export function fetchForks(repo: string) {
  return fetchJson<AllForksResponse>("/allForks", { repo });
}

export function fetchContributors(repo: string) {
  return fetchJson<AllContributorsResponse>("/allContributors", { repo });
}

export function fetchGHMentions(repo: string) {
  return fetchJson<GHMentionsResponse>("/ghmentions", { repo, limit: "100" });
}

export function fetchHNMentions(query: string) {
  return fetchJson<HNItem[]>("/hackernews", { query });
}

export function fetchRedditMentions(query: string) {
  return fetchJson<RedditItem[]>("/reddit", { query });
}

export function fetchYouTubeMentions(query: string) {
  return fetchJson<YouTubeItem[]>("/youtube", { query });
}

export function fetchReleases(repo: string) {
  return fetchJson<Release[]>("/allReleases", { repo });
}

// Accept custom API URL from CLI flag
export function setApiUrl(url: string) {
  process.env.REPO_STATS_API_URL = url;
}
