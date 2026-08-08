// robots.txt parsing and matching, following RFC 9309.
//
// These functions are pure (string in, structured data out) so they are easy to
// test and reuse independently of any fetching.

/**
 * Parse robots.txt into groups and sitemaps.
 *
 * Consecutive user-agent lines share the rules that follow them. The first rule
 * line closes the header, so a user-agent line after a rule starts a new group.
 * Groups naming the same agent are merged elsewhere (see groupFor).
 */
export function parseRobots(txt) {
  const groups = [];
  const sitemaps = [];
  let cur = null;
  let inHeader = false;
  for (const raw of String(txt).split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const field = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (field === 'user-agent') {
      if (!inHeader) { cur = { agents: [], rules: [], crawlDelay: null }; groups.push(cur); inHeader = true; }
      if (value) cur.agents.push(value.toLowerCase());
    } else if (field === 'allow' || field === 'disallow') {
      if (!cur) continue; // a rule before any user-agent line belongs to nobody
      inHeader = false;
      if (field === 'disallow' && value === '') continue; // "Disallow:" with no path means no restriction
      cur.rules.push({ type: field, path: value });
    } else if (field === 'crawl-delay') {
      if (cur) { inHeader = false; cur.crawlDelay = value; }
    } else if (field === 'sitemap') {
      if (value) sitemaps.push(value);
    }
  }
  return { groups, sitemaps };
}

/** Does a robots.txt path pattern match `path`? Supports * (any run) and $ (end of path). */
export function ruleMatches(pattern, path) {
  if (!pattern) return false;
  if (!/[*$]/.test(pattern)) return path.startsWith(pattern);
  let re = '';
  for (const ch of pattern) {
    if (ch === '*') re += '.*';
    else if (ch === '$') re += '$';
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  try { return new RegExp('^' + re).test(path); } catch { return false; }
}

/** The group that applies to `token`: its own rules if the token is named, else the * group. */
export function groupFor(groups, token) {
  const t = String(token).toLowerCase();
  let own = null;
  let star = null;
  for (const g of groups) {
    if (g.agents.includes(t)) own = own ? { agents: own.agents, rules: own.rules.concat(g.rules), crawlDelay: own.crawlDelay ?? g.crawlDelay } : g;
    if (g.agents.includes('*')) star = star ? { agents: star.agents, rules: star.rules.concat(g.rules), crawlDelay: star.crawlDelay ?? g.crawlDelay } : g;
  }
  if (own) return { group: own, basis: 'named' };
  if (star) return { group: star, basis: 'wildcard' };
  return { group: null, basis: 'none' };
}

/**
 * Verdict for a group at a given path (default the site root). Longest matching
 * rule wins; on a tie the least restrictive rule (allow) wins, per RFC 9309.
 */
export function verdict(group, path = '/') {
  if (!group || !group.rules.length) return { access: 'allowed', rules: 0 };
  let best = null;
  for (const r of group.rules) {
    if (!ruleMatches(r.path, path)) continue;
    const len = r.path.length;
    if (!best || len > best.len || (len === best.len && r.type === 'allow')) best = { type: r.type, len };
  }
  if (best && best.type === 'disallow') return { access: 'blocked', rules: group.rules.length };
  const restricted = group.rules.some((r) => r.type === 'disallow');
  return { access: restricted ? 'partial' : 'allowed', rules: group.rules.length };
}
