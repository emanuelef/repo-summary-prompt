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

// Serve static assets (if any)
app.get('/favicon.ico', (c) => c.body('', 204));

// API endpoint — streams progress via SSE, then sends the final prompt
app.get('/api/prompt', async (c) => {
  const repo = c.req.query('repo');
  if (!repo) return c.json({ error: 'Missing repo' }, 400);
  let repoStr = repo.trim().replace(/^https:\/\/github.com\//, '').replace(/\/$/, '');
  if (!repoStr.includes('/')) return c.json({ error: 'Invalid repo format' }, 400);

  return new Response(
    new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        const send = (event, data) => {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        const child = spawn('npx', ['tsx', 'src/index.ts', repoStr], {
          cwd: process.cwd(),
          env: { ...process.env },
        });

        let stdout = '';

        child.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(Boolean);
          for (const line of lines) {
            send('progress', line);
          }
        });

        child.on('error', (err) => {
          send('error', err.message);
          controller.close();
        });

        child.on('close', (code) => {
          if (code !== 0) {
            send('error', `Process exited with code ${code}`);
          } else {
            send('done', stdout);
          }
          controller.close();
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
  let repoStr = repo.trim().replace(/^https:\/\/github.com\//, '').replace(/\/$/, '');
  if (!repoStr.includes('/')) return c.json({ error: 'Invalid repo format' }, 400);

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
serve({ fetch: app.fetch, port });
console.log(`Hono UI server running at http://localhost:${port}`);
