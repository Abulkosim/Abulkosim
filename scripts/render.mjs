#!/usr/bin/env node
// Renders the profile cards from live GitHub data. No dependencies.
// Usage: GITHUB_TOKEN=... node scripts/render.mjs [outDir]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const USER = 'Abulkosim';
const OUT = process.argv[2] ?? 'out';
const TOKEN = process.env.GITHUB_TOKEN;
const NOW = process.env.RENDER_NOW ? new Date(process.env.RENDER_NOW) : new Date();
const W = 840;

const APPS = [
  { repo: 'margin', name: 'Margin', tagline: 'Claude Code and Codex usage limits, across accounts', accent: ['#6c886f', '#b8d1ba'] },
  { repo: 'wick', name: 'Wick', tagline: 'Keeps your computer awake, for a time or while an app runs', accent: ['#b8873a', '#f0d39b'] },
  { repo: 'weir', name: 'Weir', tagline: 'Internet speed and connection checks from the menu bar', accent: ['#2f7fbf', '#7ab4e4'] },
  { repo: 'tonearm', name: 'Tonearm', tagline: 'A mini player for the Spotify desktop app, in the menu bar', accent: ['#c8692a', '#f0954f'] },
];

// typeprose has no releases. Its card shows the app itself: a passage from its
// own corpus, a new one each day, mid-run.
const TYPEPROSE = {
  repo: 'typeprose',
  name: 'typeprose',
  tagline: 'Typing practice on real prose from public-domain books',
  stage: {
    light: { bg: '#e9e2d0', typed: '#2a2620', pending: '#857c6b', caret: '#a9761a', error: '#9a2e2e' },
    dark: { bg: '#12100e', typed: '#e6e0d2', pending: '#6e675c', caret: '#c99a3c', error: '#b04a4a' },
  },
};

const INSTALLER = /\.(dmg|exe|msi|deb|rpm|AppImage)$/;
const PLATFORM = [
  [/\.dmg$/, 'macOS'],
  [/\.(exe|msi)$/, 'Windows'],
  [/\.(deb|rpm|AppImage)$/, 'Linux'],
];

const THEMES = {
  light: {
    card: '#ffffff', line: '#d0d7de', ink: '#1f2328', secondary: '#59636e', tertiary: '#818b98',
    track: '#f0f2f0',
  },
  dark: {
    card: '#0d1117', line: '#3d444d', ink: '#f0f6fc', secondary: '#9198a1', tertiary: '#656c76',
    track: '#161b1a',
  },
};

// --- data ---------------------------------------------------------------

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function graphql(query) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`graphql: ${res.status} ${JSON.stringify(json.errors ?? json)}`);
  return json.data;
}

