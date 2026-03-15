import { state } from './state.js';
import { isGhPages, apiBase } from './config.js';
import { sanitizeRepo, renderMarkdown } from './utils.js';
import {
  initFetchTracker, parseProgressLine, hideFetchTracker,
  showSkeleton, hideSkeleton, startTimer, stopTimer, startCooldownTimer,
} from './tracker.js';
import { updateDashboard } from './dashboard.js';
import {
  initTheme, initChartViewToggle, initShareButton,
  initRecentRepos, addRecentRepo, initAutocomplete,
  initProgressToggle, initPromptTabs, initCopyDownload,
} from './handlers.js';

// ── DOM refs used only in main ────────────────────────────────────────────────
const form            = document.getElementById('repoForm');
const input           = document.getElementById('repoInput');
const submitBtn       = document.getElementById('submitBtn');
const repoInfo        = document.getElementById('repoInfo');
const metricsGrid     = document.getElementById('metricsGrid');
const mentionsPanel   = document.getElementById('mentionsPanel');
const outputRendered  = document.getElementById('outputRendered');
const outputRaw       = document.getElementById('outputRaw');
const progressLog     = document.getElementById('progressLog');
const progressToggle  = document.getElementById('progressToggle');
const toggleArrow     = document.getElementById('toggleArrow');
const promptSection   = document.getElementById('promptSection');
const errorDiv        = document.getElementById('error');
const ollamaSection   = document.getElementById('ollamaSection');
const ollamaBadge     = document.getElementById('ollamaBadge');
const quotaBadgeEl    = document.getElementById('quotaBadge');
const chartViewToggle = document.getElementById('chartViewToggle');

// ── Quota badge ───────────────────────────────────────────────────────────────
function updateQuotaBadge(used, limit, remaining) {
  if (limit == null) { quotaBadgeEl.style.display = 'none'; return; }
  const pct = used / limit;
  quotaBadgeEl.className = `quota-badge ${pct >= 1 ? 'exhausted' : pct >= 0.75 ? 'warning' : 'ok'}`;
  quotaBadgeEl.textContent = `${remaining} fetch${remaining !== 1 ? 'es' : ''} left today`;
  quotaBadgeEl.title = `${used} of ${limit} daily fetches used`;
  quotaBadgeEl.style.display = 'inline-flex';
}

async function refreshStatus() {
  if (isGhPages) return;
  try {
    const data = await fetch(`${apiBase}/api/status`).then(r => r.json());
    state.cachedReposList = data.cachedRepos || [];
    updateQuotaBadge(data.fetchesUsed, data.fetchesLimit, data.fetchesRemaining);
  } catch {}
}

// ── Progress log helpers ──────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function getRepoPath() {
  return sanitizeRepo(input.value);
}

// ── Init ──────────────────────────────────────────────────────────────────────
initTheme();
initChartViewToggle(getRepoPath);
initShareButton(getRepoPath);
initRecentRepos();
initAutocomplete();
initProgressToggle();
initPromptTabs();
initCopyDownload();
refreshStatus();

// Ollama badge
if (!isGhPages) {
  fetch(`${apiBase}/api/ollama-status`)
    .then(r => r.json())
    .then(({ enabled, model, reachable }) => {
      if (!enabled) return;
      ollamaBadge.className = `ollama-badge ${reachable ? 'ready' : 'offline'}`;
      ollamaBadge.title = reachable ? `Ollama ready (${model})` : 'Ollama configured but unreachable';
      ollamaBadge.innerHTML = `<span>${reachable ? '●' : '○'}</span> Ollama${model ? ` · ${model}` : ''}`;
      ollamaBadge.style.display = 'inline-flex';
    }).catch(() => {});
}

// ── URL query param — auto-submit on load ─────────────────────────────────────
const urlRepo = new URLSearchParams(location.search).get('repo');
if (urlRepo) {
  input.value = urlRepo;
  requestAnimationFrame(() => form.dispatchEvent(new Event('submit')));
}

// Reset button label when user types a different repo
input.addEventListener('input', () => {
  const current = getRepoPath();
  if (current !== state.lastRepo) {
    state.hasGeneratedData = false;
    submitBtn.textContent = 'Generate';
    submitBtn.title = '';
    state.lastRepo = current;
  }
});

