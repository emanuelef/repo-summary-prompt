import { state } from './state.js';
import { FETCH_STEPS } from './config.js';

const fetchTracker    = document.getElementById('fetchTracker');
const fetchStepsEl    = document.getElementById('fetchSteps');
const fetchCounter    = document.getElementById('fetchCounter');
const fetchProgressFill = document.getElementById('fetchProgressFill');
const trackerSpinner  = document.getElementById('trackerSpinner');
const trackerLabel    = document.getElementById('trackerLabel');
const skeletonGrid    = document.getElementById('skeletonGrid');
const elapsedTimer    = document.getElementById('elapsedTimer');
const errorDiv        = document.getElementById('error');
const submitBtn       = document.getElementById('submitBtn');

// ── Fetch step tracking ───────────────────────────────────────────────────────

export function initFetchTracker() {
  fetchStepsEl.innerHTML = '';
  FETCH_STEPS.forEach(step => {
    state.stepStates[step.id] = 'pending';
    const el = document.createElement('span');
    el.className = 'fetch-step pending';
    el.id = `step-${step.id.replace(/\s/g, '-')}`;
    el.innerHTML = `<span class="fetch-step-icon">○</span>${step.label}`;
    fetchStepsEl.appendChild(el);
  });
  fetchTracker.style.display = 'block';
  updateFetchProgress();
}

export function updateStepState(id, stepState) {
  state.stepStates[id] = stepState;
  const el = document.getElementById(`step-${id.replace(/\s/g, '-')}`);
  if (!el) return;
  el.className = `fetch-step ${stepState}`;
  const icons = { pending: '○', loading: '◌', done: '✓', failed: '✗' };
  el.innerHTML = `<span class="fetch-step-icon">${icons[stepState] || '○'}</span>${FETCH_STEPS.find(s => s.id === id)?.label || id}`;
  updateFetchProgress();
}

function updateFetchProgress() {
  const total = FETCH_STEPS.length;
  const done = Object.values(state.stepStates).filter(s => s === 'done' || s === 'failed').length;
  const pct = Math.round((done / total) * 100);
  fetchCounter.textContent = `${done} / ${total}`;
  fetchProgressFill.style.width = `${pct}%`;
  if (done === total) {
    trackerSpinner.style.display = 'none';
    trackerLabel.textContent = 'All metrics fetched';
  }
}

export function parseProgressLine(text) {
  const fetchMatch = text.match(/→\s+(.+?):\s+fetching/);
  if (fetchMatch) { updateStepState(fetchMatch[1], 'loading'); return; }
  const doneMatch = text.match(/✓\s+(.+?):\s+done/);
  if (doneMatch) { updateStepState(doneMatch[1], 'done'); return; }
  const failMatch = text.match(/✗\s+(.+?):\s+(no data|failed)/);
  if (failMatch) { updateStepState(failMatch[1], 'failed'); }
}

export function hideFetchTracker() {
  trackerSpinner.style.display = 'none';
  trackerLabel.textContent = 'All metrics fetched';
}

// ── Skeleton loading ──────────────────────────────────────────────────────────

export function showSkeleton() {
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

export function hideSkeleton() {
  skeletonGrid.style.display = 'none';
}

// ── Elapsed timer ─────────────────────────────────────────────────────────────

export function startTimer() {
  const start = Date.now();
  elapsedTimer.style.display = 'block';
  elapsedTimer.textContent = '0s elapsed';
  state.timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000);
    const m = Math.floor(s / 60);
    elapsedTimer.textContent = m > 0 ? `${m}m ${s % 60}s elapsed` : `${s}s elapsed`;
  }, 1000);
}

export function stopTimer() {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
}

// ── Cooldown timer (429 rate-limit) ───────────────────────────────────────────

export function startCooldownTimer(message, retryAfterIso) {
  stopTimer();
  hideSkeleton();
  hideFetchTracker();
  if (state.cooldownTimerInterval) clearInterval(state.cooldownTimerInterval);
  errorDiv.style.display = 'block';
  const retryAt = new Date(retryAfterIso).getTime();
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    const timeStr = m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
    if (remaining > 0) {
      errorDiv.innerHTML = `${message}<br><small style="opacity:0.75;font-size:0.9em;">Retry in: <strong>${timeStr}</strong></small>`;
    } else {
      clearInterval(state.cooldownTimerInterval);
      state.cooldownTimerInterval = null;
      errorDiv.innerHTML = `${message}<br><small style="opacity:0.75;color:var(--success);">Cooldown expired — you can fetch this repo again.</small>`;
      submitBtn.disabled = false;
      submitBtn.textContent = state.hasGeneratedData ? 'Update' : 'Generate';
    }
  };
  tick();
  state.cooldownTimerInterval = setInterval(tick, 1000);
}
