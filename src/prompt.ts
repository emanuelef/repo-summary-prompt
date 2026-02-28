import type { RepoStats } from "./api.js";
import type {
  StarsSummary,
  TimeSeriesSummary,
  PRSummary,
  IssueSummary,
  ActivityAssessment,
  GHMentionsSummary,
  HNSummary,
  RedditSummary,
  YouTubeSummary,
  ReleasesSummary,
  EvolutionSummary,
  GovernanceSummary,
  BuzzSummary,
} from "./summarize.js";

interface NPMRegistry { downloads30d: number; package: string; }
interface PyPIRegistry { lastDay: number; lastWeek: number; lastMonth: number; package: string; }
interface CargoRegistry { total: number; recent: number; version: string; name: string; }
interface HomebrewRegistry { name: string; installs30d: number; installs90d: number; installs365d: number; }

interface RegistryData {
  npm?: NPMRegistry;
  pypi?: PyPIRegistry;
  cargo?: CargoRegistry;
  homebrew?: HomebrewRegistry;
}

interface PromptData {
  repo: string;
  stats: RepoStats | null;
  stars: StarsSummary | null;
  commits: TimeSeriesSummary | null;
  prs: PRSummary | null;
  issues: IssueSummary | null;
  forks: TimeSeriesSummary | null;
  contributors: TimeSeriesSummary | null;
  activity: ActivityAssessment | null;
  ghMentions: GHMentionsSummary | null;
  hn: HNSummary | null;
  reddit: RedditSummary | null;
  youtube: YouTubeSummary | null;
  releases: ReleasesSummary | null;
  evolution: EvolutionSummary | null;
  governance: GovernanceSummary | null;
  buzz: BuzzSummary | null;
  registry: RegistryData | null;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso || iso.startsWith("0001")) return "N/A";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "N/A" : d.toISOString().split("T")[0];
}

function timeSeriesBlock(label: string, s: TimeSeriesSummary): string {
  const lines = [
    `## ${label}`,
    `- Total (tracked period): ${fmt(s.total)}`,
    `- Avg per month: ${fmt(s.avgPerMonth)}`,
    `- Last 30 days: ${fmt(s.last30Days)}`,
    `- Last 10 days: ${fmt(s.last10Days)}`,
  ];
  if (s.peakDay) {
    lines.push(`- Peak day: ${s.peakDay.date} (${fmt(s.peakDay.count)})`);
  }
  lines.push(`- Trend: ${s.trend}`);
  if (s.firstDate && s.lastDate) {
    lines.push(`- Tracked period: ${s.firstDate} to ${s.lastDate} (${fmt(s.totalDays)} days)`);
  }
  return lines.join("\n");
}

