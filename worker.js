// Optional Cloudflare Worker entry, so you can self-host the check as an HTTP
// endpoint on a free Cloudflare account:
//
//   POST /  { "url": "https://example.com" }  ->  the full JSON report
//   GET  /?url=https://example.com            ->  the same
//
// Deploy with `npx wrangler deploy` (see wrangler.toml.example).

import { checkCrawlers } from './src/check.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status,
  headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
});

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
    }
    let input = '';
    if (request.method === 'POST') {
      try { input = String((await request.json())?.url || ''); } catch { return json({ error: 'Send JSON { url }.' }, 400); }
    } else {
      input = new URL(request.url).searchParams.get('url') || '';
    }
    if (!input) return json({ error: 'Provide a url.' }, 400);
    try {
      return json(await checkCrawlers(input, { fetch }));
    } catch (e) {
      return json({ error: e && e.message ? e.message : 'Check failed.' }, 502);
    }
  },
};