// ── Form submit — SSE stream handler ─────────────────────────────────────────
form.onsubmit = async (e) => {
  e.preventDefault();

  if (state.currentAbort) { state.currentAbort.abort(); state.currentAbort = null; }
  state.currentAbort = new AbortController();

  // Reset UI
  Object.keys(state.metrics).forEach(k => delete state.metrics[k]);
  state.rawPromptText = '';
  promptSection.style.display = 'none';
  errorDiv.style.display = 'none';
  metricsGrid.style.display = 'none';
  metricsGrid.innerHTML = '';
  chartViewToggle.style.display = 'none';
  ollamaSection.style.display = 'none';
  repoInfo.style.display = 'none';
  mentionsPanel.style.display = 'none';
  mentionsPanel.innerHTML = '';
  progressLog.innerHTML = '';
  progressLog.style.display = 'block';
  progressToggle.style.display = 'flex';
  state.progressVisible = true;
  toggleArrow.textContent = '▼';
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Fetching<span class="loading-spinner"></span>';

  const forceParam = state.hasGeneratedData ? '&force=true' : '';
  initFetchTracker();
  showSkeleton();
  startTimer();

  // Reset prompt tabs to rendered
  document.querySelectorAll('.prompt-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.prompt-tab[data-tab="rendered"]').classList.add('active');
  outputRendered.style.display = 'block';
  outputRaw.style.display = 'none';

  const repoVal = getRepoPath();
  history.replaceState(null, '', `?repo=${encodeURIComponent(repoVal)}`);
  addRecentRepo(repoVal);

  let finalPrompt = null;
  let gotError = null;
  let promptShown = false;
  let cooldownActive = false;

  const showPromptNow = (text) => {
    if (promptShown) return;
    promptShown = true;
    state.rawPromptText = text;
    outputRaw.textContent = text;
    outputRendered.innerHTML = renderMarkdown(text);
    promptSection.style.display = 'block';
    stopTimer();
    hideSkeleton();
    hideFetchTracker();
    state.progressVisible = false;
    progressLog.style.display = 'none';
    toggleArrow.textContent = '▶';
    state.hasGeneratedData = true;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Update';
    submitBtn.title = 'Fetch latest data (bypasses 1-day cache)';
  };

  try {
    const res = await fetch(`${apiBase}/api/prompt?repo=${encodeURIComponent(repoVal)}${forceParam}`, {
      signal: state.currentAbort.signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 429 && data.retryAfter) {
        cooldownActive = true;
        startCooldownTimer(data.error, data.retryAfter);
        return;
      }
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
            const cachedAt = new Date(parsed.cachedAt);
            const expiresAt = new Date(parsed.expiresAt);
            const fmtT = d => d.toLocaleString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false });
            const fmtD = d => d.toLocaleString('en-GB', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
            const localReset = expiresAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
            appendProgress(`⚡ Serving cached results (fetched ${fmtD(cachedAt)} ${fmtT(cachedAt)} UTC)`);
            appendProgress(`📅 Cache resets daily at 00:00 UTC (${localReset} your time). Click "Update" to force refresh.`);
          } else if (eventType === 'progress') {
            appendProgress(parsed);
          } else if (eventType === 'metrics') {
            state.metrics[parsed.type] = parsed;
            updateDashboard(repoVal);
          } else if (eventType === 'done') {
            finalPrompt = parsed;
            showPromptNow(finalPrompt);
          } else if (eventType === 'ollama-pending') {
            const { model, prompt: ollamaPrompt } = parsed;
            if (ollamaPrompt) state.metrics.ollamaPrompt = ollamaPrompt;
            const promptHtml = ollamaPrompt
              ? `<details class="ollama-prompt-details"><summary>Prompt sent to Ollama</summary><pre class="ollama-prompt-pre">${ollamaPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></details>`
              : '';
            ollamaSection.innerHTML = `
              <div class="ollama-header">
                <div class="ollama-title">
                  <span>🤖</span> AI Analysis
                  ${model ? `<span class="ollama-model-tag">${model}</span>` : ''}
                </div>
                <span style="font-size:0.82em;color:var(--text-muted);">Running analysis, this may take a while...</span>
              </div>
              <div class="ollama-disclaimer">⚠️ This analysis runs on a lightweight local model hosted on a simple VM — results may be limited. For a deeper and more accurate investigation, copy the full prompt above and paste it into your LLM of choice (ChatGPT, Claude, Gemini…).</div>
              <div class="ollama-content" style="display:flex;align-items:center;gap:0.6em;min-height:60px;opacity:0.5;">
                <span style="display:inline-block;width:12px;height:12px;border:2px solid var(--accent-glow);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0;"></span>
                Waiting for Ollama...
              </div>
              ${promptHtml}
            `;
            ollamaSection.style.display = 'block';
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
    } else if (!finalPrompt) {
      errorDiv.textContent = 'No output received';
      errorDiv.style.display = 'block';
    }

    if (ollamaSection.style.display !== 'none' && !state.metrics.ollama) {
      const contentEl = ollamaSection.querySelector('.ollama-content');
      if (contentEl) contentEl.innerHTML = '<span style="opacity:0.5;font-size:0.85em;">Ollama did not return a response.</span>';
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    stopTimer();
    hideSkeleton();
    errorDiv.textContent = err.message || 'Request failed';
    errorDiv.style.display = 'block';
  } finally {
    state.currentAbort = null;
    refreshStatus();
    if (!promptShown && !cooldownActive) {
      submitBtn.disabled = false;
      submitBtn.textContent = state.hasGeneratedData ? 'Update' : 'Generate';
    }
  }
};