async function count(path) {
  const res = await fetch(`https://api.github.com${path}${path.includes('?') ? '&' : '?'}per_page=1`, {
    headers: { accept: 'application/vnd.github+json', ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  const last = res.headers.get('link')?.match(/[?&]page=(\d+)>; rel="last"/);
  return last ? Number(last[1]) : (await res.json()).length;
}

// Just enough YAML for corpus/passages.yaml: one `- author:` block per
// passage, with author_name, title and a folded `text: >` block.
function parsePassages(yaml) {
  return yaml
    .split(/^- (?=author:)/m)
    .slice(1)
    .map((block) => {
      const field = (k) => block.match(new RegExp(`^\\s*${k}:\\s*'?(.*?)'?\\s*$`, 'm'))?.[1];
      const text = block.match(/^\s*text:\s*>-?\n((?:[ \t]+.*\n?)+)/m)?.[1];
      return { author: field('author_name'), title: field('title'), text: text?.split('\n').map((l) => l.trim()).filter(Boolean).join(' ') };
    })
    .filter((p) => p.author && p.title && p.text);
}

async function loadTypeprose() {
  const [info, commits, file] = await Promise.all([
    gh(`/repos/${USER}/${TYPEPROSE.repo}`),
    count(`/repos/${USER}/${TYPEPROSE.repo}/commits`),
    gh(`/repos/${USER}/${TYPEPROSE.repo}/contents/corpus/passages.yaml`),
  ]);
  const passages = parsePassages(Buffer.from(file.content, 'base64').toString('utf8'));
  // A first sentence short enough for two lines on the card.
  const short = passages
    .map((p) => ({ ...p, line: p.text.match(/^.+?[.!?](?:[’”"])?(?=\s|$)/)?.[0] ?? p.text }))
    .filter((p) => p.line.length >= 60 && p.line.length <= 150);
  const today = Math.floor(NOW.getTime() / 86400e3);
  return {
    ...TYPEPROSE,
    stars: info.stargazers_count,
    commits,
    passages: passages.length,
    pushed: new Date(info.pushed_at),
    passage: short[today % short.length],
  };
}

async function releases(repo) {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await gh(`/repos/${USER}/${repo}/releases?per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.filter((r) => !r.draft && r.published_at);
}

async function load() {
  const apps = await Promise.all(
    APPS.map(async (app) => {
      const [info, rels] = await Promise.all([gh(`/repos/${USER}/${app.repo}`), releases(app.repo)]);
      const stable = rels.filter((r) => !r.prerelease);
      const latest = stable[0] ?? rels[0];
      const installers = rels.flatMap((r) => r.assets).filter((a) => INSTALLER.test(a.name));
      const platforms = PLATFORM.filter(([re]) => latest?.assets.some((a) => re.test(a.name))).map(([, p]) => p);
      return {
        ...app,
        stars: info.stargazers_count,
        forks: info.forks_count,
        version: latest?.tag_name ?? '—',
        released: latest ? new Date(latest.published_at) : null,
        downloads: installers.reduce((n, a) => n + a.download_count, 0),
        platforms,
        releases: rels.map((r) => ({ repo: app.repo, name: app.name, tag: r.tag_name, at: new Date(r.published_at) })),
      };
    }),
  );
  const [merged, graph, typeprose] = await Promise.all([
    gh(`/search/issues?q=${encodeURIComponent(`author:${USER} is:pr is:merged is:public`)}&per_page=1`),
    graphql(`query { user(login: "${USER}") { contributionsCollection { contributionCalendar { totalContributions } } } }`),
    loadTypeprose(),
  ]);
  return {
    apps,
    typeprose,
    mergedPrs: merged.total_count,
    contributions: graph.user.contributionsCollection.contributionCalendar.totalContributions,
  };
}

// --- svg helpers --------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const num = (n) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : n.toLocaleString('en-US'));
const SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`;

function ago(date) {
  const s = (NOW - date) / 1000;
  const units = [[86400 * 30, 'mo'], [86400 * 7, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']];
  for (const [size, unit] of units) if (s >= size) return `${Math.floor(s / size)}${unit} ago`;
  return 'just now';
}

const day = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function svg(width, height, body, t, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>
  text { font-family: ${SANS}; fill: ${t.ink}; }
  .mono { font-family: ${MONO}; font-variant-numeric: tabular-nums; }
  .s { fill: ${t.secondary}; }
  .t { fill: ${t.tertiary}; }
  .grow { transform-box: fill-box; transform-origin: bottom; transform: scaleY(0); animation: grow .5s cubic-bezier(.2,.7,.2,1) forwards; }
  @keyframes grow { to { transform: scaleY(1); } }
  @media (prefers-reduced-motion: reduce) { .grow { animation: none; transform: none; } }
</style>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${t.card}" stroke="${t.line}"/>
${body}
</svg>
`;
}

// --- cards --------------------------------------------------------------

function statsCard(data, t) {
  const downloads = data.apps.reduce((n, a) => n + a.downloads, 0);
  const shipped = data.apps.reduce((n, a) => n + a.releases.length, 0);
  const cells = [
    [num(downloads), 'installer downloads'],
    [num(shipped), 'releases shipped'],
    [num(data.contributions), 'contributions, past year'],
    [num(data.mergedPrs), 'public PRs merged'],
  ];
  const cw = W / cells.length;
  const body = cells
    .map(([value, label], i) => {
      const x = cw * i + 28;
      const sep = i ? `<line x1="${cw * i}" y1="24" x2="${cw * i}" y2="72" stroke="${t.line}"/>` : '';
      return `${sep}<text x="${x}" y="52" class="mono" font-size="26" font-weight="500">${esc(value)}</text>
<text x="${x}" y="72" class="s" font-size="13">${esc(label)}</text>`;
    })
    .join('\n');
  return svg(W, 96, body, t,
    `${num(downloads)} installer downloads, ${shipped} releases, ${data.contributions} contributions in the last year, ${data.mergedPrs} public pull requests merged`);
}

function appCard(app, icon, t) {
  const H = 112;
  const nameW = app.name.length * 11;
  const meta = [app.platforms.join(' · '), app.released && `released ${ago(app.released)}`].filter(Boolean).join('   ·   ');
  const stats = [
    [num(app.downloads), 'downloads'],
    [num(app.stars), app.stars === 1 ? 'star' : 'stars'],
  ];
  const statsSvg = stats
    .map(([v, l], i) => {
      const x = W - 28 - (stats.length - 1 - i) * 104;
      return `<text x="${x}" y="52" class="mono" font-size="20" font-weight="500" text-anchor="end">${esc(v)}</text>
<text x="${x}" y="72" class="t" font-size="12" text-anchor="end">${esc(l)}</text>`;
    })
    .join('\n');
  const body = `<image x="24" y="24" width="64" height="64" href="data:image/png;base64,${icon}"/>
<text x="108" y="48" font-size="20" font-weight="500">${esc(app.name)}</text>
<text x="${108 + nameW + 8}" y="48" class="mono t" font-size="13">${esc(app.version)}</text>
<text x="108" y="72" class="s" font-size="14">${esc(app.tagline)}</text>
<text x="108" y="92" class="t" font-size="12">${esc(meta)}</text>
${statsSvg}`;
  return svg(W, H, body, t, `${app.name} ${app.version}: ${app.tagline}. ${app.downloads} downloads, ${app.stars} stars.`);
}

function wrap(text, width) {
  const lines = [''];
  for (const word of text.split(' ')) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
    if (next.length > width && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] = next;
  }
  return lines;
}

function typeproseCard(tp, icon, t, mode) {
  const c = tp.stage[mode];
  const p = tp.passage;
  const CH = 9; // every glyph is forced to this advance with textLength
  const stageX = 24, stageY = 112, stageW = W - 48, padX = 24;
  const cols = Math.floor((stageW - padX * 2) / CH);
  const lines = wrap(p.line, cols).slice(0, 2);
  const stageH = 40 + lines.length * 28 + 24;
  const H = stageY + stageH + 24;

  // Mid-run: about 40% typed, one missed key a few letters back.
  const total = lines.reduce((n, l) => n + l.length, 0);
  let caret = Math.round(total * 0.4);
  while (caret < total && lines.join(' ')[caret - 1] === ' ') caret++;
  let miss = caret - 5;
  while (miss > 0 && !/[a-z]/i.test(lines.join(' ')[miss])) miss--;

  let offset = 0;
  const text = lines
    .map((line, li) => {
      const y = stageY + 44 + li * 28;
      const x = stageX + padX;
      const spans = [...line].map((ch, i) => {
        const k = offset + i;
        const fill = k === miss ? c.error : k < caret ? c.typed : c.pending;
        return `<tspan style="fill:${fill}">${esc(ch)}</tspan>`;
      });
      let extra = '';
      if (miss >= offset && miss < offset + line.length) {
        extra += `<rect x="${x + (miss - offset) * CH}" y="${y + 4}" width="${CH}" height="2" fill="${c.error}"/>`;
      }
      if (caret >= offset && caret <= offset + line.length) {
        extra += `<rect x="${x + (caret - offset) * CH - 1}" y="${y - 16}" width="2" height="22" rx="1" fill="${c.caret}"/>`;
      }
      offset += line.length + 1;
      return `<text x="${x}" y="${y}" class="mono" font-size="15" textLength="${line.length * CH}" lengthAdjust="spacing">${spans.join('')}</text>${extra}`;
    })
    .join('\n');

  const nameW = tp.name.length * 10;
  const stats = [
    [num(tp.passages), 'passages'],
    [num(tp.commits), 'commits'],
  ]
    .map(([v, l], i) => {
      const x = W - 28 - (1 - i) * 104;
      return `<text x="${x}" y="52" class="mono" font-size="20" font-weight="500" text-anchor="end">${esc(v)}</text>
<text x="${x}" y="72" class="t" font-size="12" text-anchor="end">${esc(l)}</text>`;
    })
    .join('\n');

  const body = `<image x="30" y="30" width="52" height="52" href="data:image/png;base64,${icon}"/>
<text x="108" y="48" font-size="20" font-weight="500">${esc(tp.name)}</text>
<text x="${108 + nameW + 8}" y="48" class="mono t" font-size="13">web</text>
<text x="108" y="72" class="s" font-size="14">${esc(tp.tagline)}</text>
<text x="108" y="92" class="t" font-size="12">React, Fastify and Postgres   ·   last commit ${esc(ago(tp.pushed))}</text>
${stats}
<rect x="${stageX}" y="${stageY}" width="${stageW}" height="${stageH}" rx="8" fill="${c.bg}"/>
${text}
<text x="${stageX + padX}" y="${stageY + stageH - 20}" font-size="12" style="fill:${c.pending}">${esc(p.author)}, ${esc(p.title)}</text>
<text x="${stageX + stageW - padX}" y="${stageY + stageH - 20}" font-size="12" style="fill:${c.pending}" text-anchor="end">today’s passage</text>`;
  return svg(W, H, body, t, `typeprose: ${tp.tagline}. Today's passage: “${p.line}” ${p.author}, ${p.title}.`);
}

function cadenceCard(data, t, mode) {
  const H = 244;
  const DAY = 86400e3;
  const all = data.apps.flatMap((a) => a.releases).sort((a, b) => b.at - a.at);
  const first = all.at(-1)?.at ?? NOW;
  // Daily bars while the history is short, weekly once it isn't.
  const spanDays = Math.ceil((NOW - first) / DAY) + 1;
  const daily = spanDays <= 60;
  const unit = daily ? DAY : 7 * DAY;
  const count = daily ? Math.max(28, spanDays) : Math.min(52, Math.ceil(spanDays / 7));
  const end = Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate()) + DAY;
  const start = end - count * unit;
  const buckets = Array.from({ length: count }, () => Object.fromEntries(data.apps.map((a) => [a.repo, 0])));
  for (const r of all) {
    const i = Math.floor((r.at.getTime() - start) / unit);
    if (i >= 0 && i < count) buckets[i][r.repo]++;
  }
  const max = Math.max(1, ...buckets.map((b) => Object.values(b).reduce((x, y) => x + y, 0)));
  const chartX = 28, chartY = 58, chartW = 440, chartH = 120;
  const step = chartW / count;
  const gap = Math.min(4, step * 0.3);
  const color = Object.fromEntries(data.apps.map((a) => [a.repo, a.accent[mode === 'dark' ? 1 : 0]]));

  let bars = '';
  buckets.forEach((b, i) => {
    let y = chartY + chartH;
    const x = (chartX + i * step + gap / 2).toFixed(2);
    const w = (step - gap).toFixed(2);
    bars += `<rect x="${x}" y="${chartY}" width="${w}" height="${chartH}" rx="1.5" fill="${t.track}"/>`;
    for (const app of data.apps) {
      const n = b[app.repo];
      if (!n) continue;
      const h = (n / max) * chartH;
      y -= h;
      bars += `<rect class="grow" style="animation-delay:${i * 8}ms" x="${x}" y="${y.toFixed(2)}" width="${w}" height="${h.toFixed(2)}" rx="1.5" fill="${color[app.repo]}"/>`;
    }
  });

  const shown = all.filter((r) => r.at.getTime() >= start).length;
  const summary = shown === all.length ? `${all.length} releases since ${day(first)}` : `${shown} releases in ${count} ${daily ? 'days' : 'weeks'}`;
  let lx = chartX;
  const legend = data.apps
    .map((a) => {
      const g = `<circle cx="${lx + 4}" cy="${chartY + chartH + 44}" r="4" fill="${color[a.repo]}"/>
<text x="${lx + 14}" y="${chartY + chartH + 48}" class="s" font-size="12">${esc(a.name)}</text>`;
      lx += 14 + a.name.length * 7.5 + 18;
      return g;
    })
    .join('\n');

  const listX = 512;
  const rows = all
    .slice(0, 6)
    .map((r, i) => {
      const y = 72 + i * 24;
      return `<circle cx="${listX + 4}" cy="${y - 4}" r="4" fill="${color[r.repo]}"/>
<text x="${listX + 16}" y="${y}" font-size="13" font-weight="500">${esc(r.name)}</text>
<text x="${listX + 84}" y="${y}" class="mono s" font-size="12">${esc(r.tag)}</text>
<text x="${W - 28}" y="${y}" class="mono t" font-size="12" text-anchor="end">${esc(day(r.at))}</text>`;
    })
    .join('\n');

  const body = `<text x="28" y="34" font-size="14" font-weight="500">Release cadence</text>
<text x="${chartX + chartW}" y="34" class="s" font-size="12" text-anchor="end">${esc(summary)}</text>
${bars}
${legend}
<text x="${chartX}" y="${chartY + chartH + 18}" class="t" font-size="11">${esc(day(new Date(start)))}</text>
<text x="${chartX + chartW}" y="${chartY + chartH + 18}" class="t" font-size="11" text-anchor="end">today</text>
<line x1="${listX - 20}" y1="24" x2="${listX - 20}" y2="${H - 24}" stroke="${t.line}"/>
<text x="${listX}" y="34" font-size="14" font-weight="500">Latest releases</text>
${rows}
<text x="${W - 28}" y="${H - 18}" class="t" font-size="11" text-anchor="end">updated ${esc(NOW.toISOString().slice(0, 16).replace('T', ' '))} UTC</text>`;
  return svg(W, H, body, t, `${summary}. Latest: ${all.slice(0, 3).map((r) => `${r.name} ${r.tag}`).join(', ')}.`);
}

// --- main ---------------------------------------------------------------

const data = await load();
const icons = Object.fromEntries(
  await Promise.all([...APPS, TYPEPROSE].map(async (a) => [a.repo, (await readFile(new URL(`../assets/${a.repo}.png`, import.meta.url))).toString('base64')])),
);
await mkdir(OUT, { recursive: true });
for (const [mode, t] of Object.entries(THEMES)) {
  await writeFile(join(OUT, `stats-${mode}.svg`), statsCard(data, t));
  await writeFile(join(OUT, `cadence-${mode}.svg`), cadenceCard(data, t, mode));
  await writeFile(join(OUT, `typeprose-${mode}.svg`), typeproseCard(data.typeprose, icons.typeprose, t, mode));
  for (const app of data.apps) await writeFile(join(OUT, `${app.repo}-${mode}.svg`), appCard(app, icons[app.repo], t));
}
await writeFile(join(OUT, 'data.json'), JSON.stringify({ generated: NOW, ...data, apps: data.apps.map(({ releases, ...a }) => ({ ...a, releases: releases.length })) }, null, 2) + '\n');
console.log(`rendered ${OUT}: ${data.apps.map((a) => `${a.repo} ${a.version} ${a.downloads}dl`).join(', ')}; ${data.mergedPrs} merged PRs`);