export function buildPrompt(data: PromptData): string {
  const sections: string[] = [];

  // Preamble
  sections.push(
    `You are a software project analyst specialising in open-source ecosystem dynamics. Based on the following data about the GitHub repository **${data.repo}**, provide a comprehensive summary of how this project is **evolving** — its trajectory, momentum, and the direction it is heading.`
  );

  // --- Repository Info ---
  if (data.stats) {
    const s = data.stats;
    const lines = [
      `## Repository Info`,
      `- Name: ${s.GHPath}`,
      `- Language: ${s.Language || "N/A"}`,
      `- Created: ${fmtDate(s.CreatedAt)}`,
      `- Stars: ${fmt(s.Stars)} | Forks: ${fmt(s.Forks)} | Open Issues: ${fmt(s.OpenIssues)}`,
      `- Mentionable Users: ${fmt(s.MentionableUsers)}`,
      `- Archived: ${s.Archived ? "Yes" : "No"}`,
      `- Size: ${fmt(s.Size)} KB`,
      `- Default Branch: ${s.DefaultBranch}`,
    ];
    sections.push(lines.join("\n"));
  }

  // --- Activity Assessment ---
  if (data.activity) {
    const a = data.activity;
    const lines = [
      `## Activity Assessment`,
      `- Activity Level: **${a.activityLevel}**`,
      `- Liveness Score: ${a.livenessScore}/100`,
      `- Last Commit: ${fmtDate(a.lastCommitDate)}${a.daysSinceLastCommit !== null ? ` (${a.daysSinceLastCommit} days ago)` : ""}`,
      `- Last Star: ${fmtDate(a.lastStarDate)}`,
    ];
    if (a.lastReleaseDate) {
      lines.push(`- Last Release: ${fmtDate(a.lastReleaseDate)}${a.daysSinceLastRelease !== null ? ` (${a.daysSinceLastRelease} days ago)` : ""}`);
    }
    sections.push(lines.join("\n"));
  }

  // --- Star History ---
  if (data.stars) {
    const s = data.stars;
    const lines = [
      timeSeriesBlock("Star History Summary", s),
    ];
    if (s.maxPeaks.length > 0) {
      const peak = s.maxPeaks[0];
      lines.push(`- All-time peak day: ${peak.Day} (${fmt(peak.Stars)} stars)`);
    }
    if (s.maxPeriods.length > 0) {
      const period = s.maxPeriods[0];
      lines.push(`- Peak period: ${period.StartDay} to ${period.EndDay} (${fmt(period.TotalStars)} stars)`);
    }
    sections.push(lines.join("\n"));
  }

  // --- Commits ---
  if (data.commits) {
    sections.push(timeSeriesBlock("Commit Activity Summary", data.commits));
  }

  // --- PRs ---
  if (data.prs) {
    const p = data.prs;
    const lines = [
      timeSeriesBlock("Pull Request Activity", p),
      `- Total opened: ${fmt(p.totalOpened)} | Total closed: ${fmt(p.totalClosed)} | Total merged: ${fmt(p.totalMerged)}`,
      `- Merge rate: ${(p.mergeRate * 100).toFixed(0)}% | Close rate: ${(p.closeRate * 100).toFixed(0)}%`,
      `- Last 30 days — opened: ${fmt(p.openedLast30Days)}, closed: ${fmt(p.closedLast30Days)}, merged: ${fmt(p.mergedLast30Days)}`,
      `- PR velocity trend: ${p.velocityTrend}`,
    ];
    sections.push(lines.join("\n"));
  }

  // --- Issues ---
  if (data.issues) {
    const i = data.issues;
    const lines = [
      timeSeriesBlock("Issue Activity", i),
      `- Total opened: ${fmt(i.totalOpened)} | Total closed: ${fmt(i.totalClosed)}`,
      `- Resolution rate: ${(i.resolutionRate * 100).toFixed(0)}%`,
      `- Last 30 days — opened: ${fmt(i.openedLast30Days)}, closed: ${fmt(i.closedLast30Days)} (net: ${i.netOpenLast30Days >= 0 ? "+" : ""}${i.netOpenLast30Days})`,
      `- Backlog trend: ${i.backlogTrend}`,
    ];
    sections.push(lines.join("\n"));
  }

  // --- Forks ---
  if (data.forks) {
    sections.push(timeSeriesBlock("Fork Activity Summary", data.forks));
  }

  // --- Contributors ---
  if (data.contributors) {
    sections.push(timeSeriesBlock("Contributor Growth", data.contributors));
  }

  // --- Releases ---
  if (data.releases) {
    const r = data.releases;
    const lines = [
      `## Releases`,
      `- Total releases: ${fmt(r.totalReleases)}`,
    ];
    if (r.latestRelease) {
      lines.push(`- Latest release: ${r.latestRelease.name} (${fmtDate(r.latestRelease.date)})`);
    }
    lines.push(`- Releases in last 90 days: ${r.releasesLast90Days}`);
    if (r.avgDaysBetweenReleases !== null) {
      lines.push(`- Avg days between releases: ${r.avgDaysBetweenReleases}`);
    }
    sections.push(lines.join("\n"));
  }

  // --- GitHub Mentions ---
  if (data.ghMentions) {
    const g = data.ghMentions;
    sections.push([
      `## GitHub Mentions (references in other repos)`,
      `- Total mentions: ${fmt(g.totalMentions)}`,
      `- Issues: ${fmt(g.issuesCount)} | PRs: ${fmt(g.pullRequestsCount)} | Discussions: ${fmt(g.discussionsCount)}`,
      `- Mentions in last 30 days: ${fmt(g.recentMentions)}`,
    ].join("\n"));
  }

  // --- Hacker News ---
  if (data.hn) {
    const h = data.hn;
    const lines = [
      `## Hacker News Presence`,
      `- Total posts mentioning this project: ${fmt(h.totalPosts)}`,
      `- Total points: ${fmt(h.totalPoints)} | Total comments: ${fmt(h.totalComments)}`,
      `- Posts in last 90 days: ${fmt(h.recentPosts)}`,
    ];
    if (h.topPost) {
      lines.push(`- Top post: "${h.topPost.title}" (${fmt(h.topPost.points)} points)`);
    }
    sections.push(lines.join("\n"));
  }

  // --- Reddit ---
  if (data.reddit) {
    const r = data.reddit;
    const lines = [
      `## Reddit Presence`,
      `- Total posts: ${fmt(r.totalPosts)}`,
      `- Total upvotes: ${fmt(r.totalUpvotes)} | Total comments: ${fmt(r.totalComments)}`,
      `- Posts in last 90 days: ${fmt(r.recentPosts)}`,
    ];
    if (r.topPost) {
      lines.push(`- Top post: "${r.topPost.title}" (${fmt(r.topPost.ups)} upvotes)`);
    }
    sections.push(lines.join("\n"));
  }

  // --- YouTube ---
  if (data.youtube) {
    const y = data.youtube;
    const lines = [
      `## YouTube Presence`,
      `- Total videos: ${fmt(y.totalVideos)}`,
      `- Total views: ${fmt(y.totalViews)}`,
    ];
    if (y.topVideo) {
      lines.push(`- Top video: "${y.topVideo.title}" (${fmt(y.topVideo.views)} views)`);
    }
    sections.push(lines.join("\n"));
  }

  // --- Governance / Leadership Model ---
  if (data.governance) {
    const g = data.governance;
    sections.push([
      `## Project Governance`,
      `- Type: **${g.label}** ${g.icon}`,
      `- ${g.description}`,
      `- Distinct commit authors: ${fmt(g.differentAuthors)}`,
      `- Mentionable users: ${fmt(g.mentionableUsers)}`,
      `- Recently active contributors (30d): ${fmt(g.recentContributors)}`,
      `- Author concentration: ${g.authorConcentration}`,
    ].join("\n"));
  }

  // --- Buzz / Social Activity ---
  if (data.buzz) {
    const b = data.buzz;
    const lines = [
      `## Social Buzz & Feed Activity`,
      `- Buzz level: **${b.label}** ${b.icon} (score: ${b.score}/100)`,
      `- Total social mentions: ${fmt(b.totalMentions)}`,
      `- Recent mentions (last 90d): ${fmt(b.recentMentions)}`,
      `- Dev-vs-buzz ratio: ${b.devActivityRatio}`,
    ];
    if (b.breakdown.hn) lines.push(`- Hacker News: ${b.breakdown.hn.posts} posts, ${fmt(b.breakdown.hn.points)} points, ${b.breakdown.hn.recent} recent`);
    if (b.breakdown.reddit) lines.push(`- Reddit: ${b.breakdown.reddit.posts} posts, ${fmt(b.breakdown.reddit.upvotes)} upvotes, ${b.breakdown.reddit.recent} recent`);
    if (b.breakdown.youtube) lines.push(`- YouTube: ${b.breakdown.youtube.videos} videos, ${fmt(b.breakdown.youtube.views)} views`);
    if (b.breakdown.ghMentions) lines.push(`- GH cross-references: ${b.breakdown.ghMentions.total} total, ${b.breakdown.ghMentions.recent} recent`);
    sections.push(lines.join("\n"));
  }

  // --- Evolution / Momentum ---
  if (data.evolution) {
    const ev = data.evolution;
    const lines = [
      `## Project Momentum & Evolution`,
      `- Overall momentum: **${ev.momentum}**`,
    ];
    if (ev.starMoM !== null) lines.push(`- Star growth MoM: ${ev.starMoM > 0 ? "+" : ""}${ev.starMoM}%`);
    if (ev.commitMoM !== null) lines.push(`- Commit activity MoM: ${ev.commitMoM > 0 ? "+" : ""}${ev.commitMoM}%`);
    if (ev.prMoM !== null) lines.push(`- PR activity MoM: ${ev.prMoM > 0 ? "+" : ""}${ev.prMoM}%`);
    if (ev.issueMoM !== null) lines.push(`- Issue activity MoM: ${ev.issueMoM > 0 ? "+" : ""}${ev.issueMoM}%`);
    if (ev.forkMoM !== null) lines.push(`- Fork growth MoM: ${ev.forkMoM > 0 ? "+" : ""}${ev.forkMoM}%`);
    if (ev.signals.length > 0) {
      lines.push(`\n### Key Signals`);
      for (const sig of ev.signals) {
        lines.push(`- ${sig}`);
      }
    }
    sections.push(lines.join("\n"));
  }

  // --- Package Registry Downloads ---
  if (data.registry && (data.registry.npm || data.registry.pypi || data.registry.cargo || data.registry.homebrew)) {
    const r = data.registry;
    const lines = [`## Package Registry Downloads`];
    if (r.npm) {
      lines.push(`- NPM (\`${r.npm.package}\`): ${fmt(r.npm.downloads30d)} downloads in last 30 days`);
    }
    if (r.pypi) {
      lines.push(`- PyPI (\`${r.pypi.package}\`): ${fmt(r.pypi.lastMonth)} downloads last month | ${fmt(r.pypi.lastWeek)} last week | ${fmt(r.pypi.lastDay)} last day`);
    }
    if (r.cargo) {
      lines.push(`- Cargo (\`${r.cargo.name}\` v${r.cargo.version}): ${fmt(r.cargo.total)} total downloads | ${fmt(r.cargo.recent)} last 90d`);
    }
    if (r.homebrew) {
      lines.push(`- Homebrew (\`${r.homebrew.name}\`): ${fmt(r.homebrew.installs30d)} installs last 30 days | ${fmt(r.homebrew.installs90d)} last 90 days | ${fmt(r.homebrew.installs365d)} last year`);
    }
    sections.push(lines.join("\n"));
  }

  // --- Analysis request ---
  sections.push(`---

Based on all the data above, provide a comprehensive analysis of **how this project is evolving**. Structure your answer as follows:

1. **Trajectory Summary** — Is this project accelerating, cruising, decelerating, or stalling? Describe the overall direction in 2-3 sentences.
2. **Development Velocity** — How has commit, PR, and release activity changed recently? Is the team shipping faster or slower?
3. **Community & Adoption Trends** — Are stars, forks, and contributors growing? Is external interest (HN, Reddit, YouTube) rising or fading?
4. **Governance Model** — Is this a solo project, benevolent-dictator led, small-team, or community-driven? How does the contributor distribution affect project resilience and bus factor?
5. **Social Buzz vs. Development** — Is the project more talked about than developed, or vice versa? Is external attention aligned with actual development pace?
6. **Maintenance Health** — Are issues being resolved? Is the PR merge rate healthy? Is the backlog under control?
7. **Key Strengths** — What is going well for this project?
8. **Key Risks & Concerns** — What signals suggest potential problems?
9. **6-Month Outlook** — Based on current trends, what is this project likely to look like in 6 months?`);

  return sections.join("\n\n");
}
