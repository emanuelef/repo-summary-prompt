import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { exec } from 'child_process';
import { readFile } from 'fs/promises';

const app = new Hono();

// Serve static index.html at root
app.get('/', async (c) => {
  const html = await readFile(new URL('./index.html', import.meta.url));
  return c.html(html.toString());
});

// Serve static assets (if any)
app.get('/favicon.ico', (c) => c.body('', 204));

// API endpoint
app.post('/api/prompt', async (c) => {
  const { repo } = await c.req.json();
  if (!repo) return c.json({ error: 'Missing repo' }, 400);
  let repoStr = repo.trim().replace(/^https:\/\/github.com\//, '').replace(/\/$/, '');
  if (!repoStr.includes('/')) return c.json({ error: 'Invalid repo format' }, 400);

  return new Promise((resolve) => {
    exec(`npx tsx src/index.ts ${repoStr}`, { cwd: process.cwd(), maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return resolve(c.json({ error: stderr || err.message }, 500));
      resolve(c.json({ prompt: stdout }));
    });
  });
});

const port = process.env.PORT || 3000;
serve({ fetch: app.fetch, port });
console.log(`Hono UI server running at http://localhost:${port}`);
