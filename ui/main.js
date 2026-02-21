    const form = document.getElementById('repoForm');
    const input = document.getElementById('repoInput');
    const submitBtn = document.getElementById('submitBtn');
    const repoInfo = document.getElementById('repoInfo');
    const metricsGrid = document.getElementById('metricsGrid');
    const skeletonGrid = document.getElementById('skeletonGrid');
    const outputRendered = document.getElementById('outputRendered');
    const outputRaw = document.getElementById('outputRaw');
    const progressLog = document.getElementById('progressLog');
    const progressToggle = document.getElementById('progressToggle');
    const toggleArrow = document.getElementById('toggleArrow');
    const promptSection = document.getElementById('promptSection');
    const errorDiv = document.getElementById('error');
    const elapsedTimer = document.getElementById('elapsedTimer');
    const recentReposEl = document.getElementById('recentRepos');
    const ollamaSection = document.getElementById('ollamaSection');
    const ollamaBadge = document.getElementById('ollamaBadge');

    const isGhPages = location.hostname.endsWith('github.io');
    const apiBase = isGhPages ? 'https://emafuma.mywire.org:3000' : '';

    // ── Ollama status check on load ───────────────────
    if (!isGhPages) {
      fetch(`${apiBase}/api/ollama-status`).then(r => r.json()).then(({ enabled, model, reachable }) => {
        if (!enabled) return;
        ollamaBadge.className = `ollama-badge ${reachable ? 'ready' : 'offline'}`;
        ollamaBadge.title = reachable ? `Ollama ready (${model})` : `Ollama configured but unreachable`;
        ollamaBadge.innerHTML = `<span>${reachable ? '●' : '○'}</span> Ollama${model ? ` · ${model}` : ''}`;
        ollamaBadge.style.display = 'inline-flex';
      }).catch(() => {});
    }

    // Chart view mode: '30d' or 'full'
    let chartViewMode = localStorage.getItem('chartViewMode') || '30d';

    // Track if we've generated data for current repo (to show Update vs Generate button)
    let hasGeneratedData = false;

    // ── Theme toggle ──────────────────────────────────
    const themeToggle = document.getElementById('themeToggle');
    function setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
      localStorage.setItem('theme', theme);
    }
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
    // Init theme from localStorage
    setTheme(localStorage.getItem('theme') || 'dark');

    // ── Chart view toggle ─────────────────────────────
    document.querySelectorAll('.chart-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        chartViewMode = view;
        localStorage.setItem('chartViewMode', view);
        document.querySelectorAll('.chart-view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateDashboard(); // Refresh the charts
      });
    });
    // Set initial active state
    document.querySelectorAll('.chart-view-btn').forEach(btn => {
      if (btn.dataset.view === chartViewMode) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    // ── Share button handler (event delegation since it's dynamically created) ──
    document.addEventListener('click', async (e) => {
      if (e.target.closest('#shareBtn')) {
        e.preventDefault();
        const btn = e.target.closest('#shareBtn');
        const repo = sanitizeRepo(input.value);
        const shareUrl = `${location.origin}${location.pathname}?repo=${encodeURIComponent(repo)}`;
        
        try {
          await navigator.clipboard.writeText(shareUrl);
          const originalText = btn.innerHTML;
          btn.innerHTML = `<svg viewBox="0 0 16 16"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>Copied!`;
          btn.style.background = 'rgba(34,211,238,0.25)';
          setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
          }, 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
          btn.textContent = 'Failed to copy';
          setTimeout(() => {
            btn.innerHTML = `<svg viewBox="0 0 16 16"><path d="M13.5 3a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 5.5a2.5 2.5 0 00-3.5-2.29l-4.33 2.6a2.5 2.5 0 000 4.38l4.33 2.6A2.5 2.5 0 1014 11.5v-6A.5.5 0 0015 5.5zm-3.5 7.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM4.5 8a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/></svg>Share`;
          }, 2000);
        }
      }
    });

    // ── Recent repos (localStorage) ───────────────────
    function getRecentRepos() {
      try { return JSON.parse(localStorage.getItem('recentRepos') || '[]'); } catch { return []; }
    }
    function addRecentRepo(repo) {
      let recent = getRecentRepos().filter(r => r !== repo);
      recent.unshift(repo);
      recent = recent.slice(0, 8);
      localStorage.setItem('recentRepos', JSON.stringify(recent));
      renderRecentRepos();
    }
    function removeRecentRepo(repo) {
      const recent = getRecentRepos().filter(r => r !== repo);
      localStorage.setItem('recentRepos', JSON.stringify(recent));
      renderRecentRepos();
    }
    function renderRecentRepos() {
      const recent = getRecentRepos();
      if (recent.length === 0) { recentReposEl.style.display = 'none'; return; }
      recentReposEl.innerHTML = '<span class="recent-label">Recent:</span>';
      recent.forEach(repo => {
        const chip = document.createElement('span');
        chip.className = 'recent-chip';
        const label = document.createElement('span');
        label.textContent = repo;
        label.style.cursor = 'pointer';
        label.addEventListener('click', () => { input.value = repo; form.dispatchEvent(new Event('submit')); });
        chip.appendChild(label);
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-recent';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove from recent';
        removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeRecentRepo(repo); });
        chip.appendChild(removeBtn);
        recentReposEl.appendChild(chip);
      });
      recentReposEl.style.display = 'flex';
    }
    renderRecentRepos();

    const fetchTracker = document.getElementById('fetchTracker');
    const fetchStepsEl = document.getElementById('fetchSteps');
    const fetchCounter = document.getElementById('fetchCounter');
    const fetchProgressFill = document.getElementById('fetchProgressFill');
    const trackerSpinner = document.getElementById('trackerSpinner');
    const trackerLabel = document.getElementById('trackerLabel');

    // GitHub language colors (top ~80 languages)
    const LANG_COLORS = {
      'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'Python': '#3572A5', 'Java': '#b07219',
      'C': '#555555', 'C++': '#f34b7d', 'C#': '#178600', 'Go': '#00ADD8', 'Rust': '#dea584',
      'Ruby': '#701516', 'PHP': '#4F5D95', 'Swift': '#F05138', 'Kotlin': '#A97BFF',
      'Dart': '#00B4AB', 'Scala': '#c22d40', 'Shell': '#89e051', 'Lua': '#000080',
      'Perl': '#0298c3', 'Haskell': '#5e5086', 'R': '#198CE7', 'Julia': '#a270ba',
      'Elixir': '#6e4a7e', 'Clojure': '#db5855', 'Erlang': '#B83998', 'OCaml': '#3be133',
      'F#': '#b845fc', 'Zig': '#ec915c', 'Nim': '#ffc200', 'V': '#4f87c4',
      'HTML': '#e34c26', 'CSS': '#563d7c', 'SCSS': '#c6538c', 'Vue': '#41b883',
      'Svelte': '#ff3e00', 'Objective-C': '#438eff', 'Objective-C++': '#6866fb',
      'Assembly': '#6E4C13', 'Makefile': '#427819', 'Dockerfile': '#384d54',
      'HCL': '#844FBA', 'Nix': '#7e7eff', 'PowerShell': '#012456',
      'Groovy': '#4298b8', 'CoffeeScript': '#244776', 'Vim Script': '#199f4b',
      'Emacs Lisp': '#c065db', 'TeX': '#3D6117', 'Jupyter Notebook': '#DA5B0B',
      'Solidity': '#AA6746', 'MATLAB': '#e16737', 'Fortran': '#4d41b1',
      'VHDL': '#adb2cb', 'Verilog': '#b2b7f8', 'SystemVerilog': '#DAE1C2',
      'D': '#ba595e', 'Ada': '#02f88c', 'Pascal': '#E3F171', 'Prolog': '#74283c',
      'Racket': '#3c5caa', 'Scheme': '#1e4aec', 'Common Lisp': '#3fb68b',
      'Crystal': '#000100', 'Elm': '#60B5CC', 'PureScript': '#1D222D',
      'Reason': '#ff5847', 'Hack': '#878787', 'COBOL': '#a6a7aa',
    };

    const metrics = {};
    let timerInterval = null;
    let progressVisible = true;
    let rawPromptText = '';
    let currentAbort = null; // AbortController for in-flight request

    // ── Fetch step tracking ───────────────────────────
    const FETCH_STEPS = [
      { id: 'stats', label: 'Stats' },
      { id: 'stars', label: 'Stars' },
      { id: 'commits', label: 'Commits' },
      { id: 'PRs', label: 'PRs' },
      { id: 'issues', label: 'Issues' },
      { id: 'forks', label: 'Forks' },
      { id: 'contributors', label: 'Contributors' },
      { id: 'GH mentions', label: 'GH Mentions' },
      { id: 'HackerNews', label: 'HN' },
      { id: 'Reddit', label: 'Reddit' },
      { id: 'YouTube', label: 'YouTube' },
      { id: 'releases', label: 'Releases' },
    ];
    const stepStates = {};

    function initFetchTracker() {
      fetchStepsEl.innerHTML = '';
      FETCH_STEPS.forEach(step => {
        stepStates[step.id] = 'pending';
        const el = document.createElement('span');
        el.className = 'fetch-step pending';
        el.id = `step-${step.id.replace(/\s/g, '-')}`;
        el.innerHTML = `<span class="fetch-step-icon">○</span>${step.label}`;
        fetchStepsEl.appendChild(el);
      });
      fetchTracker.style.display = 'block';
      updateFetchProgress();
    }

    function updateStepState(id, state) {
      stepStates[id] = state;
      const elId = `step-${id.replace(/\s/g, '-')}`;
      const el = document.getElementById(elId);
      if (!el) return;
      el.className = `fetch-step ${state}`;
      const icons = { pending: '○', loading: '◌', done: '✓', failed: '✗' };
      el.innerHTML = `<span class="fetch-step-icon">${icons[state] || '○'}</span>${FETCH_STEPS.find(s => s.id === id)?.label || id}`;
      updateFetchProgress();
    }

    function updateFetchProgress() {
      const total = FETCH_STEPS.length;
      const done = Object.values(stepStates).filter(s => s === 'done' || s === 'failed').length;
      const pct = Math.round((done / total) * 100);
      fetchCounter.textContent = `${done} / ${total}`;
      fetchProgressFill.style.width = `${pct}%`;
      if (done === total) {
        trackerSpinner.style.display = 'none';
        trackerLabel.textContent = 'All metrics fetched';
      }
    }

    function parseProgressLine(text) {
      // Match lines like "  → stats: fetching..." or "  ✓ stats: done (0.3s)" or "  ✗ HackerNews: no data (0.3s)"
      const fetchMatch = text.match(/→\s+(.+?):\s+fetching/);
      if (fetchMatch) {
        updateStepState(fetchMatch[1], 'loading');
        return;
      }
      const doneMatch = text.match(/✓\s+(.+?):\s+done/);
      if (doneMatch) {
        updateStepState(doneMatch[1], 'done');
        return;
      }
      const failMatch = text.match(/✗\s+(.+?):\s+(no data|failed)/);
      if (failMatch) {
        updateStepState(failMatch[1], 'failed');
        return;
      }
    }

    function hideFetchTracker() {
      // Keep it visible but mark complete
      trackerSpinner.style.display = 'none';
      trackerLabel.textContent = 'All metrics fetched';
    }

    // ── Skeleton loading ──────────────────────────────
    function showSkeleton() {
      skeletonGrid.innerHTML = '';
      for (let i = 0; i < 6; i++) {
        const card = document.createElement('div');
        card.className = 'skeleton-card';
        card.style.animationDelay = `${i * 0.1}s`;
        card.innerHTML = `
          <div class="skeleton-line sm"></div>
          <div class="skeleton-line lg"></div>
          <div class="skeleton-line chart"></div>
        `;
        skeletonGrid.appendChild(card);
      }
      skeletonGrid.style.display = 'grid';
    }
    function hideSkeleton() {
      skeletonGrid.style.display = 'none';
    }

    // ── Elapsed timer ─────────────────────────────────
    function startTimer() {
      const start = Date.now();
      elapsedTimer.style.display = 'block';
      elapsedTimer.textContent = '0s elapsed';
      timerInterval = setInterval(() => {
        const s = Math.floor((Date.now() - start) / 1000);
        const m = Math.floor(s / 60);
        elapsedTimer.textContent = m > 0 ? `${m}m ${s % 60}s elapsed` : `${s}s elapsed`;
      }, 1000);
    }
    function stopTimer() {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    }

    // ── Progress log toggle ───────────────────────────
    progressToggle.addEventListener('click', () => {
      progressVisible = !progressVisible;
      progressLog.style.display = progressVisible ? 'block' : 'none';
      toggleArrow.textContent = progressVisible ? '▼' : '▶';
    });

    // ── Prompt tabs ───────────────────────────────────
    document.querySelectorAll('.prompt-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.prompt-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const which = tab.dataset.tab;
        outputRendered.style.display = which === 'rendered' ? 'block' : 'none';
        outputRaw.style.display = which === 'raw' ? 'block' : 'none';
      });
    });

    // ── Simple markdown renderer ──────────────────────
    function renderMarkdown(text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Headings
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        // Horizontal rules
        .replace(/^---$/gm, '<hr>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // List items
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        // Wrap consecutive <li> in <ul>
        .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
        // Numbered list items
        .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
        // Paragraphs (non-empty lines not already tagged)
        .split('\n')
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed) return '';
          if (/^<[a-z]/.test(trimmed)) return trimmed;
          return `<p>${trimmed}</p>`;
        })
        .join('\n');
    }

    // ── Copy to clipboard ─────────────────────────────
    document.getElementById('copyBtn').addEventListener('click', async () => {
      const btn = document.getElementById('copyBtn');
      const icon = document.getElementById('copyIcon');
      const btnText = document.getElementById('copyText');
      try {
        await navigator.clipboard.writeText(rawPromptText);
        btn.classList.add('copied');
        icon.textContent = '✓';
        btnText.textContent = 'Copied!';
        setTimeout(() => { btn.classList.remove('copied'); icon.textContent = '📋'; btnText.textContent = 'Copy'; }, 2000);
      } catch {
        btnText.textContent = 'Failed';
        setTimeout(() => { btnText.textContent = 'Copy'; }, 2000);
      }
    });

    // ── Download as .md ──────────────────────────────
    document.getElementById('downloadBtn').addEventListener('click', () => {
      if (!rawPromptText) return;
      const repoName = input.value.trim().replace(/\//g, '-').replace(/^https:--github.com-/, '');
      const blob = new Blob([rawPromptText], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${repoName || 'repo-summary'}-prompt.md`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // ── Helpers ───────────────────────────────────────
    // --- Repo sanitizer (matches backend logic) ---
    function sanitizeRepo(str) {
      return str.trim()
        .replace(/\s+/g, '')
        .replace(/^https?:\/\/(www\.)?github\.com\//, '')
        .replace(/\/(tree|blob|issues|pulls|actions|releases|wiki|discussions|commits|tags)(\/.*)?$/, '')
        .replace(/\.git$/, '')
        .replace(/\/+$/, '');
    }

    function fmt(n) {
      if (n == null) return '0';
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
      if (n >= 10_000) return (n / 1_000).toFixed(1) + 'k';
      return n.toLocaleString('en-US');
    }

    function createMetricCard(title, value, subtitle, series, color) {
      const card = document.createElement('div');
      card.className = 'metric-card';
      const grad = color || 'linear-gradient(to top, #667eea, #a78bfa)';

      let chart = '';
      if (series?.length) {
        // Filter series based on chart view mode
        let filteredSeries = series;
        if (chartViewMode === '30d' && series.length > 30) {
          filteredSeries = series.slice(-30);
        }
        
        // Downsample if too many points - use weekly averages for readability
        const MAX_BARS = 60;
        let isDownsampled = false;
        if (filteredSeries.length > MAX_BARS) {
          isDownsampled = true;
          const bucketSize = Math.ceil(filteredSeries.length / MAX_BARS);
          const downsampled = [];
          for (let i = 0; i < filteredSeries.length; i += bucketSize) {
            const bucket = filteredSeries.slice(i, i + bucketSize);
            const avgVal = bucket.reduce((sum, s) => sum + (s[1] || 0), 0) / bucket.length;
            const firstDate = bucket[0][0];
            const lastDate = bucket[bucket.length - 1][0];
            const label = bucket.length > 1 ? `${firstDate} to ${lastDate}` : firstDate;
            downsampled.push([label, Math.round(avgVal)]);
          }
          filteredSeries = downsampled;
        }
        
        let max = 1;
        for (let i = 0; i < filteredSeries.length; i++) {
          const v = filteredSeries[i][1] || 0;
          if (v > max) max = v;
        }
        const bars = filteredSeries.map(s => {
          const v = s[1] || 0;
          const height = (v / max) * 100;
          const tip = isDownsampled ? `${s[0]} (avg: ${v})` : `${s[0]}: ${v}`;
          return `<div class="metric-bar" style="height:${height}%;background:${grad}" title="${tip}"></div>`;
        }).join('');
        chart = `<div class="metric-chart">${bars}</div>`;
      } else if (series === undefined) {
        chart = `<div class="metric-chart" style="justify-content:center;align-items:center;opacity:0.35;border:1px dashed rgba(255,255,255,0.08);border-radius:4px;"><span style="font-size:0.74em;color:var(--text-muted);">chart unavailable</span></div>`;
      }

      card.innerHTML = `
        <div class="metric-title">${title}</div>
        <div class="metric-value">${fmt(value)}</div>
        ${subtitle ? `<div class="metric-subtitle">${subtitle.split('\n').join('<br>')}</div>` : ''}
        ${chart}
      `;
      return card;
    }

    function sum30(series, idx) {
      if (!series || series.length === 0) return 0;
      const last30 = series.slice(-30);
      return last30.reduce((s, e) => s + ((e[idx] || 0)), 0);
    }

    function updateDashboard() {
      // Repo info
      if (metrics.stats) {
        const s = metrics.stats;
        const repoPath = sanitizeRepo(input.value);
        const created = s.data.created && !s.data.created.startsWith('0001') ? new Date(s.data.created).toISOString().split('T')[0] : '';
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
        // Convert hex to rgb for rgba() usage
        const hexToRgb = (hex) => {
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
            <span class="repo-tag">${fmt(s.data.mentionableUsers)} users</span>
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

      // Metrics cards
      metricsGrid.innerHTML = '';

      if (metrics.stars || metrics.stats) {
        const series = metrics.stars?.data.series;
        const daily30 = sum30(series, 1);
        // Show today's and yesterday's stars (series is sorted by date, last entries are most recent)
        let todayYesterday = '';
        if (series && series.length >= 2) {
          const today = series[series.length - 1];
          const yesterday = series[series.length - 2];
          todayYesterday = `Today (UTC): +${fmt(today[1])} · Yesterday: +${fmt(yesterday[1])}`;
        } else if (series && series.length === 1) {
          todayYesterday = `Today (UTC): +${fmt(series[0][1])}`;
        }
        const subtitle = [todayYesterday, daily30 ? `+${fmt(daily30)} in last 30 days` : ''].filter(Boolean).join('\n');
        metricsGrid.appendChild(createMetricCard(
          'Stars',
          metrics.stats?.data.stars || metrics.stars?.data.total || 0,
          subtitle,
          series,
          'linear-gradient(to top, #f59e0b, #fbbf24)'
        ));
      }

      if (metrics.commits) {
        const last30 = sum30(metrics.commits.data.series, 1);
        metricsGrid.appendChild(createMetricCard(
          'Commits',
          metrics.commits.data.total,
          `${fmt(last30)} in last 30 days`,
          metrics.commits.data.series,
          'linear-gradient(to top, #059669, #34d399)'
        ));
      }

      if (metrics.prs) {
        const opened = sum30(metrics.prs.data.series, 1);
        const merged = sum30(metrics.prs.data.series, 3);
        metricsGrid.appendChild(createMetricCard(
          'Pull Requests (30d)',
          opened,
          `${fmt(merged)} merged`,
          metrics.prs.data.series.map(s => [s[0], s[1]]),
          'linear-gradient(to top, #7c3aed, #a78bfa)'
        ));
      }

      if (metrics.issues) {
        const opened = sum30(metrics.issues.data.series, 1);
        const closed = sum30(metrics.issues.data.series, 2);
        metricsGrid.appendChild(createMetricCard(
          'Issues (30d)',
          opened,
          `${fmt(closed)} closed`,
          metrics.issues.data.series.map(s => [s[0], s[1]]),
          'linear-gradient(to top, #dc2626, #f87171)'
        ));
      }

      if (metrics.forks || metrics.stats) {
        const daily30 = sum30(metrics.forks?.data.series, 1);
        metricsGrid.appendChild(createMetricCard(
          'Forks',
          metrics.stats?.data.forks || metrics.forks?.data.total || 0,
          daily30 ? `+${fmt(daily30)} in last 30 days` : '',
          metrics.forks?.data.series,
          'linear-gradient(to top, #0284c7, #38bdf8)'
        ));
      }

      if (metrics.contributors) {
        const total = metrics.contributors.data.total;
        const last30 = sum30(metrics.contributors.data.series, 1);
        metricsGrid.appendChild(createMetricCard(
          'Contributors',
          total,
          last30 ? `${fmt(last30)} active in last 30d` : '',
          metrics.contributors.data.series,
          'linear-gradient(to top, #9333ea, #c084fc)'
        ));
      }

      if (metrics.stats && metrics.issues) {
        const last30Opened = sum30(metrics.issues.data.series, 1);
        const last30Closed = sum30(metrics.issues.data.series, 2);
        const net = last30Opened - last30Closed;
        const trend = net > 0 ? `+${net} net` : net < 0 ? `${net} net` : 'stable';
        metricsGrid.appendChild(createMetricCard(
          'Issue Backlog',
          metrics.stats.data.openIssues,
          `${trend} in last 30d`,
          null
        ));
      }

      // Governance card
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

      // Buzz / Social Activity card
      if (metrics.buzz) {
        const b = metrics.buzz.data;
        const card = document.createElement('div');
        card.className = 'metric-card';
        const barWidth = Math.min(b.score, 100);
        const barColor = b.score >= 70 ? '#ef4444' : b.score >= 45 ? '#f59e0b' : b.score >= 25 ? '#3b82f6' : '#6b7280';
        let breakdownHtml = '';
        const parts = [];
        if (b.breakdown.hn?.posts) parts.push(`HN: ${b.breakdown.hn.posts} (${fmt(b.breakdown.hn.points)} pts)`);
        if (b.breakdown.reddit?.posts) parts.push(`Reddit: ${b.breakdown.reddit.posts}`);
        if (b.breakdown.youtube?.videos) parts.push(`YT: ${b.breakdown.youtube.videos}`);
        if (b.breakdown.ghMentions?.total) parts.push(`GH: ${b.breakdown.ghMentions.total}`);
        if (parts.length) breakdownHtml = `<div style="margin-top:0.5em;font-size:0.78em;color:var(--text-muted);">${parts.join(' · ')}</div>`;
        const ratioColors = b.devActivityRatio.includes('talked')
          ? 'background:rgba(251,191,36,0.12);color:#fbbf24;border-color:rgba(251,191,36,0.2)'
          : 'background:rgba(52,211,153,0.12);color:#34d399;border-color:rgba(52,211,153,0.2)';
        const ratioTag = b.devActivityRatio === 'balanced' ? '' :
          `<div style="margin-top:0.5em;"><span class="repo-tag" style="${ratioColors}">${b.devActivityRatio}</span></div>`;
        card.innerHTML = `
          <div class="metric-title">Social Buzz</div>
          <div class="metric-value" style="font-size:1.4em;">${b.icon} ${b.label}</div>
          <div class="metric-subtitle">Score: ${b.score}/100 · ${fmt(b.totalMentions)} mentions${b.recentMentions ? ` (${b.recentMentions} recent)` : ''}</div>
          <div style="margin-top:0.6em;background:rgba(255,255,255,0.06);border-radius:6px;height:6px;overflow:hidden;">
            <div style="width:${barWidth}%;height:100%;background:${barColor};border-radius:6px;transition:width 0.6s ease-out;"></div>
          </div>
          ${breakdownHtml}
          ${ratioTag}
        `;
        metricsGrid.appendChild(card);
      }

      if (metricsGrid.children.length > 0) {
        metricsGrid.style.display = 'grid';
        document.getElementById('chartViewToggle').style.display = 'flex';
        hideSkeleton();
      }

      // Ollama AI analysis section
      if (metrics.ollama) {
        const { response, model } = metrics.ollama.data;
        ollamaSection.innerHTML = `
          <div class="ollama-header">
            <div class="ollama-title">
              <span>🤖</span> AI Analysis
              ${model ? `<span class="ollama-model-tag">${model}</span>` : ''}
            </div>
          </div>
          <div class="ollama-content">${response.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        `;
        ollamaSection.style.display = 'block';
      }
    }

    function classifyLine(text) {
      if (text.includes('✓')) return 'line-ok';
      if (text.includes('✗')) return 'line-fail';
      if (/retrying|error|failed/i.test(text)) return 'line-retry';
      return 'line-info';
    }

    function appendProgress(text) {
      parseProgressLine(text);
      const span = document.createElement('span');
      span.className = classifyLine(text);
      span.textContent = text + '\n';
      progressLog.appendChild(span);
      progressLog.scrollTop = progressLog.scrollHeight;
    }

    // ── URL query param support ───────────────────────
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('repo')) {
      input.value = urlParams.get('repo');
      requestAnimationFrame(() => form.dispatchEvent(new Event('submit')));
    }

    // Reset hasGeneratedData when input changes to a different repo
    let lastRepo = '';
    input.addEventListener('input', () => {
      const currentRepo = sanitizeRepo(input.value);
      if (currentRepo !== lastRepo) {
        hasGeneratedData = false;
        submitBtn.textContent = 'Generate';
        submitBtn.title = '';
        lastRepo = currentRepo;
      }
    });

    // ── Form submit ───────────────────────────────────
    form.onsubmit = async (e) => {
      e.preventDefault();

      // Prevent parallel requests — abort any in-flight fetch first
      if (currentAbort) {
        currentAbort.abort();
        currentAbort = null;
      }
      currentAbort = new AbortController();

      // Reset
      Object.keys(metrics).forEach(k => delete metrics[k]);
      rawPromptText = '';
      promptSection.style.display = 'none';
      errorDiv.style.display = 'none';
      metricsGrid.style.display = 'none';
      metricsGrid.innerHTML = '';
      chartViewToggle.style.display = 'none';
      ollamaSection.style.display = 'none';
      repoInfo.style.display = 'none';
      progressLog.innerHTML = '';
      progressLog.style.display = 'block';
      progressToggle.style.display = 'flex';
      progressVisible = true;
      toggleArrow.textContent = '▼';
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Fetching<span class="loading-spinner"></span>';
      
      // Add force parameter if this is an Update (refresh) request
      const forceParam = hasGeneratedData ? '&force=true' : '';
      
      initFetchTracker();
      showSkeleton();
      startTimer();

      // Reset tabs
      document.querySelectorAll('.prompt-tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.prompt-tab[data-tab="rendered"]').classList.add('active');
      outputRendered.style.display = 'block';
      outputRaw.style.display = 'none';

      // Update URL without reload
      const repoVal = sanitizeRepo(input.value);
      history.replaceState(null, '', `?repo=${encodeURIComponent(repoVal)}`);
      addRecentRepo(repoVal);

      let finalPrompt = null;
      let gotError = null;

      try {
        const res = await fetch(`${apiBase}/api/prompt?repo=${encodeURIComponent(repoVal)}${forceParam}`, {
          signal: currentAbort.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split('\n\n');
          buffer = parts.pop();

          for (const part of parts) {
            let eventType = 'message';
            let data = '';
            for (const line of part.split('\n')) {
              if (line.startsWith('event: ')) eventType = line.slice(7);
              else if (line.startsWith('data: ')) data = line.slice(6);
            }
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);
              if (eventType === 'cache') {
                // Show cached data notice
                const cachedAt = new Date(parsed.cachedAt);
                const expiresAt = new Date(parsed.expiresAt);
                const fmtTime = (d) => d.toLocaleString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false });
                const fmtDate = (d) => d.toLocaleString('en-GB', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
                const localOffset = -(new Date().getTimezoneOffset() / 60);
                const sign = localOffset >= 0 ? '+' : '';
                const localMidnight = new Date(expiresAt.getTime());
                const localResetTime = localMidnight.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
                appendProgress(`⚡ Serving cached results (fetched ${fmtDate(cachedAt)} ${fmtTime(cachedAt)} UTC)`);
                appendProgress(`📅 Cache resets daily at 00:00 UTC (${localResetTime} your time). Click "Update" to force refresh.`);
              } else if (eventType === 'progress') {
                appendProgress(parsed);
              } else if (eventType === 'metrics') {
                metrics[parsed.type] = parsed;
                updateDashboard();
              } else if (eventType === 'done') {
                finalPrompt = parsed;
              } else if (eventType === 'error') {
                gotError = parsed;
              }
            } catch {}
          }
        }

        stopTimer();
        hideSkeleton();
        hideFetchTracker();

        if (gotError) {
          errorDiv.textContent = gotError;
          errorDiv.style.display = 'block';
        } else if (finalPrompt) {
          rawPromptText = finalPrompt;
          outputRaw.textContent = finalPrompt;
          outputRendered.innerHTML = renderMarkdown(finalPrompt);
          promptSection.style.display = 'block';
          // Auto-collapse progress log when done
          progressVisible = false;
          progressLog.style.display = 'none';
          toggleArrow.textContent = '▶';
        } else {
          errorDiv.textContent = 'No output received';
          errorDiv.style.display = 'block';
        }
      } catch (err) {
        if (err.name === 'AbortError') return; // Silently ignore aborted requests
        stopTimer();
        hideSkeleton();
        errorDiv.textContent = err.message || 'Request failed';
        errorDiv.style.display = 'block';
      } finally {
        currentAbort = null;
        submitBtn.disabled = false;
        // Change button to "Update" after first successful generation
        if (finalPrompt && !gotError) {
          hasGeneratedData = true;
          submitBtn.textContent = 'Update';
          submitBtn.title = 'Fetch latest data (bypasses 1-day cache)';
        } else {
          submitBtn.textContent = hasGeneratedData ? 'Update' : 'Generate';
        }
      }
    };
