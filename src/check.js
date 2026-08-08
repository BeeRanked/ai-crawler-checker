// The check orchestrator: fetch a site's robots.txt (and probe for llms.txt),
// then report, per documented AI crawler, whether it is allowed, blocked or
// partly blocked, split into crawlers that affect AI answers and crawlers that
// affect model training.
//
// Runtime-agnostic: pass any fetch-compatible function (Node 18+ global fetch,
// undici, a Cloudflare Worker's fetch). No HTML parsing, two small GETs.

import { CATALOG } from './catalog.js';
import { parseRobots, groupFor, verdict } from './robots.js';

export const USER_AGENT = 'ai-crawler-checker (+https://github.com/BeeRanked/ai-crawler-checker)';

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

export function isSafeUrl(u) {
  try {
    const url = new URL(u);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const h = url.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    return true;
  } catch { return false; }
}

/** A 200 that is really a site's HTML shell (a soft 404). Many SPA hosts answer
 *  200 + homepage for /robots.txt and /llms.txt; reporting that as a real file
 *  would be false. */
const looksHtml = (contentType, text) =>
  /text\/html/i.test(contentType || '') || /^\s*(<!doctype|<html|<head)/i.test(text || '');

async function readCapped(res, max, deadlineMs = 6000) {
  const reader = res.body.getReader();
  const dec = new TextDecoder('utf-8', { fatal: false });
  let out = '';
  let total = 0;
  let truncated = false;
  const start = Date.now();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      out += dec.decode(value, { stream: true });
      if (total >= max || Date.now() - start > deadlineMs) { truncated = true; try { await reader.cancel(); } catch {} break; }
    }
    out += dec.decode();
  } catch { /* tolerate read errors, report what we got */ }
  return { text: out, bytes: total, truncated };
}

/**
 * Run the check.
 * @param {string} input a site URL or bare host.
 * @param {object} [opts]
 * @param {typeof fetch} [opts.fetch] fetch implementation (defaults to global fetch).
 * @param {number} [opts.timeoutMs] per-request timeout (default 12000).
 * @returns {Promise<object>} the full report.
 */
export async function checkCrawlers(input, opts = {}) {
  const doFetch = opts.fetch || globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? 12000;
  if (typeof doFetch !== 'function') throw new Error('No fetch implementation available; pass opts.fetch on Node < 18.');

  let url = String(input || '').trim();
  if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
  if (!isSafeUrl(url)) throw new Error('Enter a valid public website URL.');

  const origin = new URL(url).origin;
  const robotsUrl = origin + '/robots.txt';
  const llmsUrl = origin + '/llms.txt';

  const get = (u, accept) => doFetch(u, { headers: { 'user-agent': USER_AGENT, accept }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });

  // robots.txt
  let res;
  try {
    res = await get(robotsUrl, 'text/plain,*/*');
  } catch {
    throw new Error('That site took too long or refused the request; it may be slow or blocking automated visits.');
  }

  const robots = { url: robotsUrl, status: res.status, found: false, bytes: 0, truncated: false, sitemaps: [], state: 'missing' };
  let parsed = { groups: [], sitemaps: [] };
  if (res.status >= 500) {
    robots.state = 'servererror';
    try { await res.body?.cancel(); } catch {}
  } else if (res.ok) {
    // Google reads at most 500 KiB of a robots.txt; match that.
    const { text, bytes, truncated } = await readCapped(res, 512_000);
    if (looksHtml(res.headers.get('content-type'), text)) {
      robots.state = 'soft404';
    } else {
      parsed = parseRobots(text);
      robots.found = true;
      robots.state = 'ok';
      robots.bytes = bytes;
      robots.truncated = truncated;
      robots.sitemaps = parsed.sitemaps.slice(0, 10);
    }
  } else {
    try { await res.body?.cancel(); } catch {}
  }

  // llms.txt (a 200 that is really the HTML shell does not count)
  const llms = { url: llmsUrl, found: false, status: 0 };
  try {
    const lr = await get(llmsUrl, 'text/plain,*/*');
    llms.status = lr.status;
    if (lr.ok) {
      const { text } = await readCapped(lr, 64_000);
      llms.found = !looksHtml(lr.headers.get('content-type'), text) && text.trim().length > 0;
    } else {
      try { await lr.body?.cancel(); } catch {}
    }
  } catch { /* no llms.txt is not an error */ }

  const bots = CATALOG.map((b) => {
    const { group, basis } = groupFor(parsed.groups, b.id);
    const v = robots.found ? verdict(group) : { access: 'allowed', rules: 0 };
    return {
      id: b.id, company: b.company, group: b.group, what: b.what, note: b.note || null,
      source: b.source, ignoresRobots: !!b.ignoresRobots,
      access: v.access,
      basis: robots.found ? basis : 'none',
      crawlDelay: (group && group.crawlDelay) || null,
    };
  });

  const answer = bots.filter((b) => b.group === 'answer');
  const training = bots.filter((b) => b.group === 'training');
  const blockedAnswer = answer.filter((b) => b.access === 'blocked');
  const allowedTraining = training.filter((b) => b.access !== 'blocked');
  const summary = {
    answerTotal: answer.length, answerVisible: answer.length - blockedAnswer.length,
    trainingTotal: training.length, trainingAllowed: allowedTraining.length,
  };

  const findings = buildFindings({ robots, llms, bots, answer, training, blockedAnswer, allowedTraining });

  return {
    url, host: hostOf(url), origin,
    robots, llms, bots, summary, findings,
    checkedAt: new Date().toISOString(),
  };
}

