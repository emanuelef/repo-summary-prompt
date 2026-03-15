import { state } from './state.js';
import { LANG_COLORS } from './config.js';
import { fmt, sum30, renderMarkdown } from './utils.js';
import { hideSkeleton } from './tracker.js';

const repoInfo     = document.getElementById('repoInfo');
const metricsGrid  = document.getElementById('metricsGrid');
const chartViewToggle = document.getElementById('chartViewToggle');
const ollamaSection   = document.getElementById('ollamaSection');
const mentionsPanel   = document.getElementById('mentionsPanel');

// ── Metric card with bar chart ────────────────────────────────────────────────

export function createMetricCard(title, value, subtitle, series, color, noData) {
  const card = document.createElement('div');
  card.className = 'metric-card';
  const grad = color || 'linear-gradient(to top, #667eea, #a78bfa)';

  let chart = '';
  if (series?.length) {
    let filteredSeries = series;
    if (state.chartViewMode === '30d' && series.length > 30) {
      filteredSeries = series.slice(-30);
    }
    const MAX_BARS = 60;
    let isDownsampled = false;
    if (filteredSeries.length > MAX_BARS) {
      isDownsampled = true;
      const bucketSize = Math.ceil(filteredSeries.length / MAX_BARS);
      const downsampled = [];
      for (let i = 0; i < filteredSeries.length; i += bucketSize) {
        const bucket = filteredSeries.slice(i, i + bucketSize);
        const avgVal = bucket.reduce((s, e) => s + (e[1] || 0), 0) / bucket.length;
        const label = bucket.length > 1 ? `${bucket[0][0]} to ${bucket[bucket.length - 1][0]}` : bucket[0][0];
        downsampled.push([label, Math.round(avgVal)]);
      }
      filteredSeries = downsampled;
    }
    let max = 1;
    for (const s of filteredSeries) if ((s[1] || 0) > max) max = s[1];
    const bars = filteredSeries.map(s => {
      const v = s[1] || 0;
      const tip = isDownsampled ? `${s[0]} (avg: ${v})` : `${s[0]}: ${v}`;
      return `<div class="metric-bar" style="height:${(v / max) * 100}%;background:${grad}" title="${tip}"></div>`;
    }).join('');
    chart = `<div class="metric-chart">${bars}</div>`;
  } else if (series == null) {
    const msg = noData ? 'no recent activity' : 'chart unavailable';
    chart = `<div class="metric-chart" style="justify-content:center;align-items:center;opacity:0.35;border:1px dashed rgba(255,255,255,0.08);border-radius:4px;"><span style="font-size:0.74em;color:var(--text-muted);">${msg}</span></div>`;
  }

  card.innerHTML = `
    <div class="metric-title">${title}</div>
    <div class="metric-value">${fmt(value)}</div>
    ${subtitle ? `<div class="metric-subtitle">${subtitle.split('\n').join('<br>')}</div>` : ''}
    ${chart}
  `;
  return card;
}

// ── Main dashboard renderer ───────────────────────────────────────────────────

