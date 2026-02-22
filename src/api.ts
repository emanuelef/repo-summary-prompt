// --- Ollama Integration ---

interface OllamaRequest {
  model: string;
  prompt: string;
  stream?: boolean;
}

interface OllamaResponse {
  response: string;
}

/**
 * Checks if Ollama is available and enabled via environment variables.
 * @returns {boolean}
 */
function isOllamaEnabled(): boolean {
  return process.env.USE_OLLAMA === 'true' && !!process.env.OLLAMA_URL && !!process.env.OLLAMA_MODEL;
}

/**
 * Sends a prompt to Ollama if enabled and available, returns the result or null on error/timeout.
 * @param {string} prompt
 * @param {number} [timeoutMs=1200000] - up to 20 minutes
 * @returns {Promise<string|null>}
 */
export async function tryOllama(prompt: string, timeoutMs = 1200000): Promise<string | null> {
  if (!isOllamaEnabled()) return null;
  const url = `${process.env.OLLAMA_URL?.replace(/\/$/, '')}/api/generate`;
  const reqBody: OllamaRequest = {
    model: process.env.OLLAMA_MODEL!,
    prompt,
    stream: false,
  };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error(`[Ollama] API returned status ${res.status}`);
      return null;
    }
    const data = (await res.json()) as OllamaResponse;
    return data.response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Ollama] Request failed: ${msg}`);
    return null;
  }
}
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

interface FetchJsonOptions {
  /** Timeout per individual HTTP request attempt (default: 5 min) */
  perRequestTimeoutMs?: number;
  /** Total wall-clock time to keep retrying (default: 15 min) */
  totalTimeoutMs?: number;
  /** Initial delay between retries in ms (default: 3000). Doubles each retry, capped at 30s. */
  retryDelayMs?: number;
  /** Label for progress logs (default: the path) */
  label?: string;
  /**
   * Optional predicate: if the backend returns HTTP 200 but the data fails this check
   * (e.g. empty array because the backend hasn't indexed the repo yet), treat it as
   * a transient failure and keep retrying until the deadline.
   */
  validateData?: (data: any) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(
  path: string,
  params: Record<string, string>,
  opts: FetchJsonOptions = {},
): Promise<T | null> {
  const {
    perRequestTimeoutMs = 5 * 60_000,
    totalTimeoutMs = 15 * 60_000,
    retryDelayMs = 3_000,
    label = path,
    validateData,
  } = opts;

  const url = new URL(path, getApiUrl());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const deadline = Date.now() + totalTimeoutMs;
  let delay = retryDelayMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    try {
      const controller = new AbortController();
      const remaining = deadline - Date.now();
      const timeout = Math.min(perRequestTimeoutMs, remaining);
      if (timeout <= 0) break;

      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as T;
        // If a validator is provided and the data fails it (e.g. empty array because
        // the backend hasn't indexed this repo yet), treat it as transient and retry.
        if (validateData && !validateData(data)) {
          console.error(`[API] ${label} returned 200 but empty data (attempt ${attempt}), retrying in ${Math.round(delay / 1000)}s...`);
        } else {
          if (attempt > 1) {
            console.error(`[API] ${label} ✓ succeeded on attempt ${attempt}`);
          }
          return data;
        }
      }

      // 404 = repo not found — don't retry, fail immediately
      if (res.status === 404) {
        console.error(`[API] ${label} returned 404 — not found`);
        return null;
      }

      // Other non-2xx: log and retry (the backend may still be processing)
      console.error(`[API] ${label} returned ${res.status} (attempt ${attempt}), retrying in ${Math.round(delay / 1000)}s...`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (Date.now() + delay >= deadline) {
        console.error(`[API] ${label} failed after ${attempt} attempt(s): ${msg}`);
        return null;
      }
      console.error(`[API] ${label} error: ${msg} (attempt ${attempt}), retrying in ${Math.round(delay / 1000)}s...`);
    }

    // Wait before retrying; bail out if we'd exceed the deadline
    if (Date.now() + delay >= deadline) break;
    await sleep(delay);
    delay = Math.min(delay * 2, 30_000);
  }

  console.error(`[API] ${label} timed out after ${attempt} attempt(s) (${Math.round(totalTimeoutMs / 60_000)} min total)`);
  return null;
}

// --- Public fetch functions ---

export function fetchStats(repo: string) {
  return fetchJson<RepoStats>("/stats", { repo }, { label: "stats" });
}

// Example usage for Ollama integration:
// const ollamaResult = await tryOllama("Summarize this repo's recent activity...");
// if (ollamaResult) { ... use ollamaResult ... }

export function fetchStars(repo: string) {
  // Stars can take very long for large repos (daily stars explorer needs to process history)
  return fetchJson<AllStarsResponse>("/allStars", { repo }, {
    label: "stars",
    totalTimeoutMs: 30 * 60_000,   // up to 30 minutes total
    perRequestTimeoutMs: 10 * 60_000, // 10 min per attempt
    validateData: (d) => d?.stars?.length > 0,
  });
}

export function fetchCommits(repo: string) {
  return fetchJson<AllCommitsResponse>("/allCommits", { repo }, {
    label: "commits",
    validateData: (d) => d?.commits?.length > 0,
  });
}

export function fetchPRs(repo: string) {
  return fetchJson<AllPRsResponse>("/allPRs", { repo }, {
    label: "PRs",
    validateData: (d) => d?.prs?.length > 0,
  });
}

export function fetchIssues(repo: string) {
  return fetchJson<AllIssuesResponse>("/allIssues", { repo }, {
    label: "issues",
    validateData: (d) => d?.issues?.length > 0,
  });
}

export function fetchForks(repo: string) {
  return fetchJson<AllForksResponse>("/allForks", { repo }, {
    label: "forks",
    validateData: (d) => d?.forks?.length > 0,
  });
}

export function fetchContributors(repo: string) {
  return fetchJson<AllContributorsResponse>("/allContributors", { repo }, {
    label: "contributors",
    validateData: (d) => d?.contributors?.length > 0,
  });
}

export function fetchGHMentions(repo: string) {
  return fetchJson<GHMentionsResponse>("/ghmentions", { repo, limit: "100" }, { label: "GH mentions" });
}

export function fetchHNMentions(query: string) {
  return fetchJson<HNItem[]>("/hackernews", { query }, { label: "HackerNews" });
}

export function fetchRedditMentions(query: string) {
  return fetchJson<RedditItem[]>("/reddit", { query }, { label: "Reddit" });
}

export function fetchYouTubeMentions(query: string) {
  return fetchJson<YouTubeItem[]>("/youtube", { query }, { label: "YouTube" });
}

export function fetchReleases(repo: string) {
  return fetchJson<Release[]>("/allReleases", { repo }, { label: "releases" });
}

// Accept custom API URL from CLI flag
export function setApiUrl(url: string) {
  process.env.REPO_STATS_API_URL = url;
}
