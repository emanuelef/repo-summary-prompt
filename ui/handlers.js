import { state } from './state.js';
import { sanitizeRepo } from './utils.js';
import { updateDashboard } from './dashboard.js';

// ── Theme ─────────────────────────────────────────────────────────────────────

const themeToggle = document.getElementById('themeToggle');

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
}

export function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(saved || (prefersDark ? 'dark' : 'light'));
  themeToggle.addEventListener('click', () => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });
}

// ── Chart view toggle ─────────────────────────────────────────────────────────

export function initChartViewToggle(getRepoPath) {
  document.querySelectorAll('.chart-view-btn').forEach(btn => {
    if (btn.dataset.view === state.chartViewMode) btn.classList.add('active');
    btn.addEventListener('click', () => {
      state.chartViewMode = btn.dataset.view;
      localStorage.setItem('chartViewMode', btn.dataset.view);
      document.querySelectorAll('.chart-view-btn').forEach(b => b.classList.toggle('active', b === btn));
      updateDashboard(getRepoPath());
    });
  });
}

// ── Share button (event delegation — button is created dynamically) ───────────

export function initShareButton(getRepoPath) {
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('#shareBtn')) return;
    e.preventDefault();
    const btn = e.target.closest('#shareBtn');
    const shareUrl = `${location.origin}${location.pathname}?repo=${encodeURIComponent(getRepoPath())}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      const original = btn.innerHTML;
      btn.innerHTML = `<svg viewBox="0 0 16 16"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>Copied!`;
      btn.style.background = 'rgba(34,211,238,0.25)';
      setTimeout(() => { btn.innerHTML = original; btn.style.background = ''; }, 2000);
    } catch {
      btn.textContent = 'Failed to copy';
      setTimeout(() => { btn.innerHTML = `<svg viewBox="0 0 16 16"><path d="M13.5 3a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 5.5a2.5 2.5 0 00-3.5-2.29l-4.33 2.6a2.5 2.5 0 000 4.38l4.33 2.6A2.5 2.5 0 1014 11.5v-6A.5.5 0 0015 5.5zm-3.5 7.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM4.5 8a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/></svg>Share`; }, 2000);
    }
  });
}

// ── Recent repos ──────────────────────────────────────────────────────────────

const recentReposEl = document.getElementById('recentRepos');

function getRecentRepos() {
  try { return JSON.parse(localStorage.getItem('recentRepos') || '[]'); } catch { return []; }
}

function removeRecentRepo(repo) {
  localStorage.setItem('recentRepos', JSON.stringify(getRecentRepos().filter(r => r !== repo)));
  renderRecentRepos();
}

function renderRecentRepos() {
  const recent = getRecentRepos();
  if (!recent.length) { recentReposEl.style.display = 'none'; return; }
  recentReposEl.innerHTML = '<span class="recent-label">Recent:</span>';
  recent.forEach(repo => {
    const chip = document.createElement('span');
    chip.className = 'recent-chip';
    const label = document.createElement('span');
    label.textContent = repo;
    label.style.cursor = 'pointer';
    label.addEventListener('click', () => {
      document.getElementById('repoInput').value = repo;
      document.getElementById('repoForm').dispatchEvent(new Event('submit'));
    });
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-recent';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove from recent';
    removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeRecentRepo(repo); });
    chip.appendChild(label);
    chip.appendChild(removeBtn);
    recentReposEl.appendChild(chip);
  });
  recentReposEl.style.display = 'flex';
}

export function addRecentRepo(repo) {
  let recent = getRecentRepos().filter(r => r !== repo);
  recent.unshift(repo);
  localStorage.setItem('recentRepos', JSON.stringify(recent.slice(0, 8)));
  renderRecentRepos();
}

