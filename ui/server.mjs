import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';

const app = new Hono();

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
  const cleaned = str.trim().replace(/^https:\/\/github.com\//, '').replace(/\/$/, '');
  if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(cleaned)) return null;
  return cleaned;
}

// Only one CLI process at a time to avoid GitHub rate-limit exhaustion
let activeChild = null;

// API endpoint — streams progress via SSE, then sends the final prompt
app.get('/api/prompt', async (c) => {
  const repo = c.req.query('repo');
  if (!repo) return c.json({ error: 'Missing repo' }, 400);
  const repoStr = sanitizeRepo(repo);
  if (!repoStr) return c.json({ error: 'Invalid repo format. Use owner/repo' }, 400);

  // Kill any in-flight CLI process before starting a new one
  if (activeChild) {
    try { activeChild.kill('SIGTERM'); } catch {}
    activeChild = null;
  }

  return new Response(
    new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        let closed = false;
        
        const send = (event, data) => {
          if (!closed) {
            controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          }
        };
        
        const closeController = () => {
          if (!closed) {
            closed = true;
            controller.close();
          }
        };

        const child = spawn('npx', ['tsx', 'src/index.ts', repoStr], {
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
          }
          closeController();
        });
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
