# ai-crawler-checker

See which AI crawlers a website's `robots.txt` allows or blocks, and understand
the difference that actually matters: crawlers that decide whether you can be
**cited in AI answers** (ChatGPT search, Claude, Perplexity, Gemini grounding,
Siri) versus crawlers that **train models** on your content. Blocking the wrong
group quietly removes you from AI results while doing nothing you intended.

No browser, no API key, two small HTTP requests. Runs as a library, a CLI, or a
self-hosted HTTP endpoint.

## Why the two groups are separate

A lot of sites paste a big "block the AI bots" list into `robots.txt` to stay
out of model training, and accidentally block the crawlers that put them in AI
answers. Those are different bots from the same companies. This tool reads the
`robots.txt`, checks every documented crawler against it (following RFC 9309),
and tells you which group each verdict falls in, with a plain-language summary
of what it costs you.

Every crawler in the catalog is documented by the operator that runs it, and
each entry links to that operator's own page as its source.

## Install

```bash
npm install ai-crawler-checker
# or run it once without installing:
npx ai-crawler-checker example.com
```

Requires Node 18 or newer (uses the built-in `fetch`).

## CLI

```bash
ai-crawler-checker example.com
ai-crawler-checker https://example.com --json
```

## Library

```js
import { checkCrawlers } from 'ai-crawler-checker';

const report = await checkCrawlers('example.com');
console.log(report.summary);   // { answerVisible, answerTotal, trainingAllowed, trainingTotal }
console.log(report.findings);  // [{ level: 'bad' | 'warn' | 'good' | 'info', text }]
console.log(report.bots);      // per-crawler verdicts with sources
```

On Node versions without a global `fetch`, pass one:

```js
import { checkCrawlers } from 'ai-crawler-checker';
import { fetch } from 'undici';
await checkCrawlers('example.com', { fetch });
```

The robots.txt primitives are exported too, if you only want the parser:

```js
import { parseRobots, groupFor, verdict } from 'ai-crawler-checker/robots';
```

## Self-host as an HTTP endpoint

`worker.js` is a ready Cloudflare Worker:

```bash
npm install
cp wrangler.toml.example wrangler.toml
npx wrangler deploy
```

Current wrangler (v4) needs Node 22 or newer; on Node 18 or 20, deploy with
`npx wrangler@3 deploy` instead.

Then `POST /` with `{ "url": "https://example.com" }`, or `GET /?url=...`, and
you get the full JSON report. It runs comfortably on the Cloudflare Workers free
tier.

## The crawler catalog

The catalog (`src/catalog.js`) is meant to stay current as operators publish or
rename agents. A pull request that adds or updates a crawler should link to the
operator's own documentation as the source; entries that cannot be sourced are
not accepted, because the whole point is that the table is true.

## Hosted version

Prefer to paste a URL and get a visual report? There is a free hosted version at
[beeranked.online/ai-crawler-checker](https://beeranked.online/ai-crawler-checker),
from the team that maintains this project.

## License

MIT. See [LICENSE](LICENSE).
