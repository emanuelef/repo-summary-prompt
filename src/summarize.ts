import type {
  TimeSeriesEntry,
  AllStarsResponse,
  AllCommitsResponse,
  AllPRsResponse,
  AllIssuesResponse,
  AllForksResponse,
  AllContributorsResponse,
  RepoStats,
  GHMentionsResponse,
  HNItem,
  RedditItem,
  YouTubeItem,
  Release,
} from "./api.js";

// --- Generic time-series summary ---

export interface TimeSeriesSummary {
  total: number;
  last30Days: number;
  last10Days: number;
  avgPerMonth: number;
  peakDay: { date: string; count: number } | null;
  trend: "growing" | "declining" | "stable";
  firstDate: string | null;
  lastDate: string | null;
  totalDays: number;
}

function parseDate(ddmmyyyy: string): Date {
  const [dd, mm, yyyy] = ddmmyyyy.split("-");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export function summarizeTimeSeries(entries: TimeSeriesEntry[]): TimeSeriesSummary {
  if (!entries || entries.length === 0) {
    return {
      total: 0, last30Days: 0, last10Days: 0, avgPerMonth: 0,
      peakDay: null, trend: "stable", firstDate: null, lastDate: null, totalDays: 0,
    };
  }

  const cutoff30 = daysAgo(30);
  const cutoff10 = daysAgo(10);
  const cutoff60 = daysAgo(60);

  let total = 0;
  let last30 = 0;
  let last10 = 0;
  let prev30 = 0; // days 31-60 for trend comparison
  let peakDay: { date: string; count: number } | null = null;

  for (const entry of entries) {
    const [dateStr, daily] = entry;
    total += daily;
    const d = parseDate(dateStr);

    if (d >= cutoff30) last30 += daily;
    if (d >= cutoff10) last10 += daily;
    if (d >= cutoff60 && d < cutoff30) prev30 += daily;

    if (!peakDay || daily > peakDay.count) {
      peakDay = { date: dateStr, count: daily };
    }
  }

  const firstDate = entries[0][0];
  const lastDate = entries[entries.length - 1][0];
  const totalDays = entries.length;
  const months = Math.max(1, totalDays / 30);
  const avgPerMonth = Math.round(total / months);

  let trend: "growing" | "declining" | "stable" = "stable";
  if (prev30 > 0) {
    const ratio = last30 / prev30;
    if (ratio > 1.2) trend = "growing";
    else if (ratio < 0.8) trend = "declining";
  } else if (last30 > 0) {
    trend = "growing";
  }

  return { total, last30Days: last30, last10Days: last10, avgPerMonth, peakDay, trend, firstDate, lastDate, totalDays };
}

// --- Stars-specific summary (uses extra fields from API) ---

export interface StarsSummary extends TimeSeriesSummary {
  apiLast10Days: number;
  maxPeaks: { Day: string; Stars: number }[];
  maxPeriods: { StartDay: string; EndDay: string; TotalStars: number }[];
}

export function summarizeStars(data: AllStarsResponse): StarsSummary {
  const base = summarizeTimeSeries(data.stars);
  return {
    ...base,
    apiLast10Days: data.newLast10Days,
    maxPeaks: data.maxPeaks || [],
    maxPeriods: data.maxPeriods || [],
  };
}

// --- PR summary (extract opened/closed/merged from multi-field entries) ---

export interface PRSummary extends TimeSeriesSummary {
  totalOpened: number;
  totalClosed: number;
  totalMerged: number;
  openedLast30Days: number;
  closedLast30Days: number;
  mergedLast30Days: number;
  mergeRate: number; // merged / opened ratio
  closeRate: number; // closed / opened ratio
  openedPrev30Days: number;
  mergedPrev30Days: number;
  velocityTrend: "accelerating" | "decelerating" | "steady";
}

export function summarizePRs(data: AllPRsResponse): PRSummary {
  // PRs: [date, daily_opened, daily_closed, daily_merged, openedCumul, closedCumul, mergedCumul, ?, ?]
  const entries: TimeSeriesEntry[] = data.prs.map(e => [e[0] as string, e[1] as number, e[4] as number]);
  const base = summarizeTimeSeries(entries);

  const cutoff30 = daysAgo(30);
  const cutoff60 = daysAgo(60);

  let totalOpened = 0, totalClosed = 0, totalMerged = 0;
  let openedLast30 = 0, closedLast30 = 0, mergedLast30 = 0;
  let openedPrev30 = 0, mergedPrev30 = 0;

  for (const e of data.prs) {
    const d = parseDate(e[0] as string);
    const opened = (e[1] as number) || 0;
    const closed = (e[2] as number) || 0;
    const merged = (e[3] as number) || 0;
    totalOpened += opened;
    totalClosed += closed;
    totalMerged += merged;
    if (d >= cutoff30) { openedLast30 += opened; closedLast30 += closed; mergedLast30 += merged; }
    if (d >= cutoff60 && d < cutoff30) { openedPrev30 += opened; mergedPrev30 += merged; }
  }

  const mergeRate = totalOpened > 0 ? Math.round((totalMerged / totalOpened) * 100) / 100 : 0;
  const closeRate = totalOpened > 0 ? Math.round((totalClosed / totalOpened) * 100) / 100 : 0;

  let velocityTrend: PRSummary["velocityTrend"] = "steady";
  if (openedPrev30 > 0) {
    const ratio = openedLast30 / openedPrev30;
    if (ratio > 1.25) velocityTrend = "accelerating";
    else if (ratio < 0.75) velocityTrend = "decelerating";
  } else if (openedLast30 > 0) {
    velocityTrend = "accelerating";
  }

  return {
    ...base,
    totalOpened, totalClosed, totalMerged,
    openedLast30Days: openedLast30, closedLast30Days: closedLast30, mergedLast30Days: mergedLast30,
    mergeRate, closeRate,
    openedPrev30Days: openedPrev30, mergedPrev30Days: mergedPrev30,
    velocityTrend,
  };
}

// --- Issue summary ---

export interface IssueSummary extends TimeSeriesSummary {
  totalOpened: number;
  totalClosed: number;
  openedLast30Days: number;
  closedLast30Days: number;
  openedPrev30Days: number;
  closedPrev30Days: number;
  resolutionRate: number; // closed / opened ratio
  netOpenLast30Days: number; // opened - closed (positive = backlog growing)
  backlogTrend: "growing" | "shrinking" | "stable";
}

export function summarizeIssues(data: AllIssuesResponse): IssueSummary {
  // Issues: [date, daily_opened, daily_closed, openedCumul, closedCumul, ?, ?]
  const entries: TimeSeriesEntry[] = data.issues.map(e => [e[0] as string, e[1] as number, e[3] as number]);
  const base = summarizeTimeSeries(entries);

  const cutoff30 = daysAgo(30);
  const cutoff60 = daysAgo(60);

  let totalOpened = 0, totalClosed = 0;
  let openedLast30 = 0, closedLast30 = 0;
  let openedPrev30 = 0, closedPrev30 = 0;

  for (const e of data.issues) {
    const d = parseDate(e[0] as string);
    const opened = (e[1] as number) || 0;
    const closed = (e[2] as number) || 0;
    totalOpened += opened;
    totalClosed += closed;
    if (d >= cutoff30) { openedLast30 += opened; closedLast30 += closed; }
    if (d >= cutoff60 && d < cutoff30) { openedPrev30 += opened; closedPrev30 += closed; }
  }

  const resolutionRate = totalOpened > 0 ? Math.round((totalClosed / totalOpened) * 100) / 100 : 0;
  const netOpenLast30 = openedLast30 - closedLast30;

  let backlogTrend: IssueSummary["backlogTrend"] = "stable";
  const prevNet = openedPrev30 - closedPrev30;
  if (netOpenLast30 > 5 && netOpenLast30 > prevNet) backlogTrend = "growing";
  else if (netOpenLast30 < -2) backlogTrend = "shrinking";

  return {
    ...base,
    totalOpened, totalClosed,
    openedLast30Days: openedLast30, closedLast30Days: closedLast30,
    openedPrev30Days: openedPrev30, closedPrev30Days: closedPrev30,
    resolutionRate, netOpenLast30Days: netOpenLast30,
    backlogTrend,
  };
}

// --- Activity / recency assessment ---

export interface ActivityAssessment {
  lastCommitDate: string | null;
  lastStarDate: string | null;
  lastReleaseDate: string | null;
  daysSinceLastCommit: number | null;
  daysSinceLastRelease: number | null;
  livenessScore: number;
  activityLevel: "very active" | "active" | "moderate" | "low" | "inactive" | "possibly abandoned";
}

function daysBetween(isoDate: string): number | null {
  if (!isoDate || isoDate.startsWith("0001")) return null;
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function assessActivity(stats: RepoStats): ActivityAssessment {
  const daysSinceLastCommit = daysBetween(stats.LastCommitDate);
  const daysSinceLastRelease = daysBetween(stats.LastReleaseDate);

  let activityLevel: ActivityAssessment["activityLevel"];
  if (daysSinceLastCommit !== null) {
    if (daysSinceLastCommit <= 7) activityLevel = "very active";
    else if (daysSinceLastCommit <= 30) activityLevel = "active";
    else if (daysSinceLastCommit <= 90) activityLevel = "moderate";
    else if (daysSinceLastCommit <= 365) activityLevel = "low";
    else activityLevel = "possibly abandoned";
  } else {
    activityLevel = "inactive";
  }

  return {
    lastCommitDate: stats.LastCommitDate,
    lastStarDate: stats.LastStarDate,
    lastReleaseDate: stats.LastReleaseDate?.startsWith("0001") ? null : stats.LastReleaseDate,
    daysSinceLastCommit,
    daysSinceLastRelease,
    livenessScore: stats.LivenessScore,
    activityLevel,
  };
}

// --- Mentions summaries ---

export interface GHMentionsSummary {
  totalMentions: number;
  issuesCount: number;
  pullRequestsCount: number;
  discussionsCount: number;
  recentMentions: number; // last 30 days
}

export function summarizeGHMentions(data: GHMentionsResponse): GHMentionsSummary {
  const cutoff30 = daysAgo(30);
  let recentMentions = 0;
  for (const m of data.mentions) {
    if (new Date(m.CreatedAt) >= cutoff30) recentMentions++;
  }
  return {
    totalMentions: data.totalMentions,
    issuesCount: data.issuesCount,
    pullRequestsCount: data.pullRequestsCount,
    discussionsCount: data.discussionsCount,
    recentMentions,
  };
}

export interface HNSummary {
  totalPosts: number;
  totalPoints: number;
  totalComments: number;
  topPost: { title: string; points: number; url: string } | null;
  recentPosts: number; // last 90 days
}

export function summarizeHN(items: HNItem[]): HNSummary {
  const cutoff90 = daysAgo(90);
  let totalPoints = 0;
  let totalComments = 0;
  let recentPosts = 0;
  let topPost: HNSummary["topPost"] = null;

  for (const item of items) {
    totalPoints += item.Points;
    totalComments += item.NumComments;
    if (new Date(item.CreatedAt) >= cutoff90) recentPosts++;
    if (!topPost || item.Points > topPost.points) {
      topPost = { title: item.Title, points: item.Points, url: item.HNURL };
    }
  }

  return { totalPosts: items.length, totalPoints, totalComments, topPost, recentPosts };
}

export interface RedditSummary {
  totalPosts: number;
  totalUpvotes: number;
  totalComments: number;
  topPost: { title: string; ups: number; url: string } | null;
  recentPosts: number;
}

export function summarizeReddit(items: RedditItem[]): RedditSummary {
  const cutoff90 = daysAgo(90);
  let totalUpvotes = 0;
  let totalComments = 0;
  let recentPosts = 0;
  let topPost: RedditSummary["topPost"] = null;

  for (const item of items) {
    totalUpvotes += item.ups;
    totalComments += item.num_comments;
    if (new Date(item.created) >= cutoff90) recentPosts++;
    if (!topPost || item.ups > topPost.ups) {
      topPost = { title: item.title, ups: item.ups, url: item.url };
    }
  }

  return { totalPosts: items.length, totalUpvotes, totalComments, topPost, recentPosts };
}

export interface YouTubeSummary {
  totalVideos: number;
  totalViews: number;
  topVideo: { title: string; views: number; url: string } | null;
}

export function summarizeYouTube(items: YouTubeItem[]): YouTubeSummary {
  let totalViews = 0;
  let topVideo: YouTubeSummary["topVideo"] = null;

  for (const item of items) {
    totalViews += item.view_count;
    if (!topVideo || item.view_count > topVideo.views) {
      topVideo = { title: item.title, views: item.view_count, url: item.video_url };
    }
  }

  return { totalVideos: items.length, totalViews, topVideo };
}

// --- Overall evolution / momentum summary ---

export interface EvolutionSummary {
  /** Month-over-month growth rates for key metrics (last30 / prev30) */
  starMoM: number | null;
  commitMoM: number | null;
  prMoM: number | null;
  issueMoM: number | null;
  forkMoM: number | null;
  /** Overall momentum signal derived from multiple metrics */
  momentum: "strong growth" | "moderate growth" | "stable" | "slowing" | "declining";
  /** Textual signals for the LLM */
  signals: string[];
}

export function computeEvolution(opts: {
  stars: StarsSummary | null;
  commits: TimeSeriesSummary | null;
  prs: PRSummary | null;
  issues: IssueSummary | null;
  forks: TimeSeriesSummary | null;
  activity: ActivityAssessment | null;
  releases: ReleasesSummary | null;
}): EvolutionSummary {
  const moM = (last30: number, prev30: number): number | null => {
    if (prev30 === 0) return last30 > 0 ? 999 : null;
    return Math.round(((last30 - prev30) / prev30) * 100);
  };

  const starMoM = opts.stars ? moM(opts.stars.last30Days, opts.stars.total > 0 ? (() => {
    // approximate prev30 from total and monthly avg
    const prev = opts.stars!.avgPerMonth - opts.stars!.last30Days;
    return prev > 0 ? prev : opts.stars!.avgPerMonth;
  })() : 0) : null;

  const commitMoM = opts.commits ? moM(opts.commits.last30Days, (() => {
    const approx = opts.commits!.avgPerMonth;
    return approx > 0 ? approx : 0;
  })()) : null;

  // For PRs and Issues we have explicit prev30 data
  const prMoM = opts.prs ? moM(opts.prs.openedLast30Days, opts.prs.openedPrev30Days) : null;
  const issueMoM = opts.issues ? moM(opts.issues.openedLast30Days, opts.issues.openedPrev30Days) : null;
  const forkMoM = opts.forks ? moM(opts.forks.last30Days, opts.forks.avgPerMonth) : null;

  // Aggregate momentum
  const rates = [starMoM, commitMoM, prMoM, forkMoM].filter((v): v is number => v !== null);
  const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

  let momentum: EvolutionSummary["momentum"];
  if (avgRate > 40) momentum = "strong growth";
  else if (avgRate > 10) momentum = "moderate growth";
  else if (avgRate > -10) momentum = "stable";
  else if (avgRate > -30) momentum = "slowing";
  else momentum = "declining";

  // Produce human-readable signals
  const signals: string[] = [];
  if (opts.commits?.trend === "growing") signals.push("Commit frequency is increasing");
  if (opts.commits?.trend === "declining") signals.push("Commit frequency is dropping");
  if (opts.stars?.trend === "growing") signals.push("Star growth is accelerating");
  if (opts.stars?.trend === "declining") signals.push("Star growth is slowing down");
  if (opts.prs?.velocityTrend === "accelerating") signals.push("PR velocity is accelerating");
  if (opts.prs?.velocityTrend === "decelerating") signals.push("PR velocity is decelerating");
  if (opts.prs && opts.prs.mergeRate < 0.5) signals.push("Low PR merge rate — may indicate stale contributions or high standards");
  if (opts.prs && opts.prs.mergeRate > 0.85) signals.push("High PR merge rate — contributions are actively being integrated");
  if (opts.issues?.backlogTrend === "growing") signals.push("Issue backlog is growing — more issues opened than closed recently");
  if (opts.issues?.backlogTrend === "shrinking") signals.push("Issue backlog is shrinking — maintainers are catching up");
  if (opts.issues && opts.issues.resolutionRate < 0.5) signals.push("Low issue resolution rate — many issues remain open");
  if (opts.activity?.activityLevel === "possibly abandoned") signals.push("No commits in over a year — project may be abandoned");
  if (opts.activity?.activityLevel === "very active") signals.push("Very recent commits — active development");
  if (opts.releases && opts.releases.releasesLast90Days === 0 && opts.releases.totalReleases > 0) {
    signals.push("No releases in last 90 days despite having a release history");
  }
  if (opts.releases && opts.releases.releasesLast90Days >= 3) {
    signals.push("Frequent releases in recent period — fast iteration cycle");
  }

  return { starMoM, commitMoM, prMoM, issueMoM, forkMoM, momentum, signals };
}

// --- Releases summary ---

export interface ReleasesSummary {
  totalReleases: number;
  latestRelease: { name: string; date: string; url: string } | null;
  releasesLast90Days: number;
  avgDaysBetweenReleases: number | null;
}

export function summarizeReleases(releases: Release[]): ReleasesSummary {
  if (!releases || releases.length === 0) {
    return { totalReleases: 0, latestRelease: null, releasesLast90Days: 0, avgDaysBetweenReleases: null };
  }

  const cutoff90 = daysAgo(90);
  let releasesLast90 = 0;

  // Releases are typically newest-first
  const sorted = [...releases]
    .filter(r => !r.isDraft)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  for (const r of sorted) {
    if (new Date(r.publishedAt) >= cutoff90) releasesLast90++;
  }

  const latest = sorted[0];
  let avgDays: number | null = null;
  if (sorted.length >= 2) {
    const newest = new Date(sorted[0].publishedAt).getTime();
    const oldest = new Date(sorted[sorted.length - 1].publishedAt).getTime();
    const totalDaySpan = (newest - oldest) / (1000 * 60 * 60 * 24);
    avgDays = Math.round(totalDaySpan / (sorted.length - 1));
  }

  return {
    totalReleases: sorted.length,
    latestRelease: latest ? { name: latest.name || latest.tagName, date: latest.publishedAt, url: latest.url } : null,
    releasesLast90Days: releasesLast90,
    avgDaysBetweenReleases: avgDays,
  };
}

// --- Governance / Leadership Analysis ---

export type GovernanceType =
  | "solo"
  | "solo-with-contributors"
  | "benevolent-dictator"
  | "small-team"
  | "community-driven";

export interface GovernanceSummary {
  type: GovernanceType;
  label: string;
  icon: string;
  description: string;
  differentAuthors: number;
  mentionableUsers: number;
  recentContributors: number;
  authorConcentration: "very high" | "high" | "moderate" | "distributed";
}

export function analyzeGovernance(opts: {
  stats: RepoStats | null;
  contributors: TimeSeriesSummary | null;
  commits: TimeSeriesSummary | null;
  prs: PRSummary | null;
  ghMentions: GHMentionsResponse | null;
}): GovernanceSummary | null {
  if (!opts.stats) return null;

  const diffAuthors = opts.stats.DifferentAuthors || 0;
  const mentionableUsers = opts.stats.MentionableUsers || 0;
  const recentContributors = opts.contributors?.last30Days || 0;

  // Unique PR authors from GH mentions (authors who filed PRs/issues across the ecosystem referencing this repo)
  const uniqueMentionAuthors = new Set<string>();
  if (opts.ghMentions?.mentions) {
    for (const m of opts.ghMentions.mentions) {
      if (m.Author) uniqueMentionAuthors.add(m.Author);
    }
  }

  // Author concentration: how concentrated are commits per author
  let authorConcentration: GovernanceSummary["authorConcentration"];
  const totalCommits = opts.commits?.total || 0;
  if (diffAuthors <= 1) {
    authorConcentration = "very high";
  } else if (diffAuthors <= 3) {
    authorConcentration = "high";
  } else if (diffAuthors <= 15) {
    authorConcentration = "moderate";
  } else {
    authorConcentration = "distributed";
  }

  // Classify governance type
  let type: GovernanceType;
  let label: string;
  let icon: string;
  let description: string;

  if (diffAuthors <= 1) {
    type = "solo";
    label = "Solo Project";
    icon = "👤";
    description = "This repository is maintained by a single developer.";
  } else if (diffAuthors <= 3 && mentionableUsers <= 5) {
    type = "solo-with-contributors";
    label = "Solo + Contributors";
    icon = "👤+";
    description = `Primarily a solo effort with ${diffAuthors} total contributors. Occasional outside contributions.`;
  } else if (diffAuthors <= 10 && mentionableUsers <= 15) {
    // Potential benevolent dictator: small number of authors, moderate community
    // Check if contributions are concentrated
    if (totalCommits > 0 && diffAuthors >= 2 && recentContributors <= 5) {
      type = "benevolent-dictator";
      label = "Benevolent Dictator";
      icon = "👑";
      description = `Led by a core maintainer with ${diffAuthors} total authors. A small group drives most decisions.`;
    } else {
      type = "small-team";
      label = "Small Team";
      icon = "👥";
      description = `Maintained by a small team of ${diffAuthors} contributors with ${mentionableUsers} members.`;
    }
  } else if (diffAuthors <= 25) {
    if (mentionableUsers > 50 || recentContributors > 10) {
      type = "community-driven";
      label = "Community-Driven";
      icon = "🌍";
      description = `Broad contributor base with ${diffAuthors} authors and ${mentionableUsers} members. Development is distributed.`;
    } else {
      type = "small-team";
      label = "Small Team";
      icon = "👥";
      description = `Maintained by a team of ${diffAuthors} contributors.`;
    }
  } else {
    type = "community-driven";
    label = "Community-Driven";
    icon = "🌍";
    description = `Large contributor base with ${diffAuthors} authors and ${mentionableUsers} members. Truly community-driven development.`;
  }

  return {
    type,
    label,
    icon,
    description,
    differentAuthors: diffAuthors,
    mentionableUsers,
    recentContributors,
    authorConcentration,
  };
}

// --- Buzz / Social Activity Analysis ---

export type BuzzLevel =
  | "viral"
  | "trending"
  | "discussed"
  | "niche"
  | "under-the-radar";

export interface BuzzSummary {
  level: BuzzLevel;
  label: string;
  icon: string;
  score: number;
  description: string;
  breakdown: {
    hn: { posts: number; points: number; recent: number } | null;
    reddit: { posts: number; upvotes: number; recent: number } | null;
    youtube: { videos: number; views: number } | null;
    ghMentions: { total: number; recent: number } | null;
  };
  totalMentions: number;
  recentMentions: number;
  devActivityRatio: "more talked about than developed" | "more developed than talked about" | "balanced";
}

export function analyzeBuzz(opts: {
  hn: HNSummary | null;
  reddit: RedditSummary | null;
  youtube: YouTubeSummary | null;
  ghMentions: GHMentionsSummary | null;
  commits: TimeSeriesSummary | null;
  stats: RepoStats | null;
}): BuzzSummary {
  // Weighted score components
  const hnPosts = opts.hn?.totalPosts || 0;
  const hnPoints = opts.hn?.totalPoints || 0;
  const hnRecent = opts.hn?.recentPosts || 0;
  const redditPosts = opts.reddit?.totalPosts || 0;
  const redditUpvotes = opts.reddit?.totalUpvotes || 0;
  const redditRecent = opts.reddit?.recentPosts || 0;
  const ytVideos = opts.youtube?.totalVideos || 0;
  const ytViews = opts.youtube?.totalViews || 0;
  const ghTotal = opts.ghMentions?.totalMentions || 0;
  const ghRecent = opts.ghMentions?.recentMentions || 0;

  // Compute a composite buzz score (0-100 scale, roughly)
  // Weight: HN is high-signal, Reddit medium, YouTube medium, GH mentions low (they're dev-to-dev)
  let score = 0;
  score += Math.min(hnPosts * 3, 15);           // up to 15 for having many HN posts
  score += Math.min(hnPoints / 50, 15);          // up to 15 for high HN engagement
  score += Math.min(hnRecent * 5, 10);           // up to 10 for recent HN activity
  score += Math.min(redditPosts * 2, 10);        // up to 10 for Reddit posts
  score += Math.min(redditUpvotes / 100, 10);    // up to 10 for Reddit engagement
  score += Math.min(redditRecent * 3, 5);        // up to 5 for recent Reddit
  score += Math.min(ytVideos * 2, 10);           // up to 10 for YouTube coverage
  score += Math.min(ytViews / 10000, 10);        // up to 10 for YouTube views
  score += Math.min(ghTotal / 10, 10);           // up to 10 for GH cross-mentions
  score += Math.min(ghRecent * 2, 5);            // up to 5 for recent GH mentions
  score = Math.round(Math.min(score, 100));

  const totalMentions = hnPosts + redditPosts + ytVideos + ghTotal;
  const recentMentions = hnRecent + redditRecent + ghRecent;

  // Classify buzz level
  let level: BuzzLevel;
  let label: string;
  let icon: string;
  if (score >= 70) {
    level = "viral"; label = "Viral"; icon = "🔥";
  } else if (score >= 45) {
    level = "trending"; label = "Trending"; icon = "📈";
  } else if (score >= 25) {
    level = "discussed"; label = "Discussed"; icon = "💬";
  } else if (score >= 10) {
    level = "niche"; label = "Niche"; icon = "🔍";
  } else {
    level = "under-the-radar"; label = "Under the Radar"; icon = "🤫";
  }

  // Compare social buzz to dev activity
  const recentCommits = opts.commits?.last30Days || 0;
  let devActivityRatio: BuzzSummary["devActivityRatio"];
  if (recentMentions > 5 && recentCommits < 10) {
    devActivityRatio = "more talked about than developed";
  } else if (recentCommits > 50 && recentMentions <= 2) {
    devActivityRatio = "more developed than talked about";
  } else {
    devActivityRatio = "balanced";
  }

  // Build description
  const parts: string[] = [];
  if (hnPosts > 0) parts.push(`${hnPosts} HN post${hnPosts > 1 ? "s" : ""} (${hnPoints} pts)`);
  if (redditPosts > 0) parts.push(`${redditPosts} Reddit post${redditPosts > 1 ? "s" : ""}`);
  if (ytVideos > 0) parts.push(`${ytVideos} YouTube video${ytVideos > 1 ? "s" : ""}`);
  if (ghTotal > 0) parts.push(`${ghTotal} GH mention${ghTotal > 1 ? "s" : ""}`);
  const description = parts.length > 0
    ? `${label}: ${parts.join(", ")}.${recentMentions > 0 ? ` ${recentMentions} recent.` : ""}`
    : "No social mentions found across tracked platforms.";

  return {
    level,
    label,
    icon,
    score,
    description,
    breakdown: {
      hn: opts.hn ? { posts: hnPosts, points: hnPoints, recent: hnRecent } : null,
      reddit: opts.reddit ? { posts: redditPosts, upvotes: redditUpvotes, recent: redditRecent } : null,
      youtube: opts.youtube ? { videos: ytVideos, views: ytViews } : null,
      ghMentions: opts.ghMentions ? { total: ghTotal, recent: ghRecent } : null,
    },
    totalMentions,
    recentMentions,
    devActivityRatio,
  };
}
