import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';

const app = new Hono();

// Enable CORS for all routes
app.use('*', cors({
  origin: '*', // You can restrict this to your frontend domain if needed
}));

// Serve static index.html at root
app.get('/', async (c) => {
  const html = await readFile(new URL('./index.html', import.meta.url));
  return c.html(html.toString());
});


// Health check endpoint
app.get('/health', (c) => c.json({ status: 'ok' }));

// Ollama status endpoint
app.get('/api/ollama-status', async (c) => {
  const enabled = process.env.USE_OLLAMA === 'true' && !!process.env.OLLAMA_URL && !!process.env.OLLAMA_MODEL;
  if (!enabled) return c.json({ enabled: false });
  try {
    const res = await fetch(`${process.env.OLLAMA_URL.replace(/\/$/, '')}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return c.json({ enabled: true, model: process.env.OLLAMA_MODEL, reachable: res.ok });
  } catch {
    return c.json({ enabled: true, model: process.env.OLLAMA_MODEL, reachable: false });
  }
});

// Serve static assets (if any)
app.get('/favicon.ico', (c) => c.body('', 204));

// ── Ollama helper (server-side, no timeout cap from proxy) ────────────
async function callOllama(prompt, timeoutMs = 1200000) {
  const url = `${process.env.OLLAMA_URL.replace(/\/$/, '')}/api/generate`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OLLAMA_MODEL, prompt, stream: false }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data.response || null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// Status endpoint — cached repos list + daily quota info
app.get('/api/status', (c) => {
  checkAndResetFetchCounter();
  const cachedRepos = [...cache.keys()].filter(k => isCacheValid(cache.get(k)));
  return c.json({
    cachedRepos,
    fetchesUsed: dailyFetchCount,
    fetchesLimit: maxDailyFetches,
    fetchesRemaining: maxDailyFetches != null ? Math.max(0, maxDailyFetches - dailyFetchCount) : null,
  });
});

// Validate repo format: must be owner/repo with safe characters only
function sanitizeRepo(str) {
  const cleaned = str.trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/\/(tree|blob|issues|pulls|actions|releases|wiki|discussions|commits|tags)(\/.*)?$/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
  if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(cleaned)) return null;
  return cleaned;
}

// Only one CLI process at a time to avoid GitHub rate-limit exhaustion
let activeChild = null;

// ── In-memory cache: results are valid until midnight UTC ─────────────
// Each entry: { events: [{ event, data }], cachedAt: Date }
const cache = new Map();

function getUTCMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isCacheValid(entry) {
  if (!entry) return false;
  return entry.cachedAt >= getUTCMidnight();
}

// Daily fetch counter (resets at UTC midnight, same cadence as cache)
let dailyFetchCount = 0;
let fetchCountDay = getUTCMidnight();
// Default 20; set MAX_DAILY_FETCHES=unlimited (or 0) to disable
const maxDailyFetches = (() => {
  const v = process.env.MAX_DAILY_FETCHES;
  if (!v || v === 'unlimited') return v === 'unlimited' ? null : 20;
  const n = parseInt(v, 10);
  return isNaN(n) || n <= 0 ? null : n;
})();

// Large-repo cooldown — repos with >10k stars are blocked for 1 hour after a fetch
// (only enforced when a quota is configured, to protect API rate limits)
const LARGE_REPO_STAR_THRESHOLD = 10_000;
const LARGE_REPO_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const largeRepoCooldowns = new Map(); // repoStr → Date (when last fetched)

function checkAndResetFetchCounter() {
  const today = getUTCMidnight();
  if (today > fetchCountDay) {
    dailyFetchCount = 0;
    fetchCountDay = today;
  }
}

// API endpoint — streams progress via SSE, then sends the final prompt
app.get('/api/prompt', async (c) => {
  const repo = c.req.query('repo');
  if (!repo) return c.json({ error: 'Missing repo' }, 400);
  const repoStr = sanitizeRepo(repo);
  if (!repoStr) return c.json({ error: 'Invalid repo format. Use owner/repo' }, 400);

  // Check if force refresh is requested
  const forceRefresh = c.req.query('force') === 'true';

  // Check cache first (unless force refresh)
  const cached = cache.get(repoStr);
  if (!forceRefresh && isCacheValid(cached)) {
    const enc = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(controller) {
          // Send cache metadata first
          const cacheInfo = {
            cached: true,
            cachedAt: cached.cachedAt.toISOString(),
            expiresAt: new Date(getUTCMidnight().getTime() + 86400000).toISOString(),
          };
          controller.enqueue(enc.encode(`event: cache\ndata: ${JSON.stringify(cacheInfo)}\n\n`));
          // Replay all cached events
          for (const ev of cached.events) {
            controller.enqueue(enc.encode(`event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`));
          }
          controller.close();
        },
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      },
    );
  }

  // Check daily fetch limit before spawning (cache hits bypass this)
  checkAndResetFetchCounter();
  if (maxDailyFetches != null && dailyFetchCount >= maxDailyFetches) {
    return c.json({ error: `Daily fetch limit of ${maxDailyFetches} reached. Try a cached repo or come back after midnight UTC.` }, 429);
  }

  // Check large-repo cooldown (only when a quota is configured)
  if (maxDailyFetches != null) {
    const cooldownFetchedAt = largeRepoCooldowns.get(repoStr);
    if (cooldownFetchedAt) {
      const elapsed = Date.now() - cooldownFetchedAt.getTime();
      if (elapsed < LARGE_REPO_COOLDOWN_MS) {
        const retryAfter = new Date(cooldownFetchedAt.getTime() + LARGE_REPO_COOLDOWN_MS);
        return c.json({
          error: `This repo has >10k stars and was fetched recently. Large repos consume significant API quota.`,
          retryAfter: retryAfter.toISOString(),
          remainingSeconds: Math.ceil((retryAfter.getTime() - Date.now()) / 1000),
        }, 429);
      }
      largeRepoCooldowns.delete(repoStr); // cooldown expired, clean up
    }
  }

  dailyFetchCount++;

  // Kill any in-flight CLI process before starting a new one
  if (activeChild) {
    try { activeChild.kill('SIGTERM'); } catch {}
    activeChild = null;
  }

  let closed = false;
  let child = null;
  let ollamaPromptText = null;
  let capturedStars = null;
  const recordedEvents = [];

  return new Response(
    new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        
        const send = (event, data) => {
          if (closed) return;
          try {
            controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            // Record events for caching (skip progress lines)
            if (event !== 'progress') {
              recordedEvents.push({ event, data });
            }
          } catch {
            closed = true;
          }
        };
        
        let globalKeepalive = null;
        const closeController = () => {
          if (closed) return;
          closed = true;
          if (globalKeepalive) { clearInterval(globalKeepalive); globalKeepalive = null; }
          try {
            controller.close();
          } catch {}
        };

        child = spawn('npx', ['tsx', 'src/index.ts', repoStr], {
          cwd: process.cwd(),
          env: { ...process.env },
        });
        activeChild = child;

        // Send SSE keepalive comments every 30s throughout the entire run
        // (CLI can take 30+ min for large repos; proxy kills idle connections after ~1 min)
        globalKeepalive = setInterval(() => {
          if (closed) { clearInterval(globalKeepalive); globalKeepalive = null; return; }
          try { controller.enqueue(enc.encode(': keepalive\n\n')); } catch { clearInterval(globalKeepalive); globalKeepalive = null; }
        }, 30000);

        let stdout = '';
        let lastStderrLine = '';
        // Buffer for incomplete stderr lines — large @@METRICS@@ payloads (e.g. 3000+ star
        // entries) span multiple data chunks; we must reassemble before parsing.
        let stderrBuf = '';

        child.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
          stderrBuf += chunk.toString();
          const lines = stderrBuf.split('\n');
          // Keep the last (potentially incomplete) segment in the buffer
          stderrBuf = lines.pop();
          for (const line of lines) {
            if (!line) continue;
            if (line.startsWith('@@METRICS@@')) {
              try {
                const payload = JSON.parse(line.slice('@@METRICS@@'.length));
                if (payload.type === 'ollama-prompt') {
                  ollamaPromptText = payload.data;
                } else {
                  send('metrics', payload);
                  if (payload.type === 'stats' && payload.data?.stars != null) {
                    capturedStars = payload.data.stars;
                  }
                }
              } catch {}
            } else {
              send('progress', line);
              lastStderrLine = line.trim();
            }
          }
        });

        child.on('error', (err) => {
          activeChild = null;
          send('error', err.message);
          closeController();
        });

        child.on('close', async (code) => {
          activeChild = null;
          if (code !== 0) {
            const msg = lastStderrLine.startsWith('Error:')
              ? lastStderrLine
              : `Process exited with code ${code}`;
            send('error', msg);
            closeController();
            return;
          }

          // Send prompt immediately — client shows it right away
          send('done', stdout);
          cache.set(repoStr, { events: recordedEvents, cachedAt: new Date() });
          if (maxDailyFetches != null && capturedStars != null && capturedStars > LARGE_REPO_STAR_THRESHOLD) {
            largeRepoCooldowns.set(repoStr, new Date());
          }

          // Run Ollama on the server side if enabled
          const ollamaEnabled = process.env.USE_OLLAMA === 'true'
            && !!process.env.OLLAMA_URL
            && !!process.env.OLLAMA_MODEL;

          if (ollamaEnabled) {
            send('ollama-pending', { model: process.env.OLLAMA_MODEL, prompt: ollamaPromptText });

            // Send SSE keepalive comments every 30s to prevent proxy idle-timeout
            // (Ollama can take 10-15 min on a slow VM)
            const keepalive = setInterval(() => {
              if (!closed) {
                try { controller.enqueue(enc.encode(': keepalive\n\n')); } catch { clearInterval(keepalive); }
              } else {
                clearInterval(keepalive);
              }
            }, 30000);

            const ollamaResult = await callOllama(ollamaPromptText ?? stdout.slice(0, 4000));
            clearInterval(keepalive);

            if (ollamaResult && !closed) {
              const ollamaPayload = { type: 'ollama', data: { response: ollamaResult, model: process.env.OLLAMA_MODEL } };
              send('metrics', ollamaPayload);
              // Also persist Ollama result in cache
              cache.set(repoStr, { events: [...recordedEvents, { event: 'metrics', data: ollamaPayload }], cachedAt: new Date() });
            }
          }

          closeController();
        });
      },
      cancel() {
        closed = true;
        if (child) {
          try { child.kill('SIGTERM'); } catch {}
          child = null;
          activeChild = null;
        }
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    },
  );
});

// Keep the old POST endpoint for backwards compatibility
app.post('/api/prompt', async (c) => {
  const { repo } = await c.req.json();
  if (!repo) return c.json({ error: 'Missing repo' }, 400);
  const repoStr = sanitizeRepo(repo);
  if (!repoStr) return c.json({ error: 'Invalid repo format. Use owner/repo' }, 400);

  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', 'src/index.ts', repoStr], {
      cwd: process.cwd(),
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code) => {
      if (code !== 0) return resolve(c.json({ error: stderr || `exit code ${code}` }, 500));
      resolve(c.json({ prompt: stdout }));
    });
    child.on('error', (err) => resolve(c.json({ error: err.message }, 500)));
  });
});

const port = process.env.PORT || 3000;
const hostname = '0.0.0.0';
serve({ fetch: app.fetch, port, hostname });
console.log(`Hono UI server running at http://${hostname}:${port}`);
