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

// Serve static assets (if any)
app.get('/favicon.ico', (c) => c.body('', 204));

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

  // Kill any in-flight CLI process before starting a new one
  if (activeChild) {
    try { activeChild.kill('SIGTERM'); } catch {}
    activeChild = null;
  }

  let closed = false;
  let child = null;
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
        
        const closeController = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {}
        };

        child = spawn('npx', ['tsx', 'src/index.ts', repoStr], {
          cwd: process.cwd(),
          env: { ...process.env },
        });
        activeChild = child;

        let stdout = '';
        let lastStderrLine = '';

        child.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(Boolean);
          for (const line of lines) {
            if (line.startsWith('@@METRICS@@')) {
              try {
                const payload = JSON.parse(line.slice('@@METRICS@@'.length));
                send('metrics', payload);
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

        child.on('close', (code) => {
          activeChild = null;
          if (code !== 0) {
            // Use the last stderr line as error message if it looks like an error
            const msg = lastStderrLine.startsWith('Error:')
              ? lastStderrLine
              : `Process exited with code ${code}`;
            send('error', msg);
          } else {
            send('done', stdout);
            // Cache successful results until midnight UTC
            cache.set(repoStr, { events: recordedEvents, cachedAt: new Date() });
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