// Plain-language findings, worst first. This is the part people read and share.
function buildFindings({ robots, llms, bots, answer, training, blockedAnswer, allowedTraining }) {
  const findings = [];
  const by = (id) => bots.find((b) => b.id === id);
  const push = (level, text) => findings.push({ level, text });

  if (robots.state === 'servererror') {
    push('bad', `The robots.txt returns HTTP ${robots.status}. A server error there is not the same as "no rules": crawlers are allowed to treat a 5xx robots.txt as disallow-all, so this can quietly hide your whole site.`);
  } else if (robots.state === 'soft404') {
    push('warn', 'The site answers /robots.txt with an HTML page instead of a text file, so it has no working robots.txt. Everything below is allowed by default, and none of it can be controlled until a real robots.txt exists.');
  } else if (!robots.found) {
    push('warn', 'No robots.txt found, so every crawler below is allowed by default. That is a valid choice, but it is a default rather than a decision.');
  }

  if (blockedAnswer.length) {
    const names = blockedAnswer.map((b) => b.id).join(', ');
    push('bad', `You are blocking ${blockedAnswer.length} of ${answer.length} crawlers that decide whether you appear in AI answers: ${names}. These are how those assistants find and cite you, so blocking them takes you out of their results. If the goal was to stay out of model training, these are not the crawlers that control it.`);
  } else if (robots.found) {
    push('good', 'Every crawler that can cite you in AI answers is allowed. That is the setting that keeps you findable.');
  }

  const gpt = by('GPTBot'), oaiSearch = by('OAI-SearchBot');
  if (gpt.access === 'blocked' && oaiSearch.access === 'blocked') {
    push('warn', 'You block GPTBot and OAI-SearchBot together. GPTBot alone stops training; OAI-SearchBot is what puts you in ChatGPT search. Blocking both trades away visibility you probably wanted to keep.');
  } else if (gpt.access === 'blocked' && oaiSearch.access !== 'blocked') {
    push('good', 'You block GPTBot (training) but allow OAI-SearchBot (ChatGPT search). That is the split most publishers aim for.');
  }

  const ge = by('Google-Extended');
  if (ge.access === 'blocked') {
    push('good', 'You block Google-Extended, so your content is kept out of Gemini training. Worth knowing: Google states this does not affect your inclusion or ranking in Google Search.');
  }

  const ax = by('Applebot'), axe = by('Applebot-Extended');
  if (axe.access === 'blocked' && ax.access === 'blocked') {
    push('warn', 'You block both Applebot and Applebot-Extended. Applebot-Extended alone opts you out of Apple model training; blocking Applebot as well removes you from Siri and Spotlight Suggestions.');
  }

  if (robots.found && allowedTraining.length === training.length) {
    push('warn', `All ${training.length} AI training crawlers are allowed. Nothing is wrong with that, but it is worth being a decision rather than a default.`);
  } else if (robots.found && allowedTraining.length === 0) {
    push('good', `All ${training.length} AI training crawlers are blocked.`);
  }

  const ignoring = bots.filter((b) => b.ignoresRobots && b.access === 'blocked');
  if (ignoring.length) {
    push('warn', `${ignoring.map((b) => b.id).join(' and ')} ${ignoring.length > 1 ? 'are' : 'is'} blocked in your robots.txt, but ${ignoring.length > 1 ? 'their operators state they' : 'its operator states it'} may fetch pages anyway when a user asks about your site directly.`);
  }

  push(llms.found ? 'good' : 'info', llms.found
    ? 'This site publishes an llms.txt, a plain-text map of content for AI clients.'
    : 'No llms.txt. It is an emerging convention rather than a standard, and no major AI company has committed to reading it, so its absence costs nothing today.');

  if (robots.found && !robots.sitemaps.length) {
    push('info', 'Your robots.txt does not advertise a sitemap. Adding a Sitemap: line is one line of work and helps every crawler, AI or not.');
  }

  return findings;
}