export function initRecentRepos() {
  renderRecentRepos();
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

const input = document.getElementById('repoInput');
const autocompleteEl = document.getElementById('autocompleteDropdown');
const isGhPages = location.hostname.endsWith('github.io');

function showAutocomplete(query) {
  if (isGhPages || !autocompleteEl) return;
  const q = query.toLowerCase().trim();
  state.acItems = q ? state.cachedReposList.filter(r => r.toLowerCase().includes(q)) : state.cachedReposList;
  if (!state.acItems.length) { autocompleteEl.style.display = 'none'; return; }
  state.acActiveIndex = -1;
  autocompleteEl.innerHTML = '';
  state.acItems.forEach(repo => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.innerHTML = `<span>${repo}</span><span class="autocomplete-cached-tag">⚡ cached</span>`;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      input.value = repo;
      hideAutocomplete();
      document.getElementById('repoForm').dispatchEvent(new Event('submit'));
    });
    autocompleteEl.appendChild(item);
  });
  autocompleteEl.style.display = 'block';
}

function hideAutocomplete() {
  if (autocompleteEl) autocompleteEl.style.display = 'none';
  state.acActiveIndex = -1;
}

export function initAutocomplete() {
  input.addEventListener('input', () => showAutocomplete(input.value));
  input.addEventListener('focus', () => { if (state.cachedReposList.length > 0) showAutocomplete(input.value); });
  input.addEventListener('blur', () => setTimeout(hideAutocomplete, 150));
  input.addEventListener('keydown', (e) => {
    if (!autocompleteEl || autocompleteEl.style.display === 'none') return;
    const items = autocompleteEl.querySelectorAll('.autocomplete-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.acActiveIndex = Math.min(state.acActiveIndex + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === state.acActiveIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.acActiveIndex = Math.max(state.acActiveIndex - 1, -1);
      items.forEach((el, i) => el.classList.toggle('active', i === state.acActiveIndex));
    } else if (e.key === 'Enter' && state.acActiveIndex >= 0) {
      e.preventDefault();
      input.value = state.acItems[state.acActiveIndex];
      hideAutocomplete();
      document.getElementById('repoForm').dispatchEvent(new Event('submit'));
    } else if (e.key === 'Escape') {
      hideAutocomplete();
    }
  });
}

// ── Progress log toggle ───────────────────────────────────────────────────────

export function initProgressToggle() {
  const progressToggle = document.getElementById('progressToggle');
  const progressLog    = document.getElementById('progressLog');
  const toggleArrow    = document.getElementById('toggleArrow');
  progressToggle.addEventListener('click', () => {
    state.progressVisible = !state.progressVisible;
    progressLog.style.display = state.progressVisible ? 'block' : 'none';
    toggleArrow.textContent = state.progressVisible ? '▼' : '▶';
  });
}

// ── Prompt tabs ───────────────────────────────────────────────────────────────

export function initPromptTabs() {
  const outputRendered = document.getElementById('outputRendered');
  const outputRaw      = document.getElementById('outputRaw');
  document.querySelectorAll('.prompt-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.prompt-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      outputRendered.style.display = tab.dataset.tab === 'rendered' ? 'block' : 'none';
      outputRaw.style.display      = tab.dataset.tab === 'raw'      ? 'block' : 'none';
    });
  });
}

// ── Copy & download ───────────────────────────────────────────────────────────

export function initCopyDownload() {
  document.getElementById('copyBtn').addEventListener('click', async () => {
    const btn     = document.getElementById('copyBtn');
    const icon    = document.getElementById('copyIcon');
    const btnText = document.getElementById('copyText');
    try {
      await navigator.clipboard.writeText(state.rawPromptText);
      btn.classList.add('copied');
      icon.textContent = '✓';
      btnText.textContent = 'Copied!';
      setTimeout(() => { btn.classList.remove('copied'); icon.textContent = '📋'; btnText.textContent = 'Copy'; }, 2000);
    } catch {
      btnText.textContent = 'Failed';
      setTimeout(() => { btnText.textContent = 'Copy'; }, 2000);
    }
  });

  document.getElementById('downloadBtn').addEventListener('click', () => {
    if (!state.rawPromptText) return;
    const repoName = sanitizeRepo(document.getElementById('repoInput').value).replace(/\//g, '-');
    const blob = new Blob([state.rawPromptText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${repoName || 'repo-summary'}-prompt.md`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