export function updateDashboard(repoPath) {
  const { metrics } = state;

  // ── Repo info header ────────────────────────────────────────────────────────
  if (metrics.stats) {
    const s = metrics.stats;
    const created = s.data.created && !s.data.created.startsWith('0001')
      ? new Date(s.data.created).toISOString().split('T')[0] : '';
    let ageTag = '';
    if (created) {
      const c = new Date(s.data.created);
      const now = new Date();
      let y = now.getFullYear() - c.getFullYear();
      let m = now.getMonth() - c.getMonth();
      let d = now.getDate() - c.getDate();
      if (d < 0) { m--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
      if (m < 0) { y--; m += 12; }
      const parts = [];
      if (y > 0) parts.push(`${y}y`);
      if (m > 0) parts.push(`${m}m`);
      if (d > 0 || parts.length === 0) parts.push(`${d}d`);
      ageTag = `<span class="repo-tag">Age: ${parts.join(' ')}</span>`;
    }
    const lang = s.data.language;
    const langColor = LANG_COLORS[lang] || '#888';
    const hexToRgb = hex => {
      const h = hex.replace('#', '');
      return [parseInt(h.substring(0,2),16), parseInt(h.substring(2,4),16), parseInt(h.substring(4,6),16)];
    };
    const [lr, lg, lb] = hexToRgb(langColor);
    const langTag = lang
      ? `<span class="repo-tag" style="background:rgba(${lr},${lg},${lb},0.15);border-color:rgba(${lr},${lg},${lb},0.3);"><span class="lang-dot" style="background:${langColor};box-shadow:0 0 6px rgba(${lr},${lg},${lb},0.6);"></span>${lang}</span>`
      : '';
    const explorerBase = 'https://emanuelef.github.io/daily-stars-explorer';
    repoInfo.innerHTML = `
      <h2><a href="https://github.com/${repoPath}" target="_blank">${repoPath}</a></h2>
      ${s.data.description ? `<p>${s.data.description}</p>` : ''}
      <div class="repo-tags">
        ${langTag}
        ${ageTag}
        ${created ? `<span class="repo-tag">Created ${created}</span>` : ''}
        ${s.data.archived ? '<span class="repo-tag" style="background:rgba(248,113,113,0.15);color:#f87171;border-color:rgba(248,113,113,0.2);">Archived</span>' : ''}
        <span class="repo-tag">${(s.data.size / 1024).toFixed(1)} MB</span>
        <span class="repo-tag">${fmt(s.data.mentionableUsers)} contributors</span>
      </div>
      <div class="repo-links">
        <a href="${explorerBase}/#/${repoPath}" target="_blank" class="repo-link" title="View detailed star, commit, and fork charts on Daily Stars Explorer">
          <svg viewBox="0 0 16 16"><path d="M1.5 14.25V1.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v12.5a.25.25 0 01-.25.25H1.75a.25.25 0 01-.25-.25zM3 3v4h2V3H3zm3 0v7h2V3H6zm3 0v5h2V3H9z"/></svg>
          Daily Stars Explorer
        </a>
        <button id="shareBtn" class="repo-link" style="cursor:pointer;" title="Copy shareable link to clipboard">
          <svg viewBox="0 0 16 16"><path d="M13.5 3a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 5.5a2.5 2.5 0 00-3.5-2.29l-4.33 2.6a2.5 2.5 0 000 4.38l4.33 2.6A2.5 2.5 0 1014 11.5v-6A.5.5 0 0015 5.5zm-3.5 7.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM4.5 8a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/></svg>
          Share
        </button>
      </div>
    `;
    repoInfo.style.display = 'block';
    hideSkeleton();
  }

  // ── Metric cards ────────────────────────────────────────────────────────────
  metricsGrid.innerHTML = '';

  if (metrics.stars || metrics.stats) {
    const series = metrics.stars?.data.series;
    const daily30 = sum30(series, 1);
    let todayYesterday = '';
    if (series?.length >= 2) {
      todayYesterday = `Today (UTC): +${fmt(series[series.length - 1][1])} · Yesterday: +${fmt(series[series.length - 2][1])}`;
    } else if (series?.length === 1) {
      todayYesterday = `Today (UTC): +${fmt(series[0][1])}`;
    }
    metricsGrid.appendChild(createMetricCard(
      'Stars',
      metrics.stats?.data.stars || metrics.stars?.data.total || 0,
      [todayYesterday, daily30 ? `+${fmt(daily30)} in last 30 days` : ''].filter(Boolean).join('\n'),
      series,
      'linear-gradient(to top, #f59e0b, #fbbf24)',
      metrics.stars?.data.noData
    ));
  }

  if (metrics.commits) {
    const last30 = sum30(metrics.commits.data.series, 1);
    metricsGrid.appendChild(createMetricCard(
      'Commits',
      metrics.commits.data.total,
      last30 ? `${fmt(last30)} in last 30 days` : '',
      metrics.commits.data.series,
      'linear-gradient(to top, #059669, #34d399)',
      metrics.commits.data.noData
    ));
  }

  if (metrics.prs) {
    const opened = sum30(metrics.prs.data.series, 1);
    const merged = sum30(metrics.prs.data.series, 3);
    metricsGrid.appendChild(createMetricCard(
      'Pull Requests (30d)', opened,
      merged ? `${fmt(merged)} merged` : '',
      metrics.prs.data.series ? metrics.prs.data.series.map(s => [s[0], s[1]]) : null,
      'linear-gradient(to top, #7c3aed, #a78bfa)',
      metrics.prs.data.noData
    ));
  }

  if (metrics.issues) {
    const opened = sum30(metrics.issues.data.series, 1);
    const closed = sum30(metrics.issues.data.series, 2);
    metricsGrid.appendChild(createMetricCard(
      'Issues (30d)', opened,
      closed ? `${fmt(closed)} closed` : '',
      metrics.issues.data.series ? metrics.issues.data.series.map(s => [s[0], s[1]]) : null,
      'linear-gradient(to top, #dc2626, #f87171)',
      metrics.issues.data.noData
    ));
  }

  if (metrics.forks || metrics.stats) {
    const daily30 = sum30(metrics.forks?.data.series, 1);
    metricsGrid.appendChild(createMetricCard(
      'Forks',
      metrics.stats?.data.forks || metrics.forks?.data.total || 0,
      daily30 ? `+${fmt(daily30)} in last 30 days` : '',
      metrics.forks?.data.series,
      'linear-gradient(to top, #0284c7, #38bdf8)',
      metrics.forks?.data.noData
    ));
  }

  if (metrics.contributors) {
    const last30 = sum30(metrics.contributors.data.series, 1);
    metricsGrid.appendChild(createMetricCard(
      'Contributors',
      metrics.contributors.data.total,
      last30 ? `${fmt(last30)} active in last 30d` : '',
      metrics.contributors.data.series,
      'linear-gradient(to top, #9333ea, #c084fc)',
      metrics.contributors.data.noData
    ));
  }

  if (metrics.stats && metrics.issues) {
    const opened30 = sum30(metrics.issues.data.series, 1);
    const closed30 = sum30(metrics.issues.data.series, 2);
    const net = opened30 - closed30;
    const trend = net > 0 ? `+${net} net` : net < 0 ? `${net} net` : 'stable';
    metricsGrid.appendChild(createMetricCard('Issue Backlog', metrics.stats.data.openIssues, `${trend} in last 30d`, null));
  }

  if (metrics.governance) {
    const g = metrics.governance.data;
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `
      <div class="metric-title">Governance</div>
      <div class="metric-value" style="font-size:1.4em;">${g.icon} ${g.label}</div>
      <div class="metric-subtitle" style="margin-top:0.5em;">${g.description}</div>
      <div style="margin-top:0.8em;display:flex;gap:0.4em;flex-wrap:wrap;">
        <span class="repo-tag">${g.differentAuthors} authors</span>
        <span class="repo-tag">${g.authorConcentration}</span>
        <span class="repo-tag">${g.recentContributors} active (30d)</span>
      </div>
    `;
    metricsGrid.appendChild(card);
  }

  if (metrics.buzz) {
    const b = metrics.buzz.data;
    const card = document.createElement('div');
    card.className = 'metric-card';
    const barColor = b.score >= 70 ? '#ef4444' : b.score >= 45 ? '#f59e0b' : b.score >= 25 ? '#3b82f6' : '#6b7280';
    const parts = [];
    if (b.breakdown.hn?.posts)          parts.push(`HN: ${b.breakdown.hn.posts} (${fmt(b.breakdown.hn.points)} pts)`);
    if (b.breakdown.reddit?.posts)      parts.push(`Reddit: ${b.breakdown.reddit.posts}`);
    if (b.breakdown.youtube?.videos)    parts.push(`YT: ${b.breakdown.youtube.videos}`);
    if (b.breakdown.ghMentions?.total)  parts.push(`GH: ${b.breakdown.ghMentions.total}`);
    const breakdownHtml = parts.length
      ? `<div style="margin-top:0.5em;font-size:0.78em;color:var(--text-muted);">${parts.join(' · ')}</div>` : '';
    const ratioColors = b.devActivityRatio.includes('talked')
      ? 'background:rgba(251,191,36,0.12);color:#fbbf24;border-color:rgba(251,191,36,0.2)'
      : 'background:rgba(52,211,153,0.12);color:#34d399;border-color:rgba(52,211,153,0.2)';
    const ratioTag = b.devActivityRatio === 'balanced' ? ''
      : `<div style="margin-top:0.5em;"><span class="repo-tag" style="${ratioColors}">${b.devActivityRatio}</span></div>`;
    const hasItems = metrics.hn_items || metrics.youtube_items || metrics.gh_mention_items;
    const totalItems = (metrics.hn_items?.data?.length || 0) + (metrics.youtube_items?.data?.length || 0) + (metrics.gh_mention_items?.data?.length || 0);
    const mentionsBtnHtml = hasItems ? `
      <button class="mentions-toggle-btn" id="mentionsToggleBtn" style="margin-top:0.75em;width:100%;background:none;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:0.4em 0.75em;font-size:0.8em;color:var(--accent);cursor:pointer;text-align:left;">
        View all ${totalItems} mention${totalItems !== 1 ? 's' : ''} →
      </button>` : '';
    card.innerHTML = `
      <div class="metric-title">Social Buzz</div>
      <div class="metric-value" style="font-size:1.4em;">${b.icon} ${b.label}</div>
      <div class="metric-subtitle">Score: ${b.score}/100 · ${fmt(b.totalMentions)} mentions${b.recentMentions ? ` (${b.recentMentions} recent)` : ''}</div>
      <div style="margin-top:0.6em;background:rgba(255,255,255,0.06);border-radius:6px;height:6px;overflow:hidden;">
        <div style="width:${Math.min(b.score, 100)}%;height:100%;background:${barColor};border-radius:6px;transition:width 0.6s ease-out;"></div>
      </div>
      ${breakdownHtml}${ratioTag}${mentionsBtnHtml}
    `;
    if (hasItems) {
      card.querySelector('#mentionsToggleBtn').addEventListener('click', () => {
        const isOpen = mentionsPanel.style.display !== 'none';
        mentionsPanel.style.display = isOpen ? 'none' : 'block';
        card.querySelector('#mentionsToggleBtn').textContent = isOpen
          ? `View all ${totalItems} mention${totalItems !== 1 ? 's' : ''} →`
          : 'Hide mentions ↑';
        if (!isOpen) mentionsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
    metricsGrid.appendChild(card);
  }

  // ── Package registry cards ──────────────────────────────────────────────────
  if (metrics.registry) {
    const r = metrics.registry.data;
    if (r.npm) {
      const npmUrl = `https://www.npmjs.com/package/${encodeURIComponent(r.npm.package)}`;
      const card = document.createElement('div');
      card.className = 'metric-card';
      card.innerHTML = `
        <div class="metric-title">NPM Downloads</div>
        <div class="metric-value">${fmt(r.npm.downloads30d)}</div>
        <div class="metric-subtitle">last 30 days</div>
        <div style="margin-top:0.5em;">
          <a href="${npmUrl}" target="_blank" class="repo-link" style="font-size:0.8em;">
            <svg viewBox="0 0 16 16" style="width:12px;height:12px;fill:currentColor;"><path d="M0 0h16v16H0V0zm1.5 1.5v13h13v-13h-13zM3 3h10v10H8V5H5v8H3V3z"/></svg>
            ${r.npm.package}
          </a>
        </div>`;
      metricsGrid.appendChild(card);
    }
    if (r.pypi) {
      const pypiUrl = `https://pypi.org/project/${encodeURIComponent(r.pypi.package)}/`;
      const card = document.createElement('div');
      card.className = 'metric-card';
      card.innerHTML = `
        <div class="metric-title">PyPI Downloads</div>
        <div class="metric-value">${fmt(r.pypi.lastMonth)}</div>
        <div class="metric-subtitle">last 30 days</div>
        <div style="margin-top:0.5em;display:flex;gap:0.4em;flex-wrap:wrap;">
          <span class="repo-tag">${fmt(r.pypi.lastWeek)} last 7d</span>
          <span class="repo-tag">${fmt(r.pypi.lastDay)} yesterday</span>
        </div>
        <div style="margin-top:0.5em;">
          <a href="${pypiUrl}" target="_blank" class="repo-link" style="font-size:0.8em;">
            <svg viewBox="0 0 16 16" style="width:12px;height:12px;fill:currentColor;"><path d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14.5c-3.58 0-6.5-2.92-6.5-6.5S4.42 1.5 8 1.5 14.5 4.42 14.5 8 11.58 14.5 8 14.5z"/></svg>
            ${r.pypi.package}
          </a>
        </div>`;
      metricsGrid.appendChild(card);
    }
    if (r.cargo) {
      const cargoUrl = `https://crates.io/crates/${encodeURIComponent(r.cargo.name)}`;
      const card = document.createElement('div');
      card.className = 'metric-card';
      card.innerHTML = `
        <div class="metric-title">Cargo Downloads</div>
        <div class="metric-value">${fmt(r.cargo.total)}</div>
        <div class="metric-subtitle">all-time · v${r.cargo.version}</div>
        ${r.cargo.recent ? `<div style="margin-top:0.5em;"><span class="repo-tag" title="Downloads in the last 90 days">${fmt(r.cargo.recent)} last 90d</span></div>` : ''}
        <div style="margin-top:0.5em;">
          <a href="${cargoUrl}" target="_blank" class="repo-link" style="font-size:0.8em;">
            <svg viewBox="0 0 16 16" style="width:12px;height:12px;fill:currentColor;"><path d="M8 0L1 4v8l7 4 7-4V4L8 0zm5.5 11.5l-5.5 3-5.5-3v-7l5.5-3 5.5 3v7z"/></svg>
            ${r.cargo.name}
          </a>
        </div>`;
      metricsGrid.appendChild(card);
    }
    if (r.homebrew) {
      const brewUrl = `https://formulae.brew.sh/formula/${encodeURIComponent(r.homebrew.name)}`;
      const card = document.createElement('div');
      card.className = 'metric-card';
      card.innerHTML = `
        <div class="metric-title">Homebrew Installs</div>
        <div class="metric-value">${fmt(r.homebrew.installs30d)}</div>
        <div class="metric-subtitle">last 30 days</div>
        <div style="margin-top:0.5em;display:flex;gap:0.4em;flex-wrap:wrap;">
          <span class="repo-tag">${fmt(r.homebrew.installs90d)} last 90d</span>
          <span class="repo-tag">${fmt(r.homebrew.installs365d)} last year</span>
        </div>
        <div style="margin-top:0.5em;">
          <a href="${brewUrl}" target="_blank" class="repo-link" style="font-size:0.8em;">
            <svg viewBox="0 0 16 16" style="width:12px;height:12px;fill:currentColor;"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 14.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13z"/></svg>
            ${r.homebrew.name}
          </a>
        </div>`;
      metricsGrid.appendChild(card);
    }
  }

  if (metricsGrid.children.length > 0) {
    metricsGrid.style.display = 'grid';
    chartViewToggle.style.display = 'flex';
    hideSkeleton();
  }

  // ── Ollama section ──────────────────────────────────────────────────────────
  if (metrics.ollama) {
    const { response, model } = metrics.ollama.data;
    const promptHtml = metrics.ollamaPrompt
      ? `<details class="ollama-prompt-details"><summary>Prompt sent to Ollama</summary><pre class="ollama-prompt-pre">${metrics.ollamaPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></details>`
      : '';
    ollamaSection.innerHTML = `
      <div class="ollama-header">
        <div class="ollama-title">
          <span>🤖</span> AI Analysis
          ${model ? `<span class="ollama-model-tag">${model}</span>` : ''}
        </div>
      </div>
      <div class="ollama-disclaimer">⚠️ This analysis runs on a lightweight local model hosted on a simple VM — results may be limited. For a deeper and more accurate investigation, copy the full prompt above and paste it into your LLM of choice (ChatGPT, Claude, Gemini…).</div>
      <div class="ollama-content">${response.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      ${promptHtml}
    `;
    ollamaSection.style.display = 'block';
  }

  // ── Mentions panel ──────────────────────────────────────────────────────────
  const panelWasOpen = mentionsPanel.style.display !== 'none';
  const hasAnyItems = metrics.hn_items || metrics.youtube_items || metrics.gh_mention_items;
  if (hasAnyItems) {
    const hnItems = metrics.hn_items?.data || [];
    const ytItems = metrics.youtube_items?.data || [];
    const ghItems = metrics.gh_mention_items?.data || [];

    const hnHtml = hnItems.length ? `
      <div class="mentions-section">
        <div class="mentions-section-title">
          <svg viewBox="0 0 16 16" style="width:14px;height:14px;fill:currentColor;flex-shrink:0;"><path d="M0 0h16v16H0V0zm6.5 2.5h-3v11h3v-4.5H8l2.5 4.5h3.5l-3-5.5c1.5-.5 2.5-1.8 2.5-3.3C13.5 3.1 12 2.5 10 2.5H6.5zm0 2h3c.8 0 1.5.5 1.5 1.5s-.7 1.5-1.5 1.5h-3v-3z"/></svg>
          Hacker News <span class="mentions-count">${hnItems.length}</span>
        </div>
        <ul class="mentions-list">
          ${hnItems.map(i => `
            <li class="mentions-item">
              <a href="${i.url}" target="_blank" rel="noopener" class="mentions-link">${i.title}</a>
              <span class="mentions-meta">${i.points} pts · ${i.comments} comments · ${i.date}</span>
            </li>`).join('')}
        </ul>
      </div>` : '';

    const ytHtml = ytItems.length ? `
      <div class="mentions-section">
        <div class="mentions-section-title">
          <svg viewBox="0 0 16 16" style="width:14px;height:14px;fill:currentColor;flex-shrink:0;"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm-1.5 5.5l4 2.5-4 2.5V5.5z"/></svg>
          YouTube <span class="mentions-count">${ytItems.length}</span>
        </div>
        <ul class="mentions-list">
          ${ytItems.map(i => `
            <li class="mentions-item">
              <a href="${i.url}" target="_blank" rel="noopener" class="mentions-link">${i.title}</a>
              <span class="mentions-meta">${fmt(i.views)} views · ${i.date}</span>
            </li>`).join('')}
        </ul>
      </div>` : '';

    const ghHtml = ghItems.length ? `
      <div class="mentions-section">
        <div class="mentions-section-title">
          <svg viewBox="0 0 16 16" style="width:14px;height:14px;fill:currentColor;flex-shrink:0;"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          GitHub Mentions <span class="mentions-count">${ghItems.length}</span>
        </div>
        <ul class="mentions-list">
          ${ghItems.map(i => `
            <li class="mentions-item">
              <span class="mentions-type-tag">${i.type}</span>
              <a href="${i.url}" target="_blank" rel="noopener" class="mentions-link">${i.title}</a>
              <span class="mentions-meta">${i.repo} · ${i.author} · ${i.date}</span>
            </li>`).join('')}
        </ul>
      </div>` : '';

    mentionsPanel.innerHTML = `
      <div class="mentions-panel-header">
        <span class="mentions-panel-title">📣 All Social Mentions</span>
        <button class="mentions-close-btn" id="mentionsCloseBtn">✕ Close</button>
      </div>
      <div class="mentions-sections-grid">${hnHtml}${ytHtml}${ghHtml}</div>
    `;
    document.getElementById('mentionsCloseBtn').addEventListener('click', () => {
      mentionsPanel.style.display = 'none';
      const toggleBtn = document.getElementById('mentionsToggleBtn');
      const total = hnItems.length + ytItems.length + ghItems.length;
      if (toggleBtn) toggleBtn.textContent = `View all ${total} mention${total !== 1 ? 's' : ''} →`;
    });
    if (panelWasOpen) mentionsPanel.style.display = 'block';
  } else {
    mentionsPanel.style.display = 'none';
    mentionsPanel.innerHTML = '';
  }
}
