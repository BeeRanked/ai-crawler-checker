import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, ruleMatches, groupFor, verdict } from '../src/robots.js';
import { checkCrawlers } from '../src/check.js';
import { CATALOG } from '../src/catalog.js';

test('parseRobots groups agents and collects sitemaps', () => {
  const { groups, sitemaps } = parseRobots(`
    User-agent: GPTBot
    User-agent: CCBot
    Disallow: /

    User-agent: *
    Disallow: /private
    Allow: /private/public

    Sitemap: https://example.com/sitemap.xml
  `.replace(/^\s+/gm, ''));
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].agents, ['gptbot', 'ccbot']);
  assert.deepEqual(sitemaps, ['https://example.com/sitemap.xml']);
});

test('a rule line starts a new group when followed by user-agent', () => {
  const { groups } = parseRobots('User-agent: A\nDisallow: /\nUser-agent: B\nDisallow: /b');
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[1].agents, ['b']);
});

test('empty Disallow is not a restriction', () => {
  const { groups } = parseRobots('User-agent: *\nDisallow:');
  assert.equal(groups[0].rules.length, 0);
});

test('ruleMatches supports prefix, wildcard and end anchor', () => {
  assert.ok(ruleMatches('/admin', '/admin/settings'));
  assert.ok(ruleMatches('/*.pdf$', '/files/report.pdf'));
  assert.ok(!ruleMatches('/*.pdf$', '/files/report.pdf?x=1'));
  assert.ok(ruleMatches('/a/*/c', '/a/b/c'));
});

test('groupFor prefers a named group over the wildcard', () => {
  const { groups } = parseRobots('User-agent: *\nDisallow: /\nUser-agent: GPTBot\nAllow: /');
  const named = groupFor(groups, 'GPTBot');
  assert.equal(named.basis, 'named');
  assert.equal(verdict(named.group).access, 'allowed');
  const other = groupFor(groups, 'CCBot');
  assert.equal(other.basis, 'wildcard');
  assert.equal(verdict(other.group).access, 'blocked');
});

test('verdict: longest match wins, allow breaks ties', () => {
  // Root reachable (allow wins the tie), but a disallow rule exists, so the
  // overall access is partial rather than fully allowed.
  assert.equal(verdict({ rules: [{ type: 'disallow', path: '/' }, { type: 'allow', path: '/' }] }).access, 'partial');
  assert.equal(verdict({ rules: [{ type: 'disallow', path: '/blog' }] }, '/blog/post').access, 'blocked');
  assert.equal(verdict({ rules: [{ type: 'disallow', path: '/x' }] }, '/').access, 'partial');
  // Only allow rules present, nothing restricted anywhere.
  assert.equal(verdict({ rules: [{ type: 'allow', path: '/' }] }).access, 'allowed');
  assert.equal(verdict({ rules: [] }).access, 'allowed');
});

test('every catalog entry is well formed', () => {
  for (const b of CATALOG) {
    assert.ok(b.id && b.company && b.what, `${b.id} has core fields`);
    assert.ok(b.group === 'answer' || b.group === 'training', `${b.id} group valid`);
    assert.match(b.source, /^https:\/\//, `${b.id} has a source URL`);
  }
});

test('checkCrawlers with an injected fetch produces verdicts and findings', async () => {
  const robots = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n';
  const fakeFetch = async (u) => {
    const body = () => new Response(u.endsWith('/robots.txt') ? robots : '<!doctype html><html></html>', {
      status: u.endsWith('/robots.txt') ? 200 : 404,
      headers: { 'content-type': u.endsWith('/robots.txt') ? 'text/plain' : 'text/html' },
    });
    return body();
  };
  const report = await checkCrawlers('example.com', { fetch: fakeFetch });
  const gpt = report.bots.find((b) => b.id === 'GPTBot');
  assert.equal(gpt.access, 'blocked');
  const search = report.bots.find((b) => b.id === 'OAI-SearchBot');
  assert.equal(search.access, 'allowed');
  assert.ok(report.findings.some((f) => f.level === 'good'), 'has at least one positive finding');
  assert.equal(report.llms.found, false);
});

test('isSafeUrl-style rejection: private hosts throw', async () => {
  await assert.rejects(() => checkCrawlers('http://localhost:3000', { fetch: async () => new Response('') }));
  await assert.rejects(() => checkCrawlers('http://192.168.1.1', { fetch: async () => new Response('') }));
});
