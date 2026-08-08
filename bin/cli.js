#!/usr/bin/env node
import { checkCrawlers } from '../src/check.js';

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = (s) => c('2', s);
const bold = (s) => c('1', s);
const LEVEL = { good: c('32', 'OK  '), warn: c('33', 'WARN'), bad: c('31', 'BAD '), info: c('36', 'INFO') };
const ACCESS = { allowed: c('32', 'allowed'), blocked: c('31', 'blocked'), partial: c('33', 'partial') };

function usage(code = 0) {
  process.stdout.write(`ai-crawler-checker , see which AI crawlers a site's robots.txt allows or blocks

Usage:
  ai-crawler-checker <url> [--json]

Options:
  --json      print the full report as JSON
  -h, --help  show this help
`);
  process.exit(code);
}

const args = process.argv.slice(2);
if (!args.length || args.includes('-h') || args.includes('--help')) usage(args.length ? 0 : 1);
const asJson = args.includes('--json');
const url = args.find((a) => !a.startsWith('-'));
if (!url) usage(1);

try {
  const report = await checkCrawlers(url);
  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    process.exit(0);
  }

  const { host, robots, summary, bots, findings } = report;
  process.stdout.write(`\n${bold(host)}  ${dim(robots.found ? 'robots.txt found' : 'no robots.txt (' + robots.state + ')')}\n\n`);
  process.stdout.write(`${bold('AI answers')}    ${summary.answerVisible}/${summary.answerTotal} crawlers can cite you\n`);
  process.stdout.write(`${bold('AI training')}   ${summary.trainingAllowed}/${summary.trainingTotal} crawlers allowed\n\n`);

  for (const group of ['answer', 'training']) {
    process.stdout.write(bold(group === 'answer' ? 'Answer crawlers\n' : 'Training crawlers\n'));
    for (const b of bots.filter((x) => x.group === group)) {
      const flag = b.ignoresRobots ? dim('  (may ignore robots.txt)') : '';
      process.stdout.write(`  ${ACCESS[b.access] || b.access}  ${b.id.padEnd(24)} ${dim(b.company)}${flag}\n`);
    }
    process.stdout.write('\n');
  }

  process.stdout.write(bold('Findings\n'));
  for (const f of findings) process.stdout.write(`  ${LEVEL[f.level] || f.level}  ${f.text}\n`);
  process.stdout.write('\n');
} catch (e) {
  process.stderr.write((e && e.message ? e.message : String(e)) + '\n');
  process.exit(1);
}
