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
  { repo: 'margin', name: 'Margin', tagline: 'Claude Code and Codex usage limits, across accounts' },
  { repo: 'wick', name: 'Wick', tagline: 'Keeps your computer awake, for a time or while an app runs' },
  { repo: 'weir', name: 'Weir', tagline: 'Internet speed and connection checks from the menu bar' },
  { repo: 'tonearm', name: 'Tonearm', tagline: 'A mini player for the Spotify desktop app, in the menu bar' },
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

// Earthrise has no releases either. Its card shows a screenshot of the app.
const EARTHRISE = {
  repo: 'earthrise',
  name: 'Earthrise',
  tagline: 'Sunlight, Earth contact and power at the Moon’s south pole',
  stack: 'Team project   ·   NASA Space Apps 2026, global round next   ·   TypeScript, WebGL 2 and Python',
  // Shown as a badge on the screenshot.
  award: ['1st place', 'NASA Space Apps 2026 · Uzbekistan'],
};

const INSTALLER = /\.(dmg|exe|msi|deb|rpm|AppImage)$/;
const PLATFORM = [
  [/\.dmg$/, 'macOS'],
  [/\.(exe|msi)$/, 'Windows'],
  [/\.(deb|rpm|AppImage)$/, 'Linux'],
];

const THEMES = {
  light: {
    card: '#ffffff', line: '#d1d9e0', rule: '#eaeef2', ink: '#1f2328', secondary: '#59636e', tertiary: '#818b98',
    bar: '#59636e',
  },
  dark: {
    card: '#0d1117', line: '#3d444d', rule: '#21262d', ink: '#f0f6fc', secondary: '#9198a1', tertiary: '#656c76',
    bar: '#9198a1',
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

async function loadEarthrise() {
  const [info, commits] = await Promise.all([
    gh(`/repos/${USER}/${EARTHRISE.repo}`),
    count(`/repos/${USER}/${EARTHRISE.repo}/commits`),
  ]);
  return { ...EARTHRISE, stars: info.stargazers_count, commits, pushed: new Date(info.pushed_at) };
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
  const [merged, graph, typeprose, earthrise] = await Promise.all([
    gh(`/search/issues?q=${encodeURIComponent(`author:${USER} is:pr is:merged is:public`)}&per_page=1`),
    graphql(`query { user(login: "${USER}") { contributionsCollection { contributionCalendar { totalContributions } } } }`),
    loadTypeprose(),
    loadEarthrise(),
  ]);
  return {
    apps,
    typeprose,
    earthrise,
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

function svg(width, height, body, t, title, frame = true) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>
  text { font-family: ${SANS}; fill: ${t.ink}; }
  .mono { font-family: ${MONO}; font-variant-numeric: tabular-nums; }
  .s { fill: ${t.secondary}; }
  .t { fill: ${t.tertiary}; }
</style>
${frame ? `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${t.card}" stroke="${t.line}"/>` : ''}
${body}
</svg>
`;
}

// --- cards --------------------------------------------------------------
//
// Three text sizes (16 names, 14 body and figures, 12 meta), weights 400 and
// 500, one sans and one mono. Color comes only from the content: the app
// icons, the typeprose passage and the Earthrise screenshot.

const dot = '   ·   ';
const fig = (v) => `<tspan class="mono">${esc(v)}</tspan>`;

// One quiet line of totals, no frame.
function statsCard(data, t) {
  const downloads = data.apps.reduce((n, a) => n + a.downloads, 0);
  const shipped = data.apps.reduce((n, a) => n + a.releases.length, 0);
  const parts = [
    [num(downloads), 'installer downloads'],
    [num(shipped), 'releases'],
    [num(data.contributions), 'contributions in the past year'],
    [num(data.mergedPrs), 'merged public PRs'],
  ]
    .map(([v, l]) => `<tspan class="mono">${esc(v)}</tspan><tspan class="s"> ${esc(l)}</tspan>`)
    .join(`<tspan class="t">${dot}</tspan>`);
  return svg(W, 32, `<text x="1" y="21" font-size="14" xml:space="preserve">${parts}</text>`, t,
    `${num(downloads)} installer downloads, ${shipped} releases, ${data.contributions} contributions in the past year, ${data.mergedPrs} merged public pull requests`, false);
}

// All four apps in one panel, one row each, figures in aligned columns.
function appsCard(apps, icons, t) {
  const top = 52, rowH = 60;
  const H = top + apps.length * rowH + 8;
  const col = { downloads: 600, stars: 680, released: W - 24 };
  const head = `<text x="24" y="32" font-size="14" font-weight="500">Apps</text>
<text x="${col.downloads}" y="32" class="t" font-size="12" text-anchor="end">downloads</text>
<text x="${col.stars}" y="32" class="t" font-size="12" text-anchor="end">stars</text>
<text x="${col.released}" y="32" class="t" font-size="12" text-anchor="end">last release</text>
<line x1="24" y1="${top - 0.5}" x2="${W - 24}" y2="${top - 0.5}" stroke="${t.rule}"/>`;
  const rows = apps
    .map((a, i) => {
      const y = top + i * rowH;
      const rule = i < apps.length - 1 ? `<line x1="72" y1="${y + rowH - 0.5}" x2="${W - 24}" y2="${y + rowH - 0.5}" stroke="${t.rule}"/>` : '';
      return `<image x="24" y="${y + 14}" width="32" height="32" href="data:image/png;base64,${icons[a.repo]}"/>
<text x="72" y="${y + 27}" font-size="14" xml:space="preserve"><tspan font-weight="500">${esc(a.name)}</tspan><tspan class="mono t" font-size="12">  ${esc(a.version)}</tspan><tspan class="t" font-size="12">${dot}${esc(a.platforms.join(', '))}</tspan></text>
<text x="72" y="${y + 46}" class="s" font-size="12">${esc(a.tagline)}</text>
<text x="${col.downloads}" y="${y + 35}" class="mono" font-size="14" text-anchor="end">${esc(num(a.downloads))}</text>
${a.stars > 0 ? `<text x="${col.stars}" y="${y + 35}" class="mono s" font-size="14" text-anchor="end">${esc(num(a.stars))}</text>` : ''}
<text x="${col.released}" y="${y + 35}" class="mono t" font-size="12" text-anchor="end">${esc(a.released ? ago(a.released) : '—')}</text>
${rule}`;
    })
    .join('\n');
  const label = apps.map((a) => `${a.name} ${a.version}: ${a.tagline}, ${a.downloads} downloads${a.stars ? `, ${a.stars} stars` : ''}`).join('. ');
  return svg(W, H, `${head}\n${rows}`, t, `Apps. ${label}.`);
}

// Shared header for the web projects: icon, name, one line, one meta line.
function projectHeader(p, icon, meta) {
  return `<image x="24" y="24" width="44" height="44" href="data:image/png;base64,${icon}"/>
<text x="84" y="42" font-size="16" xml:space="preserve"><tspan font-weight="500">${esc(p.name)}</tspan><tspan class="mono t" font-size="12">  web</tspan></text>
<text x="84" y="64" class="s" font-size="14">${esc(p.tagline)}</text>
<text x="84" y="84" class="t" font-size="12" xml:space="preserve">${meta}</text>`;
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
  const stageX = 24, stageY = 108, stageW = W - 48, padX = 24;
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

  const meta = `React, Fastify and Postgres${dot}${fig(num(tp.passages))} passages${dot}${fig(num(tp.commits))} commits${tp.stars > 0 ? `${dot}${fig(num(tp.stars))} ${tp.stars === 1 ? 'star' : 'stars'}` : ''}`;
  const body = `${projectHeader(tp, icon, meta)}
<rect x="${stageX}" y="${stageY}" width="${stageW}" height="${stageH}" rx="8" fill="${c.bg}"/>
${text}
<text x="${stageX + padX}" y="${stageY + stageH - 20}" font-size="12" style="fill:${c.pending}">${esc(p.author)}, ${esc(p.title)}</text>
<text x="${stageX + stageW - padX}" y="${stageY + stageH - 20}" font-size="12" style="fill:${c.pending}" text-anchor="end">today’s passage</text>`;
  return svg(W, H, body, t, `typeprose: ${tp.tagline}. Today's passage: “${p.line}” ${p.author}, ${p.title}.`);
}

// Helvetica widths per 1000 units, regular and bold. SVG text can't be
// measured at render time, so badge text gets an explicit textLength from
// these: its padding then holds in whatever font the viewer has.
const HELV = {
  r: { ' ': 278, '·': 278, '0': 556, '1': 556, '2': 556, '6': 556, a: 556, b: 556, c: 500, e: 556, i: 222, k: 500, l: 222, n: 556, p: 556, s: 500, t: 278, z: 500, A: 667, N: 722, P: 667, S: 667, U: 722 },
  b: { ' ': 278, '1': 556, a: 556, c: 556, e: 556, l: 278, p: 611, s: 556, t: 333 },
};
const textWidth = (str, size, weight = 'r') => [...str].reduce((n, ch) => n + (HELV[weight][ch] ?? 600), 0) * size / 1000;

// A small badge in the top right corner of the screenshot, like a shadcn/ui
// outline badge: flat, a hairline border, no shadow. Same colors in both
// themes, since it sits on the image.
function awardBadge([title, sub], right, top) {
  const size = 12, padX = 10, icon = 14, gap = 6, h = 28;
  const titleW = textWidth(title, size, 'b');
  const subText = `  ·  ${sub}`;
  const subW = textWidth(subText, size);
  const w = padX + icon + gap + titleW + subW + padX;
  const x = right - w, cy = top + h / 2;
  const tx = x + padX + icon + gap;
  const trophy = 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z';
  return `<rect x="${x + 0.5}" y="${top + 0.5}" width="${w - 1}" height="${h - 1}" rx="6" fill="#fafafa" stroke="#e4e4e7"/>
<path d="${trophy}" transform="translate(${x + padX} ${cy - icon / 2}) scale(${icon / 24})" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<text x="${tx}" y="${cy + 4}" font-size="${size}" font-weight="600" textLength="${titleW.toFixed(1)}" lengthAdjust="spacing" style="fill:#09090b">${esc(title)}</text>
<text x="${tx + titleW}" y="${cy + 4}" font-size="${size}" textLength="${subW.toFixed(1)}" lengthAdjust="spacing" xml:space="preserve" style="fill:#52525b">${esc(subText)}</text>`;
}

function earthriseCard(er, icon, shot, t) {
  const imgX = 24, imgY = 108, imgW = W - 48, imgH = 445;
  const H = imgY + imgH + 24;
  const meta = `${esc(er.stack)}${dot}${fig(num(er.commits))} commits${er.stars > 0 ? `${dot}${fig(num(er.stars))} ${er.stars === 1 ? 'star' : 'stars'}` : ''}`;
  const body = `${projectHeader(er, icon, meta)}
<clipPath id="shot"><rect x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" rx="8"/></clipPath>
<image x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" clip-path="url(#shot)" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${shot}"/>
<rect x="${imgX + 0.5}" y="${imgY + 0.5}" width="${imgW - 1}" height="${imgH - 1}" rx="8" fill="none" stroke="${t.line}"/>
${awardBadge(er.award, imgX + imgW - 12, imgY + 12)}`;
  return svg(W, H, body, t, `Earthrise: ${er.tagline}. A team project that took first place in Uzbekistan at NASA Space Apps 2026 and goes to the global round next. A screenshot of the app: a map of the lunar south pole with the mission brief, the site sheet and the timeline.`);
}

// Releases per day (or week) in one neutral color, and the latest releases.
function cadenceCard(data, t) {
  const H = 228;
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
  const buckets = Array(count).fill(0);
  for (const r of all) {
    const i = Math.floor((r.at.getTime() - start) / unit);
    if (i >= 0 && i < count) buckets[i]++;
  }
  const max = Math.max(1, ...buckets);
  const chartX = 24, chartY = 56, chartW = 448, chartH = 120;
  const step = chartW / count;
  const gap = Math.min(4, step * 0.3);
  const base = chartY + chartH;

  const bars = buckets
    .map((n, i) => {
      if (!n) return '';
      const h = (n / max) * chartH;
      return `<rect x="${(chartX + i * step + gap / 2).toFixed(2)}" y="${(base - h).toFixed(2)}" width="${(step - gap).toFixed(2)}" height="${h.toFixed(2)}" rx="1.5" fill="${t.bar}"/>`;
    })
    .join('');

  const shown = all.filter((r) => r.at.getTime() >= start).length;
  const summary = shown === all.length ? `${all.length} since ${day(first)}` : `${shown} in ${count} ${daily ? 'days' : 'weeks'}`;

  const listX = 520;
  const rows = all
    .slice(0, 6)
    .map((r, i) => {
      const y = 64 + i * 24;
      return `<text x="${listX}" y="${y}" font-size="14">${esc(r.name)}</text>
<text x="${listX + 80}" y="${y}" class="mono s" font-size="12">${esc(r.tag)}</text>
<text x="${W - 24}" y="${y}" class="mono t" font-size="12" text-anchor="end">${esc(day(r.at))}</text>`;
    })
    .join('\n');

  const body = `<text x="24" y="32" font-size="14" font-weight="500">Releases per ${daily ? 'day' : 'week'}</text>
<text x="${chartX + chartW}" y="32" class="t" font-size="12" text-anchor="end">${esc(summary)}</text>
<line x1="${chartX}" y1="${base + 0.5}" x2="${chartX + chartW}" y2="${base + 0.5}" stroke="${t.rule}"/>
${bars}
<text x="${chartX}" y="${base + 20}" class="mono t" font-size="12">${esc(day(new Date(start)))}</text>
<text x="${chartX + chartW}" y="${base + 20}" class="mono t" font-size="12" text-anchor="end">today</text>
<line x1="${listX - 24}" y1="24" x2="${listX - 24}" y2="${H - 24}" stroke="${t.rule}"/>
<text x="${listX}" y="32" font-size="14" font-weight="500">Latest releases</text>
${rows}
<text x="${W - 24}" y="${H - 20}" class="t" font-size="12" text-anchor="end">updated ${esc(NOW.toISOString().slice(0, 16).replace('T', ' '))} UTC</text>`;
  return svg(W, H, body, t, `${all.length} releases since ${day(first)}. Latest: ${all.slice(0, 3).map((r) => `${r.name} ${r.tag}`).join(', ')}.`);
}

// --- main ---------------------------------------------------------------

const data = await load();
const icons = Object.fromEntries(
  await Promise.all([...APPS, TYPEPROSE, EARTHRISE].map(async (a) => [a.repo, (await readFile(new URL(`../assets/${a.repo}.png`, import.meta.url))).toString('base64')])),
);
const shot = (await readFile(new URL('../assets/earthrise.jpg', import.meta.url))).toString('base64');
await mkdir(OUT, { recursive: true });
for (const [mode, t] of Object.entries(THEMES)) {
  await writeFile(join(OUT, `stats-${mode}.svg`), statsCard(data, t));
  await writeFile(join(OUT, `apps-${mode}.svg`), appsCard(data.apps, icons, t));
  await writeFile(join(OUT, `cadence-${mode}.svg`), cadenceCard(data, t));
  await writeFile(join(OUT, `typeprose-${mode}.svg`), typeproseCard(data.typeprose, icons.typeprose, t, mode));
  await writeFile(join(OUT, `earthrise-${mode}.svg`), earthriseCard(data.earthrise, icons.earthrise, shot, t));
}
await writeFile(join(OUT, 'data.json'), JSON.stringify({ generated: NOW, ...data, apps: data.apps.map(({ releases, ...a }) => ({ ...a, releases: releases.length })) }, null, 2) + '\n');
console.log(`rendered ${OUT}: ${data.apps.map((a) => `${a.repo} ${a.version} ${a.downloads}dl`).join(', ')}; ${data.mergedPrs} merged PRs`);
