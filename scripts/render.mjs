#!/usr/bin/env node
// Renders the profile from live GitHub data. No dependencies.
// Usage: scripts/fonts.sh && GITHUB_TOKEN=... node scripts/render.mjs [outDir]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

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
  stack: 'React, Fastify and Postgres',
  stage: {
    light: { bg: '#f4f1ea', line: '#e7e2d6', typed: '#1c1b19', pending: '#9a9385', caret: '#b07d1e', error: '#b23a3a' },
    dark: { bg: '#141311', line: '#24221e', typed: '#ebe6dc', pending: '#6b665d', caret: '#d1a24a', error: '#c25555' },
  },
};

// Earthrise has no releases either. Its card shows a screenshot of the app.
const EARTHRISE = {
  repo: 'earthrise',
  name: 'Earthrise',
  tagline: 'Sunlight, Earth contact and power at the Moon’s south pole',
  stack: 'Team project · TypeScript, WebGL 2 and Python',
  // Shown as a badge on the screenshot.
  award: ['1st place', 'NASA Space Apps 2026, Uzbekistan'],
};

const INSTALLER = /\.(dmg|exe|msi|deb|rpm|AppImage)$/;
const PLATFORM = [
  [/\.dmg$/, 'macOS'],
  [/\.(exe|msi)$/, 'Windows'],
  [/\.(deb|rpm|AppImage)$/, 'Linux'],
];

// Neutral greys, close to the ones Linear uses. Panels sit a step off the
// page in both themes; color comes only from the content.
const THEMES = {
  light: {
    card: '#fcfcfd', line: '#e3e4e8', rule: '#eeeff2', glow: 'rgba(255,255,255,0)',
    ink: '#08090a', secondary: '#62666d', tertiary: '#8a8f98', bar: '#c8cad0', barNow: '#08090a',
  },
  dark: {
    card: '#0f1011', line: '#23252a', rule: '#1b1c1f', glow: 'rgba(255,255,255,0.07)',
    ink: '#f7f8f8', secondary: '#8a8f98', tertiary: '#62666d', bar: '#34363c', barNow: '#f7f8f8',
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
    .filter((p) => p.line.length >= 60 && p.line.length <= 140);
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
        version: latest?.tag_name ?? '–',
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

// --- type ---------------------------------------------------------------
//
// Inter and JetBrains Mono (both under the SIL Open Font License) are embedded
// in every card, so the cards set the same way on every machine. The workflow
// fetches the latin subsets from npm into assets/fonts; the hashes pin them.

const FONT_FILES = {
  inter: ['inter.woff2', 'f052ee44c3728dfd23aba8a4567150bc314d23903026fbb6ad089422c2df56af'],
  mono: ['jetbrains-mono.woff2', '14425ba9c695763c1547f48a206b7aa60350a33ae23de09f0407877f3fcd89eb'],
};
const FONTS = {};
for (const [key, [file, sha256]] of Object.entries(FONT_FILES)) {
  const bytes = await readFile(new URL(`../assets/fonts/${file}`, import.meta.url));
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== sha256) throw new Error(`assets/fonts/${file}: sha256 ${actual}, expected ${sha256}`);
  FONTS[key] = bytes.toString('base64');
}
const SANS = `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;
const MONO = `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

// Inter advance widths in em, by character class. Only used to size pills and
// to place text after text; each such run also gets a textLength, so an error
// here moves letter spacing by a fraction of a pixel, not the layout.
const NARROW = new Set([...' .,:;\'’!|il·jtfrI()[]']);
const WIDE = new Set([...'mwMW@%']);
function measure(str, size, weight = 400) {
  const em = [...str].reduce((n, ch) => {
    if (NARROW.has(ch)) return n + (ch === ' ' ? 0.26 : 0.3);
    if (WIDE.has(ch)) return n + 0.84;
    if (/[0-9]/.test(ch)) return n + 0.6;
    if (/[A-Z]/.test(ch)) return n + 0.68;
    return n + 0.55;
  }, 0);
  return em * size * (weight >= 500 ? 1.035 : 1);
}
// Inter's tracking for its size, tighter as it gets bigger.
const track = (size) => +((size >= 32 ? -0.022 : size >= 20 ? -0.017 : size >= 15 ? -0.011 : 0) * size).toFixed(2);

// --- svg helpers --------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const num = (n) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : n.toLocaleString('en-US'));

function ago(date) {
  const s = (NOW - date) / 1000;
  const units = [[86400 * 30, 'mo'], [86400 * 7, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']];
  for (const [size, unit] of units) if (s >= size) return `${Math.floor(s / size)}${unit} ago`;
  return 'just now';
}

const day = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

// Framed cards carry 16px of clear space below them, so they stack with a
// gap on the page; GitHub strips any margin set in the markdown.
function svg(width, height, body, t, title, { frame = true, mono = false, below = frame ? 16 : 0 } = {}) {
  const faces = [
    `@font-face { font-family: Inter; font-weight: 100 900; src: url(data:font/woff2;base64,${FONTS.inter}) format('woff2'); }`,
    mono ? `@font-face { font-family: 'JetBrains Mono'; font-weight: 400; src: url(data:font/woff2;base64,${FONTS.mono}) format('woff2'); }` : '',
  ].filter(Boolean).join('\n  ');
  const panel = frame
    ? `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${t.card}" stroke="${t.line}"/>
<path d="M14 0.5 H${width - 14}" stroke="${t.glow}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + below}" viewBox="0 0 ${width} ${height + below}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>
  ${faces}
  text { font-family: ${SANS}; fill: ${t.ink}; font-feature-settings: 'cv11'; }
  .n { font-feature-settings: 'cv11', 'tnum'; }
  .mono { font-family: ${MONO}; font-feature-settings: normal; }
  .s { fill: ${t.secondary}; }
  .t { fill: ${t.tertiary}; }
  .m { font-weight: 510; }
</style>
${panel}
${body}
</svg>
`;
}

// A title the way Linear writes one: the name in ink, one sentence in grey.
function heading(x, y, lead, rest, size = 15) {
  return `<text x="${x}" y="${y}" font-size="${size}" letter-spacing="${track(size)}" xml:space="preserve"><tspan class="m">${esc(lead)}</tspan><tspan class="s"> ${esc(rest)}</tspan></text>`;
}

// --- cards --------------------------------------------------------------
//
// One headline at 40, titles at 15, body at 13 and 14, meta at 12. Weights
// 400 and 510, one sans and one mono.

// The top of the page: the latest release, one line, one sentence, and the
// figures behind them. No frame, so it reads as the page itself.
function heroCard(data, t) {
  const all = data.apps.flatMap((a) => a.releases).sort((a, b) => b.at - a.at);
  const last = all[0];
  const H = 316;

  let pill = '';
  if (last) {
    const lead = 'Latest';
    const rest = `${last.name} ${last.tag}, ${ago(last.at)}`;
    const leadW = measure(lead, 13, 510), restW = measure(rest, 13);
    const w = 26 + leadW + 21 + restW + 14;
    pill = `<rect x="0.5" y="0.5" width="${(w - 1).toFixed(1)}" height="29" rx="15" fill="${t.card}" stroke="${t.line}"/>
<circle cx="15" cy="15" r="3" fill="#4cb782"/>
<text x="26" y="19.5" font-size="13" class="m" textLength="${leadW.toFixed(1)}" lengthAdjust="spacing">${lead}</text>
<line x1="${(26 + leadW + 10.5).toFixed(1)}" y1="9" x2="${(26 + leadW + 10.5).toFixed(1)}" y2="21" stroke="${t.line}"/>
<text x="${(26 + leadW + 21).toFixed(1)}" y="19.5" font-size="13" class="s" textLength="${restW.toFixed(1)}" lengthAdjust="spacing">${esc(rest)}</text>`;
  }

  const head = ['Small, focused software', 'for the desktop and the web.']
    .map((l, i) => `<text x="-1.5" y="${96 + i * 48}" font-size="40" class="m" letter-spacing="${track(40)}">${esc(l)}</text>`)
    .join('\n');
  const sub = ['Menu bar apps for macOS, Windows and Linux, and a few projects for the web.', 'Open source, built in public, with no accounts and no telemetry.']
    .map((l, i) => `<text x="0" y="${188 + i * 25}" font-size="16" class="s" letter-spacing="${track(16)}">${esc(l)}</text>`)
    .join('\n');

  const downloads = data.apps.reduce((n, a) => n + a.downloads, 0);
  const figures = [
    [num(downloads), 'Installer downloads'],
    [num(all.length), 'Releases'],
    [num(data.contributions), 'Contributions, last 12 months'],
    [num(data.mergedPrs), 'Merged public PRs'],
  ];
  const colW = W / figures.length;
  const stats = figures
    .map(([v, l], i) => {
      const x = i * colW + (i ? 20 : 0);
      const sep = i ? `<line x1="${i * colW + 0.5}" y1="258" x2="${i * colW + 0.5}" y2="${H - 2}" stroke="${t.rule}"/>` : '';
      return `${sep}<text x="${x}" y="282" font-size="24" class="m n" letter-spacing="${track(24)}">${esc(v)}</text>
<text x="${x}" y="306" font-size="13" class="t">${esc(l)}</text>`;
    })
    .join('\n');

  const body = `${pill}
${head}
${sub}
<line x1="0" y1="244.5" x2="${W}" y2="244.5" stroke="${t.rule}"/>
${stats}`;
  return svg(W, H, body, t,
    `Small, focused software for the desktop and the web. ${num(downloads)} installer downloads, ${all.length} releases, ${data.contributions} contributions in the last 12 months, ${data.mergedPrs} merged public pull requests.`,
    { frame: false, below: 36 });
}

// All four apps in one panel, one row each, figures in aligned columns.
function appsCard(apps, icons, t) {
  const top = 64, rowH = 64;
  const H = top + apps.length * rowH + 10;
  const col = { downloads: 588, stars: 672, released: W - 28 };
  const head = `${heading(28, 38, 'Apps.', 'Four menu bar apps, built with Rust, Swift and TypeScript.')}
<text x="${col.downloads}" y="38" class="t" font-size="12" text-anchor="end">Downloads</text>
<text x="${col.stars}" y="38" class="t" font-size="12" text-anchor="end">Stars</text>
<text x="${col.released}" y="38" class="t" font-size="12" text-anchor="end">Released</text>
<line x1="28" y1="${top - 0.5}" x2="${W - 28}" y2="${top - 0.5}" stroke="${t.rule}"/>`;
  const rows = apps
    .map((a, i) => {
      const y = top + i * rowH;
      const rule = i < apps.length - 1 ? `<line x1="80" y1="${y + rowH - 0.5}" x2="${W - 28}" y2="${y + rowH - 0.5}" stroke="${t.rule}"/>` : '';
      const nameW = measure(a.name, 14, 510);
      return `<image x="28" y="${y + 14}" width="36" height="36" href="data:image/png;base64,${icons[a.repo]}"/>
<text x="80" y="${y + 28}" font-size="14" class="m" textLength="${nameW.toFixed(1)}" lengthAdjust="spacing">${esc(a.name)}</text>
<text x="${(80 + nameW + 10).toFixed(1)}" y="${y + 28}" font-size="12" class="mono t">${esc(a.version)}</text>
<text x="80" y="${y + 47}" class="s" font-size="13">${esc(a.tagline)}</text>
<text x="${col.downloads}" y="${y + 37}" class="n" font-size="14" text-anchor="end">${esc(num(a.downloads))}</text>
<text x="${col.stars}" y="${y + 37}" class="s n" font-size="14" text-anchor="end">${a.stars > 0 ? esc(num(a.stars)) : '–'}</text>
<text x="${col.released}" y="${y + 37}" class="t" font-size="13" text-anchor="end">${esc(a.released ? ago(a.released) : '–')}</text>
${rule}`;
    })
    .join('\n');
  const label = apps.map((a) => `${a.name} ${a.version}, for ${a.platforms.join(', ')}: ${a.tagline}, ${a.downloads} downloads${a.stars ? `, ${a.stars} stars` : ''}`).join('. ');
  return svg(W, H, `${head}\n${rows}`, t, `Apps. ${label}.`, { mono: true });
}

// Shared header for the web projects: icon, name, one line, one meta label.
function projectHeader(p, icon, meta, t) {
  const nameW = measure(p.name, 15, 510);
  return `<image x="28" y="28" width="44" height="44" href="data:image/png;base64,${icon}"/>
<text x="88" y="46" font-size="15" class="m" textLength="${nameW.toFixed(1)}" lengthAdjust="spacing">${esc(p.name)}</text>
<text x="${(88 + nameW + 10).toFixed(1)}" y="46" font-size="12" class="mono t">web</text>
<text x="88" y="68" class="s" font-size="14">${esc(p.tagline)}</text>
<text x="${W - 28}" y="46" class="t" font-size="12" text-anchor="end">${esc(meta)}</text>`;
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
  const CH = 9; // JetBrains Mono at 15px advances exactly 9px a glyph
  const stageX = 28, stageY = 96, stageW = W - 56, padX = 28;
  const cols = Math.floor((stageW - padX * 2) / CH);
  const lines = wrap(p.line, cols).slice(0, 2);
  const stageH = 46 + lines.length * 30 + 30;
  const H = stageY + stageH + 28;

  // Mid-run: about 40% typed, one missed key a few letters back.
  const total = lines.reduce((n, l) => n + l.length, 0);
  let caret = Math.round(total * 0.4);
  while (caret < total && lines.join(' ')[caret - 1] === ' ') caret++;
  let miss = caret - 5;
  while (miss > 0 && !/[a-z]/i.test(lines.join(' ')[miss])) miss--;

  let offset = 0;
  const text = lines
    .map((line, li) => {
      const y = stageY + 48 + li * 30;
      const x = stageX + padX;
      const spans = [...line].map((ch, i) => {
        const k = offset + i;
        const fill = k === miss ? c.error : k < caret ? c.typed : c.pending;
        return `<tspan style="fill:${fill}">${esc(ch)}</tspan>`;
      });
      let extra = '';
      if (miss >= offset && miss < offset + line.length) {
        extra += `<rect x="${x + (miss - offset) * CH}" y="${y + 5}" width="${CH}" height="1.5" fill="${c.error}"/>`;
      }
      if (caret >= offset && caret <= offset + line.length) {
        extra += `<rect x="${x + (caret - offset) * CH - 1}" y="${y - 16}" width="2" height="21" rx="1" fill="${c.caret}"/>`;
      }
      offset += line.length + 1;
      return `<text x="${x}" y="${y}" class="mono" font-size="15" textLength="${line.length * CH}" lengthAdjust="spacing">${spans.join('')}</text>${extra}`;
    })
    .join('\n');

  const meta = `${tp.stack} · ${num(tp.passages)} passages · ${num(tp.commits)} commits`;
  const body = `${projectHeader(tp, icon, meta, t)}
<rect x="${stageX + 0.5}" y="${stageY + 0.5}" width="${stageW - 1}" height="${stageH - 1}" rx="10" fill="${c.bg}" stroke="${c.line}"/>
${text}
<text x="${stageX + padX}" y="${stageY + stageH - 24}" font-size="12" style="fill:${c.pending}">${esc(p.author)}, ${esc(p.title)}</text>
<text x="${stageX + stageW - padX}" y="${stageY + stageH - 24}" font-size="12" style="fill:${c.pending}" text-anchor="end">Today’s passage</text>`;
  return svg(W, H, body, t, `typeprose: ${tp.tagline}. Today's passage: “${p.line}” ${p.author}, ${p.title}.`, { mono: true });
}

// A small badge in the top right corner of the screenshot: dark glass and a
// hairline, the same in both themes since it sits on the image.
function awardBadge([title, sub], right, top) {
  const size = 12, padX = 12, icon = 13, gap = 7, h = 28;
  const titleW = measure(title, size, 510);
  const subW = measure(sub, size);
  const w = padX + icon + gap + titleW + 17 + subW + padX;
  const x = right - w, cy = top + h / 2;
  const tx = x + padX + icon + gap;
  const trophy = 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z';
  return `<rect x="${(x + 0.5).toFixed(1)}" y="${top + 0.5}" width="${(w - 1).toFixed(1)}" height="${h - 1}" rx="8" fill="#0f1011" fill-opacity="0.88" stroke="#ffffff" stroke-opacity="0.14"/>
<path d="${trophy}" transform="translate(${(x + padX).toFixed(1)} ${cy - icon / 2}) scale(${icon / 24})" fill="none" stroke="#f2c94c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<text x="${tx.toFixed(1)}" y="${cy + 4.5}" font-size="${size}" class="m" textLength="${titleW.toFixed(1)}" lengthAdjust="spacing" style="fill:#f7f8f8">${esc(title)}</text>
<line x1="${(tx + titleW + 8.5).toFixed(1)}" y1="${cy - 6}" x2="${(tx + titleW + 8.5).toFixed(1)}" y2="${cy + 6}" stroke="#ffffff" stroke-opacity="0.18"/>
<text x="${(tx + titleW + 17).toFixed(1)}" y="${cy + 4.5}" font-size="${size}" textLength="${subW.toFixed(1)}" lengthAdjust="spacing" style="fill:#b4b8bf">${esc(sub)}</text>`;
}

function earthriseCard(er, icon, shot, t) {
  const imgX = 28, imgY = 96, imgW = W - 56, imgH = 420;
  const H = imgY + imgH + 28;
  const meta = `${er.stack} · ${num(er.commits)} commits`;
  const body = `${projectHeader(er, icon, meta, t)}
<clipPath id="shot"><rect x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" rx="10"/></clipPath>
<image x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" clip-path="url(#shot)" preserveAspectRatio="xMidYMin slice" href="data:image/jpeg;base64,${shot}"/>
<rect x="${imgX + 0.5}" y="${imgY + 0.5}" width="${imgW - 1}" height="${imgH - 1}" rx="10" fill="none" stroke="${t.line}"/>
${awardBadge(er.award, imgX + imgW - 14, imgY + 14)}`;
  return svg(W, H, body, t, `Earthrise: ${er.tagline}. A team project that took first place in Uzbekistan at NASA Space Apps 2026 and goes to the global round next. A screenshot of the app: a map of the lunar south pole with the mission brief, the site sheet and the timeline.`, { mono: true });
}

// Releases per day (or week), the last seven days in ink, and the latest ones.
function cadenceCard(data, t) {
  const H = 252;
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
  const chartX = 28, chartY = 84, chartW = 440, chartH = 108;
  const step = chartW / count;
  const gap = Math.min(4, step * 0.32);
  const base = chartY + chartH;
  const recent = daily ? 7 : 1;

  const grid = [0.5, 1].map((f) => `<line x1="${chartX}" y1="${(base - f * chartH).toFixed(1)}" x2="${chartX + chartW}" y2="${(base - f * chartH).toFixed(1)}" stroke="${t.rule}" stroke-dasharray="2 4"/>`).join('');
  const bars = buckets
    .map((n, i) => {
      if (!n) return '';
      const h = Math.max(3, (n / max) * chartH);
      const fill = i >= count - recent ? t.barNow : t.bar;
      return `<rect x="${(chartX + i * step + gap / 2).toFixed(2)}" y="${(base - h).toFixed(2)}" width="${(step - gap).toFixed(2)}" height="${h.toFixed(2)}" rx="2" fill="${fill}"/>`;
    })
    .join('');

  const shown = all.filter((r) => r.at.getTime() >= start).length;
  const week = all.filter((r) => NOW - r.at < 7 * DAY).length;
  const summary = shown === all.length ? `${all.length} releases since ${day(first)}.` : `${shown} releases in the last ${count} ${daily ? 'days' : 'weeks'}.`;

  const listX = 528;
  const rows = all
    .slice(0, 6)
    .map((r, i) => {
      const y = 92 + i * 26;
      return `<text x="${listX}" y="${y}" font-size="13">${esc(r.name)}</text>
<text x="${listX + 76}" y="${y}" class="mono s" font-size="12">${esc(r.tag)}</text>
<text x="${W - 28}" y="${y}" class="t" font-size="13" text-anchor="end">${esc(day(r.at))}</text>`;
    })
    .join('\n');

  const body = `${heading(28, 38, 'Shipping.', summary)}
<text x="${W - 28}" y="38" class="t" font-size="12" text-anchor="end">${week} this week</text>
<line x1="28" y1="60.5" x2="${W - 28}" y2="60.5" stroke="${t.rule}"/>
${grid}
<line x1="${chartX}" y1="${base + 0.5}" x2="${chartX + chartW}" y2="${base + 0.5}" stroke="${t.line}"/>
${bars}
<text x="${chartX}" y="${base + 26}" class="t" font-size="12">${esc(day(new Date(start)))}</text>
<text x="${chartX + chartW}" y="${base + 26}" class="t" font-size="12" text-anchor="end">Today</text>
<line x1="${listX - 30.5}" y1="80" x2="${listX - 30.5}" y2="${H - 28}" stroke="${t.rule}"/>
${rows}`;
  return svg(W, H, body, t, `${all.length} releases since ${day(first)}, ${week} this week. Latest: ${all.slice(0, 3).map((r) => `${r.name} ${r.tag}`).join(', ')}.`, { mono: true });
}

// --- main ---------------------------------------------------------------

const data = await load();
const icons = Object.fromEntries(
  await Promise.all([...APPS, TYPEPROSE, EARTHRISE].map(async (a) => [a.repo, (await readFile(new URL(`../assets/${a.repo}.png`, import.meta.url))).toString('base64')])),
);
const shot = (await readFile(new URL('../assets/earthrise.jpg', import.meta.url))).toString('base64');
await mkdir(OUT, { recursive: true });
for (const [mode, t] of Object.entries(THEMES)) {
  await writeFile(join(OUT, `hero-${mode}.svg`), heroCard(data, t));
  await writeFile(join(OUT, `apps-${mode}.svg`), appsCard(data.apps, icons, t));
  await writeFile(join(OUT, `cadence-${mode}.svg`), cadenceCard(data, t));
  await writeFile(join(OUT, `typeprose-${mode}.svg`), typeproseCard(data.typeprose, icons.typeprose, t, mode));
  await writeFile(join(OUT, `earthrise-${mode}.svg`), earthriseCard(data.earthrise, icons.earthrise, shot, t));
}
await writeFile(join(OUT, 'data.json'), JSON.stringify({ generated: NOW, ...data, apps: data.apps.map(({ releases, ...a }) => ({ ...a, releases: releases.length })) }, null, 2) + '\n');
console.log(`rendered ${OUT}: ${data.apps.map((a) => `${a.repo} ${a.version} ${a.downloads}dl`).join(', ')}; ${data.mergedPrs} merged PRs`);
