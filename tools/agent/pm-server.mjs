#!/usr/bin/env node
// PM Server: drives a live (optionally headless) browser running Pocket Mockster
// and exposes a JSON-over-HTTP API for agents. Logs every event as JSONL,
// renders an in-page agent overlay, and produces run reports.
//
// Usage: node tools/agent/pm-server.mjs [--port 8787] [--vite-port 5199]
//          [--run-id <id>] [--headless] [--seed <n>] [--speed <n>]
//          [--profile <name>] [--goal "<text>"]

import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { renderFindingsIndexMd } from './findings-index.mjs';

const AGENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(AGENT_DIR, '../..');

// ---------- args ----------
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}
const args = parseArgs(process.argv);
const PORT = Number(args.port ?? 8787);
const VITE_PORT = Number(args['vite-port'] ?? 5199);
const HEADLESS = !!args.headless;
const FROZEN = !!args.build;
// The cross-run findings index is the one artifact shared by every run, so the
// e2e suite points this at its own run dir: its fixture findings were being
// rolled up as if real agents had reported them.
const INDEX_DIR = String(args['index-dir'] ?? path.join(REPO_ROOT, 'agent-runs'));
const RUN_ID = String(args['run-id'] ?? new Date().toISOString().replace(/[:.]/g, '-'));
const RUN_META = {
  runId: RUN_ID,
  profile: args.profile ?? null,
  goal: args.goal ?? null,
  seed: args.seed !== undefined ? Number(args.seed) : null,
  speed: Number(args.speed ?? 1),
  frozenBuild: FROZEN,
  model: args.model ?? null,
  effort: args.effort ?? null,
  headless: HEADLESS,
  startedAt: new Date().toISOString(),
};

// Deliberately not under test-results/: playwright wipes that directory on every run.
const RUN_DIR = path.join(REPO_ROOT, 'agent-runs', RUN_ID);
fs.mkdirSync(RUN_DIR, { recursive: true });
fs.mkdirSync(path.join(RUN_DIR, 'findings'), { recursive: true });

// ---------- event log ----------
let seq = 0;
const events = [];
const logStream = fs.createWriteStream(path.join(RUN_DIR, 'events.jsonl'), { flags: 'a' });
const KNOWN_MODES = new Set([
  'intro',
  'title',
  'overworld',
  'dialogue',
  'menu',
  'battle',
  'summary',
  'dex',
  'ending',
  'credits',
]);

function logEvent(type, data = {}) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...data };
  events.push(ev);
  logStream.write(JSON.stringify(ev) + '\n');
  return ev;
}

// ---------- overlay ----------
const OVERLAY_INIT = () => {
  window.__PM_OVERLAY = {
    update(payload) {
      const render = () => {
        if (!document.body) {
          setTimeout(render, 50);
          return;
        }
        let el = document.getElementById('pm-agent-overlay');
        if (!el) {
          el = document.createElement('div');
          el.id = 'pm-agent-overlay';
          el.style.cssText =
            'position:fixed;top:8px;right:8px;width:360px;max-height:94vh;overflow:hidden;' +
            'background:rgba(10,12,20,0.88);color:#dfe3f0;font:12px/1.45 monospace;' +
            'border:1px solid #56618c;border-radius:6px;padding:10px;z-index:99999;' +
            'white-space:pre-wrap;pointer-events:none;';
          document.body.appendChild(el);
        }
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const m = payload.meta;
        const s = payload.status;
        let html = '';
        html += `<div style="color:#8fd3ff;font-weight:bold">POCKET MOCKSTER AGENT</div>`;
        if (m.profile) html += `<div>profile: <b>${esc(m.profile)}</b>  speed: ${esc(payload.speed)}x</div>`;
        if (m.goal) html += `<div style="color:#aab">goal: ${esc(m.goal).slice(0, 140)}</div>`;
        html += `<hr style="border-color:#333c57">`;
        if (s) {
          html += `<div>mode:${esc(s.mode)} map:${esc(s.map)} (${s.x},${s.y}) $${s.money} badges:${s.badges.length}</div>`;
        }
        html += `<hr style="border-color:#333c57">`;
        html += payload.feed.map((l) => `<div>${esc(l)}</div>`).join('');
        if (payload.note) {
          html += `<hr style="border-color:#333c57"><div style="color:#ffe9a8">${esc(payload.note).slice(0, 420)}</div>`;
        }
        el.innerHTML = html;
      };
      render();
    },
  };
};

const feed = [];
let agentNote = '';
let lastStatus = null;
function pushFeed(line) {
  const t = new Date().toISOString().slice(11, 19);
  feed.push(`${t} ${line}`);
  if (feed.length > 14) feed.shift();
}

// ---------- state ----------
let viteProc = null;
let browser = null;
let page = null;
let speed = RUN_META.speed;
let lastStuckFingerprint = null;
let expectReload = false;
let cleared = false;
let samePosStreak = 0;
let stuckWarned = false;
let prevSummary = null;
const stats = {
  toolCalls: {},
  keysPressed: 0,
  tilesWalked: 0,
  battlesRun: 0,
  anomalies: 0,
  warnings: 0,
  findings: 0,
};

function stateSummary(s) {
  if (!s) return null;
  const party = s.party.map((m) => {
    const p = `${m.species} L${m.level} ${m.hp}/${m.maxHp}`;
    return m.status ? `${p} (${m.status})` : p;
  });
  return {
    mode: s.mode,
    map: s.map,
    x: s.x,
    y: s.y,
    facing: s.facing,
    money: s.money,
    badges: s.badges,
    objective: s.objective ?? null,
    party,
    storage: s.storageCount,
    inventory: Object.fromEntries(Object.entries(s.inventory ?? {}).filter(([, n]) => n > 0)),
    healPoint: s.healPoint ? `${s.healPoint.map} (${s.healPoint.x},${s.healPoint.y})` : null,
    menu: s.menu ? { title: s.menu.title, items: s.menu.items, index: s.menu.index, info: s.menu.info ?? null } : null,
    dialogue: s.dialogue ? s.dialogue.slice(0, 120) : null,
    nearbyTiles: s.nearbyTiles ?? null,
    battle: s.battle
      ? {
          phase: s.battle.phase,
          menuIndex: s.battle.menuIndex,
          message: s.battle.message,
          outcome: s.battle.outcome,
          isTrainer: s.battle.isTrainer,
          enemy: { species: s.battle.enemy.species, level: s.battle.enemy.level, hp: s.battle.enemy.hp, maxHp: s.battle.enemy.maxHp },
          active: {
            species: s.battle.active.species,
            hp: s.battle.active.hp,
            moves: s.battle.active.moves.map((mv) => `${mv.name} (${mv.type}/${mv.category} ${mv.power}dmg ${mv.pp}/${mv.maxPp}pp)`),
          },
        }
      : null,
    seen: s.seen,
    caught: s.caught,
    minute: s.minute,
    cleared: s.mode === 'ending' || !!s.endingShown,
  };
}

// ---------- findings ----------
const SEVERITIES = ['blocker', 'major', 'minor', 'polish', 'good', 'question'];
const CATEGORIES = [
  'crash',
  'softlock',
  'progression',
  'logic',
  'balance',
  'ux',
  'text',
  'collision',
  'performance',
  'tooling',
];
// Which codebase owns the defect. Getting this wrong sends a fixer into the
// wrong repo area, so it is a required field rather than a guess.
const AREAS = ['game', 'harness', 'docs', 'environment'];

function normalizePricingTable(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = {};
  for (const [model, rates] of Object.entries(input)) {
    if (!rates || typeof rates !== 'object') continue;
    const inRate = Number(rates.input);
    const cachedRate = Number(rates.cached);
    const outRate = Number(rates.output);
    if (!Number.isFinite(inRate) || !Number.isFinite(cachedRate) || !Number.isFinite(outRate)) continue;
    out[model] = { input: inRate, cached: cachedRate, output: outRate };
  }
  return Object.keys(out).length ? out : null;
}

function loadDefaultPricing() {
  const pricingPath = path.join(AGENT_DIR, 'pricing.json');
  const parsed = JSON.parse(fs.readFileSync(pricingPath, 'utf8'));
  const normalized = normalizePricingTable(parsed);
  if (!normalized) throw new Error(`invalid pricing table in ${pricingPath}`);
  return normalized;
}

function parsePricingOverride(raw) {
  if (!raw) return null;
  try {
    return normalizePricingTable(JSON.parse(raw));
  } catch {
    return null;
  }
}

const DEFAULT_MODEL_PRICING = loadDefaultPricing();
const MODEL_PRICING = parsePricingOverride(args.pricing) ?? DEFAULT_MODEL_PRICING;

function computeCost(usage, model) {
  if (!usage || !model) return null;
  const p = MODEL_PRICING[model];
  if (!p) return null;
  const inp = usage.input_tokens ?? 0;
  const cached = usage.cached_input_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  const uncached = Math.max(0, inp - cached);
  return {
    inputCost: +(uncached / 1e6 * p.input).toFixed(4),
    cachedCost: +(cached / 1e6 * p.cached).toFixed(4),
    outputCost: +(out / 1e6 * p.output).toFixed(4),
    total: +((uncached / 1e6 * p.input) + (cached / 1e6 * p.cached) + (out / 1e6 * p.output)).toFixed(4),
  };
}

const findings = [];
const findingByPrint = new Map();

function fingerprintOf(f) {
  const norm = (s) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/\d+/g, '#')
      .replace(/[^a-z#]+/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 14)
      .join(' ');
  return crypto
    .createHash('sha1')
    .update([f.area, f.category, norm(f.title || f.detail)].join('|'))
    .digest('hex')
    .slice(0, 10);
}

function reproTrail(limit = 8) {
  const calls = [];
  for (let i = events.length - 1; i >= 0 && calls.length < limit; i--) {
    const e = events[i];
    if (e.type !== 'tool_result') continue;
    calls.push({ tool: e.tool, args: events.find((x) => x.seq === e.seq - 1)?.args ?? null, error: e.error ?? null });
  }
  return calls.reverse();
}

async function captureFindingShot(index, slug) {
  if (!page || page.isClosed()) return null;
  const file = path.join('findings', `${String(index).padStart(2, '0')}-${slug}.png`);
  try {
    await page.screenshot({ path: path.join(RUN_DIR, file) });
    return file;
  } catch {
    return null;
  }
}

async function recordFinding(input) {
  const invalid = [];
  const pick = (value, allowed, fallback) => {
    if (allowed.includes(value)) return value;
    if (value !== undefined && value !== null) invalid.push(`${value}`);
    return fallback;
  };
  const f = {
    severity: pick(input.severity, SEVERITIES, 'major'),
    category: pick(input.category, CATEGORIES, 'logic'),
    area: pick(input.area, AREAS, 'game'),
    title: String(input.title ?? input.detail ?? 'untitled finding').slice(0, 160),
    expected: input.expected ? String(input.expected).slice(0, 600) : null,
    actual: input.actual ? String(input.actual).slice(0, 600) : null,
    detail: input.detail ? String(input.detail).slice(0, 2000) : null,
    reproduced: input.reproduced === true,
    source: input.source ?? 'agent',
  };
  const print = fingerprintOf(f);
  const existing = findingByPrint.get(print);
  if (existing) {
    existing.occurrences++;
    existing.lastSeenAt = new Date().toISOString();
    if (f.reproduced) existing.reproduced = true;
    logEvent('finding_repeat', { print, occurrences: existing.occurrences, title: existing.title });
    return existing;
  }

  const slug = f.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'finding';
  const record = {
    ...f,
    print,
    index: findings.length + 1,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    occurrences: 1,
    invalidFields: invalid.length ? invalid : undefined,
    repro: {
      seed: RUN_META.seed,
      speed,
      runId: RUN_ID,
      state: lastStatus ? stateSummary(lastStatus) : null,
      recentToolCalls: reproTrail(),
    },
    screenshot: await captureFindingShot(findings.length + 1, slug),
  };
  findings.push(record);
  findingByPrint.set(print, record);
  if (record.severity !== 'good') stats.findings++;
  logEvent('finding', record);
  pushFeed(`[${record.severity}/${record.area}] ${record.title.slice(0, 70)}`);
  return record;
}

function checkAnomalies(s) {
  const out = [];
  if (!s) return out;
  if (s.money < 0) out.push(`money negative: ${s.money}`);
  if (s.party.length > 6) out.push(`party size ${s.party.length} > 6`);
  for (const m of s.party) {
    if (Number.isNaN(m.hp) || m.hp < 0) out.push(`${m.species} hp invalid: ${m.hp}`);
    if (m.hp > m.maxHp) out.push(`${m.species} hp ${m.hp} > maxHp ${m.maxHp}`);
    if (m.level < 1 || m.level > 100) out.push(`${m.species} level invalid: ${m.level}`);
    if (Number.isNaN(m.maxHp) || m.maxHp <= 0) out.push(`${m.species} maxHp invalid: ${m.maxHp}`);
  }
  if (!KNOWN_MODES.has(s.mode)) out.push(`unknown mode: ${s.mode}`);
  if (s.caught > s.seen) out.push(`dex caught ${s.caught} > seen ${s.seen}`);
  if (s.storageCount < 0) out.push(`storage count negative: ${s.storageCount}`);
  return out;
}

// Mechanical text QA: leaked placeholders read as bugs to any player and cost
// nothing to detect, so they should not depend on the model noticing.
const BAD_TEXT = /\b(undefined|NaN|null|TODO|FIXME)\b|\[object |\{\{|\}\}/;
const seenText = new Set();
function checkText(s) {
  const out = [];
  const candidates = [
    ['dialogue', s.dialogue],
    ['battle message', s.battle?.message],
    ['menu title', s.menu?.title],
  ];
  for (const [where, text] of candidates) {
    if (!text || seenText.has(text)) continue;
    seenText.add(text);
    const m = BAD_TEXT.exec(text);
    if (m) out.push({ where, text, marker: m[0] });
  }
  return out;
}

// The game loop should keep advancing frames; if wall clock moves and
// playFrames does not, the page is hung (a crash a screenshot alone hides).
let lastFrames = null;
let lastFramesAt = 0;
function checkStall(s) {
  const now = Date.now();
  const frames = s.playFrames;
  if (typeof frames !== 'number') return null;
  if (lastFrames === null || frames !== lastFrames) {
    lastFrames = frames;
    lastFramesAt = now;
    return null;
  }
  if (s.mode !== 'overworld' && s.mode !== 'battle') return null;
  const stalledMs = now - lastFramesAt;
  if (stalledMs < 4000) return null;
  lastFramesAt = now;
  return stalledMs;
}

function detectMilestones(sum) {
  if (!sum) return;
  if (!prevSummary) {
    prevSummary = sum;
    return;
  }
  if (sum.map !== prevSummary.map) {
    logEvent('milestone', { kind: 'map-change', from: prevSummary.map, to: sum.map });
    pushFeed(`--> entered ${sum.map}`);
  }
  if (sum.badges.length > prevSummary.badges.length) {
    logEvent('milestone', { kind: 'badge', badge: sum.badges[sum.badges.length - 1] });
    pushFeed(`*** BADGE earned! (${sum.badges.length})`);
  }
  const prevMax = Math.max(0, ...prevSummary.party.map((p) => Number(/ L(\d+)/.exec(p)?.[1] ?? 0)));
  const curMax = Math.max(0, ...sum.party.map((p) => Number(/ L(\d+)/.exec(p)?.[1] ?? 0)));
  if (curMax > prevMax && prevSummary.party.length > 0) {
    logEvent('milestone', { kind: 'level-up', from: prevMax, to: curMax });
  }
  if (curMax < prevMax && sum.party.length >= prevSummary.party.length) {
    autoFinding({
      severity: 'major',
      category: 'logic',
      title: `party level regressed from L${prevMax} to L${curMax}`,
      expected: 'levels never decrease during play',
      actual: `lead levels went ${prevSummary.party.join(', ')} -> ${sum.party.join(', ')}`,
    });
  }
  if (sum.badges.length < prevSummary.badges.length) {
    autoFinding({
      severity: 'blocker',
      category: 'progression',
      title: 'badge count decreased',
      expected: 'earned badges are permanent',
      actual: `${prevSummary.badges.join(', ')} -> ${sum.badges.join(', ')}`,
    });
  }
  if (sum.party.length > prevSummary.party.length) {
    logEvent('milestone', { kind: 'party-add', party: sum.party });
    pushFeed(`+++ party now ${sum.party.length}: ${sum.party.join(', ')}`);
  }
  if (sum.objective && sum.objective !== prevSummary.objective) {
    logEvent('milestone', { kind: 'objective', objective: sum.objective });
    pushFeed(`>>> objective: ${sum.objective.slice(0, 90)}`);
  }
  if (sum.cleared && !cleared) {
    cleared = true;
    logEvent('milestone', { kind: 'game-cleared', state: sum });
    pushFeed('*** GAME CLEARED - ending reached ***');
  }
  prevSummary = sum;
}

// Detectors run on state that is already loaded, so findings from them are
// queued and flushed after lastStatus is set (recordFinding snapshots state).
const pendingAuto = [];
function autoFinding(input) {
  pendingAuto.push({ ...input, source: 'auto', reproduced: true });
}

async function flushAuto() {
  while (pendingAuto.length) {
    const next = pendingAuto.shift();
    await recordFinding(next);
  }
}

async function getState() {
  const s = await page.evaluate(() => window.__PM.state());
  for (const a of checkAnomalies(s)) {
    stats.anomalies++;
    logEvent('anomaly', { message: a, state: stateSummary(s) });
    pushFeed(`!! ANOMALY: ${a}`);
    autoFinding({
      severity: 'major',
      category: 'logic',
      title: `invalid game state: ${a}`,
      expected: 'game state invariants hold at all times',
      actual: a,
    });
  }
  for (const t of checkText(s)) {
    autoFinding({
      severity: 'minor',
      category: 'text',
      title: `placeholder "${t.marker}" leaked into ${t.where}`,
      expected: 'player-facing text contains no code placeholders',
      actual: `${t.where}: ${t.text.slice(0, 200)}`,
    });
  }
  const stalledMs = checkStall(s);
  if (stalledMs) {
    autoFinding({
      severity: 'blocker',
      category: 'performance',
      title: 'game loop stopped advancing frames',
      expected: 'playFrames keeps increasing while in overworld/battle',
      actual: `playFrames stuck at ${s.playFrames} for ${Math.round(stalledMs / 1000)}s in mode ${s.mode}`,
    });
  }
  lastStatus = s;
  detectMilestones(stateSummary(s));
  await flushAuto();
  return s;
}

async function updateOverlay() {
  if (!page || page.isClosed()) return;
  const s = lastStatus;
  await page
    .evaluate(
      (payload) => window.__PM_OVERLAY?.update(payload),
      {
        meta: RUN_META,
        speed,
        status: s ? { mode: s.mode, map: s.map, x: s.x, y: s.y, money: s.money, badges: s.badges } : null,
        feed,
        note: agentNote,
      },
    )
    .catch(() => {});
}

function trackStuck(s, actionDesc) {
  const menuPath = Array.isArray(s.menu?.indexPath)
    ? s.menu.indexPath.join('>')
    : Array.isArray(s.menu?.path)
      ? s.menu.path.join('>')
      : s.menu?.path ?? s.menu?.indexPath ?? s.menu?.index ?? '';
  const normalizedDialogue = String(s.dialogue ?? '').replace(/\s+/g, ' ').trim().slice(0, 220);
  const normalizedBattleMessage = String(s.battle?.message ?? '').replace(/\s+/g, ' ').trim().slice(0, 220);
  const hpSum = (s.party ?? []).reduce((sum, mon) => sum + Math.max(0, Number(mon.hp ?? 0)), 0);
  const key = [
    s.mode,
    s.map,
    `${s.x},${s.y}`,
    `menu:${s.menu?.title ?? ''}:${menuPath}`,
    `dialogue:${normalizedDialogue}`,
    `battle:${s.battle?.phase ?? ''}:${normalizedBattleMessage}`,
    `hp:${hpSum}`,
    `money:${s.money ?? 0}`,
    `badges:${Array.isArray(s.badges) ? s.badges.length : 0}`,
  ].join('|');
  if (key === lastStuckFingerprint) {
    samePosStreak++;
  } else {
    samePosStreak = 0;
    stuckWarned = false;
  }
  lastStuckFingerprint = key;
  if (samePosStreak >= 12 && !stuckWarned) {
    stuckWarned = true;
    stats.warnings++;
    logEvent('warning', { kind: 'stuck', message: `position unchanged across ${samePosStreak} actions`, lastAction: actionDesc, state: stateSummary(s) });
    pushFeed(`!! STUCK? no movement for ${samePosStreak} actions`);
    autoFinding({
      severity: 'major',
      category: 'softlock',
      title: `no movement for ${samePosStreak} consecutive actions in ${s.map}`,
      expected: 'player actions eventually change position or mode',
      actual: `stuck at ${s.map} (${s.x},${s.y}) in mode ${s.mode}; last action ${actionDesc}`,
    });
  }
}

// Agents fire tool calls in parallel batches; without serialization two
// requests interleave keypresses on the same page and report each other's
// positions (observed as bogus walked/blocked values).
let opChain = Promise.resolve();
function withPageLock(fn) {
  const result = opChain.then(fn, fn);
  opChain = result.then(
    () => {},
    () => {},
  );
  return result;
}

// ---------- in-page drivers (ports of tests/helpers.ts, speed-aware) ----------
const pressDelay = () => Math.max(15, Math.round(60 / speed));
const loopDelay = () => Math.max(15, Math.round(50 / speed));

// Batched presses can open and close a dialogue box between two keys, leaving
// no trace in the final state. Agents then conclude the NPC said nothing, so
// every key press records the text that was on screen after it.
function collectText(seen, s) {
  if (!s) return;
  const add = (t) => {
    if (!t || seen.length >= 40) return;
    const txt = String(t).slice(0, 200);
    if (seen[seen.length - 1] !== txt) seen.push(txt);
  };
  add(s.dialogue);
  add(s.battle?.message);
}

// A press is only queued; the game loop consumes it on a later frame. Waiting
// a fixed few ms is a race at high speed (pressDelay can be under one frame),
// which made dialogue that opened and closed inside a batch invisible.
async function nextFrames(count = 2) {
  await page.evaluate(
    (n) =>
      new Promise((resolve) => {
        let seen = 0;
        const tick = () => (++seen >= n ? resolve(null) : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    count,
  );
}

async function pressKeys(keys) {
  const textSeen = [];
  let s = await getState();
  collectText(textSeen, s);
  for (const k of keys) {
    await page.evaluate((kk) => window.__PM.press(kk), k);
    stats.keysPressed++;
    await nextFrames();
    s = await getState();
    collectText(textSeen, s);
    await page.waitForTimeout(pressDelay());
  }
  return { state: s, textSeen };
}

async function waitMode(mode, timeout = 15000) {
  await page.waitForFunction((m) => window.__PM.state().mode === m, mode, { timeout });
}

async function waitIdle(timeout = 10000) {
  await page.waitForFunction(() => !window.__PM.state().moving, undefined, { timeout });
}

async function advanceDialogue(maxPages = 60) {
  for (let i = 0; i < maxPages; i++) {
    const s = await getState();
    if (s.mode !== 'dialogue') return;
    await pressKeys(['a']);
    await page.waitForTimeout(Math.max(20, Math.round(80 / speed)));
  }
}

async function stepOnce(dir) {
  const before = await page.evaluate(() => {
    const s = window.__PM.state();
    return { map: s.map, x: s.x, y: s.y, mode: s.mode };
  });
  await page.evaluate((k) => window.__PM.press(k), dir);
  stats.keysPressed++;
  // The press sits in a queue for a frame or two. Without waiting for it to be
  // consumed, the idle check below passes instantly and a step that did move
  // gets reported as blocked. A genuinely blocked step never changes anything,
  // so the timeout is the "wall/NPC" signal.
  await page
    .waitForFunction(
      (b) => {
        const s = window.__PM.state();
        return s.moving || s.mode !== b.mode || s.x !== b.x || s.y !== b.y || s.map !== b.map;
      },
      before,
      { timeout: Math.max(120, Math.round(400 / speed)) },
    )
    .catch(() => {});
  await page.waitForFunction(
    () => {
      const s = window.__PM.state();
      return (!s.moving && s.mode === 'overworld') || s.mode !== 'overworld';
    },
    undefined,
    { timeout: 8000 },
  );
  await page.waitForTimeout(Math.max(10, Math.round(40 / speed)));
  return getState();
}

const posOf = (s) => ({ map: s.map, x: s.x, y: s.y });

async function walkTiles(dir, tiles) {
  let s = await getState();
  const from = posOf(s);
  const textSeen = [];
  let walked = 0;
  for (let i = 0; i < tiles; i++) {
    const before = `${s.map}:${s.x},${s.y}`;
    s = await stepOnce(dir);
    stats.tilesWalked++;
    collectText(textSeen, s);
    const after = `${s.map}:${s.x},${s.y}`;
    if (after !== before) walked++;
    if (s.mode !== 'overworld') return { state: s, from, to: posOf(s), walked, blocked: false, interrupted: s.mode, textSeen };
    if (after === before) return { state: s, from, to: posOf(s), walked, blocked: true, textSeen };
  }
  return { state: s, from, to: posOf(s), walked, blocked: false, textSeen };
}

async function settle(maxIter = 200) {
  for (let i = 0; i < maxIter; i++) {
    const s = await getState();
    if (s.mode === 'overworld' || s.mode === 'ending' || s.mode === 'battle' || s.mode === 'title') return s;
    if (s.mode === 'dialogue') {
      await pressKeys(['a']);
    } else if (s.mode === 'menu') {
      if (s.menu && s.menu.title.includes('wants to learn')) {
        await pressKeys(['up', 'a']);
      } else {
        await pressKeys(['b']);
      }
    } else if (s.mode === 'summary' || s.mode === 'dex' || s.mode === 'intro') {
      await pressKeys(['b']);
    } else {
      return s;
    }
    await page.waitForTimeout(pressDelay());
  }
  return getState();
}

let lastBattleMessage = null;
let repeatedMessage = 0;

async function battleLoop(opts = {}) {
  const messages = [];
  const maxIter = (opts.maxTurns ?? 60) * 12;
  lastBattleMessage = null;
  repeatedMessage = 0;
  // The battle object is gone by the time the loop exits, so the outcome
  // ('win' | 'lose' | 'caught' | 'run') has to be captured while it is live.
  let outcome = null;
  for (let i = 0; i < maxIter; i++) {
    const s = await getState();
    if (!s.battle || s.mode !== 'battle') {
      const after = opts.skipSettle ? s : await settle();
      return { messages, outcome, state: stateSummary(after) };
    }
    const b = s.battle;
    if (b.outcome) outcome = b.outcome;
    if (b.phase === 'msg') {
      if (b.message && messages[messages.length - 1] !== b.message) messages.push(b.message);
      if (b.message && b.message === lastBattleMessage) {
        repeatedMessage++;
        if (repeatedMessage === 14) {
          autoFinding({
            severity: 'blocker',
            category: 'softlock',
            title: 'battle message repeats without advancing',
            expected: 'pressing A advances battle messages',
            actual: `"${String(b.message).slice(0, 120)}" repeated ${repeatedMessage} times in phase msg`,
          });
        }
      } else {
        lastBattleMessage = b.message;
        repeatedMessage = 0;
      }
      await pressKeys(['a']);
    } else if (b.phase === 'action') {
      await pressKeys(['a']);
    } else if (b.phase === 'moves') {
      const usable = b.active.moves.filter((m) => m.pp > 0);
      if (usable.length === 0) {
        await pressKeys(['a']);
      } else {
        let moveIndex = null;
        if (opts.preferMoves) {
          for (const pm of opts.preferMoves) {
            const idx = b.active.moves.findIndex((m) => m.id === pm && m.pp > 0);
            if (idx >= 0) {
              moveIndex = idx;
              break;
            }
          }
        }
        if (moveIndex === null) {
          if (opts.moveIndex !== undefined && b.active.moves[opts.moveIndex]?.pp > 0) {
            moveIndex = opts.moveIndex;
          } else {
            // Prefer the strongest damaging move over status moves (Growl, etc.)
            const damaging = b.active.moves
              .map((m, i) => ({ i, category: m.category, power: m.power }))
              .filter((m) => b.active.moves[m.i].pp > 0 && m.category !== 'status');
            if (damaging.length > 0) {
              damaging.sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
              moveIndex = damaging[0].i;
            } else {
              moveIndex = b.active.moves.findIndex((m) => m.pp > 0);
            }
          }
        }
        await pressKeys([...Array(moveIndex).fill('down'), 'a']);
      }
    } else if (b.phase === 'party') {
      const idx = s.party.findIndex((m) => m.hp > 0 && !m.isEgg);
      await pressKeys([...Array(Math.max(0, idx)).fill('down'), 'a']);
    } else if (b.phase === 'bag') {
      await pressKeys(['b']);
    }
    await page.waitForTimeout(loopDelay());
  }
  throw new Error('battleLoop did not finish; messages: ' + messages.join(' | '));
}

// A cold start (no localStorage) plays the intro movie before the title; 'b'
// skips it. Only the first load of an origin ever sees this.
async function skipIntro(maxTries = 25) {
  for (let i = 0; i < maxTries; i++) {
    const mode = await page.evaluate(() => window.__PM.state().mode);
    if (mode !== 'intro') return;
    await pressKeys(['b']);
    await page.waitForTimeout(pressDelay());
  }
}

// Grind loop: pace back and forth over grass, auto-running every wild battle,
// until the party lead hits targetLevel or the battle/blackout budget runs out.
async function grind(opts = {}) {
  const targetLevel = opts.targetLevel ?? null;
  const maxBattles = Math.min(opts.maxBattles ?? 12, 40);
  const preferMoves = opts.preferMoves;
  const out = { battles: 0, wins: 0, losses: 0, caught: 0, fled: 0, blackouts: 0, levels: [], stoppedBecause: 'budget' };
  const leadLevel = (s) => (s.party[0] ? s.party[0].level : 0);
  let s = await getState();
  const startLevel = leadLevel(s);
  const startMap = s.map;

  if (targetLevel !== null && startLevel >= targetLevel) {
    out.stoppedBecause = 'already-at-target';
    return { ...out, state: s };
  }

  // Find grass tiles near the player so we can pace on them without
  // wandering off-map through warps (the previous version rotated through
  // all 4 directions and routinely walked into other maps).
  const mapInfo = await page.evaluate(() => window.__PM.debug.mapInfo());
  const tiles = mapInfo.tiles;
  const isGrass = (x, y) =>
    y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length && tiles[y][x] === 'G';

  // Find a grass tile at or near the player
  let gx = s.x;
  let gy = s.y;
  if (!isGrass(gx, gy)) {
    let found = false;
    for (let radius = 1; radius <= 6 && !found; radius++) {
      for (let dy = -radius; dy <= radius && !found; dy++) {
        for (let dx = -radius; dx <= radius && !found; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          if (isGrass(s.x + dx, s.y + dy)) {
            gx = s.x + dx;
            gy = s.y + dy;
            found = true;
          }
        }
      }
    }
    if (!found) {
      out.stoppedBecause = 'no-grass';
      return { ...out, state: s };
    }
    // Walk to the grass tile one step at a time
    while (s.x !== gx || s.y !== gy) {
      const dir = s.x < gx ? 'right' : s.x > gx ? 'left' : s.y < gy ? 'down' : s.y > gy ? 'up' : null;
      if (!dir) break;
      const r = await walkTiles(dir, 1);
      s = r.state;
      if (s.map !== startMap) {
        out.stoppedBecause = 'left-map';
        return { ...out, state: s };
      }
      if (r.blocked || s.mode !== 'overworld') break;
    }
  }

  // Find a pacing direction: prefer a direction where the adjacent tile is
  // also grass so every step triggers an encounter check.
  const opp = { left: 'right', right: 'left', up: 'down', down: 'up' };
  const candidates = [
    { dir: 'left', dx: -1, dy: 0 },
    { dir: 'right', dx: 1, dy: 0 },
    { dir: 'up', dx: 0, dy: -1 },
    { dir: 'down', dx: 0, dy: 1 },
  ];
  let paceDir = 'left';
  for (const c of candidates) {
    if (isGrass(gx + c.dx, gy + c.dy)) {
      paceDir = c.dir;
      break;
    }
  }

  // Main grind loop: pace 1 tile back and forth on grass
  let toggle = false;
  for (let i = 0; i < maxBattles * 80; i++) {
    s = await getState();
    if (s.map !== startMap) {
      out.stoppedBecause = 'left-map';
      return { ...out, state: s };
    }
    if (s.mode === 'battle') {
      const r = await battleLoop({ preferMoves, maxTurns: opts.maxTurns ?? 40 });
      out.battles++;
      if (r.outcome === 'win') out.wins++;
      else if (r.outcome === 'lose') out.losses++;
      else if (r.outcome === 'caught') out.caught++;
      else if (r.outcome === 'run') out.fled++;
      s = await getState();
      out.levels = s.party.map((m) => `${m.species} L${m.level}`);
      // A map change after a battle always means a blackout (the game warps
      // the player to the heal point and heals the party before we can check).
      if (s.map !== startMap) {
        out.blackouts++;
        out.stoppedBecause = 'blackout';
        return { ...out, state: s };
      }
      if (s.party.every((m) => m.hp <= 0 || m.isEgg)) {
        out.blackouts++;
        out.stoppedBecause = 'blackout';
        return { ...out, state: await settle() };
      }
      if (targetLevel !== null && leadLevel(s) >= targetLevel) {
        out.stoppedBecause = 'target-level';
        return { ...out, state: s };
      }
      if (out.battles >= maxBattles) {
        out.stoppedBecause = 'max-battles';
        return { ...out, state: s };
      }
      continue;
    }
    if (s.mode !== 'overworld') {
      await settle();
      continue;
    }
    // Pace 1 tile back and forth
    const dir = toggle ? opp[paceDir] : paceDir;
    toggle = !toggle;
    const r = await walkTiles(dir, 1);
    if (r.state.map !== startMap) {
      out.stoppedBecause = 'left-map';
      return { ...out, state: r.state };
    }
    if (r.blocked || r.walked === 0) {
      // Blocked - try the opposite direction next iteration
      toggle = !toggle;
    }
  }
  out.stoppedBecause = 'step-budget';
  return { ...out, state: await getState() };
}

// Load the game's autosave instead of starting over, so a long clear attempt
// can span several runs.
async function continueGame(noEncounters = false) {
  const params = new URLSearchParams();
  if (noEncounters) params.set('noenc', '1');
  expectReload = true;
  await page.goto(`http://localhost:${VITE_PORT}/?${params}`);
  await page.waitForFunction(() => !!window.__PM);
  if (speed !== 1) await page.evaluate((n) => window.__PM.debug.setSpeed(n), speed);
  await skipIntro();
  await waitMode('title');
  const title = await page.evaluate(() => window.__PM.state().title);
  const idx = title?.options.indexOf('CONTINUE') ?? -1;
  if (idx < 0) throw new Error('no save found to continue from; call new-game instead');
  await pressKeys([...Array(Math.max(0, idx - (title.index ?? 0))).fill('down'), 'a']);
  await waitMode('overworld');
  return getState();
}

async function newGame(seed, starterIndex = 0, noEncounters = false) {
  const params = new URLSearchParams();
  if (seed !== null && seed !== undefined) params.set('seed', String(seed));
  if (noEncounters) params.set('noenc', '1');
  expectReload = true;
  await page.goto(`http://localhost:${VITE_PORT}/?${params}`);
  await page.waitForFunction(() => !!window.__PM);
  await page.evaluate(() => window.__PM.debug.clearSave());
  if (speed !== 1) await page.evaluate((n) => window.__PM.debug.setSpeed(n), speed);
  await skipIntro();
  await waitMode('title');
  await pressKeys(['a']);
  await waitMode('dialogue');
  await advanceDialogue();
  await waitMode('overworld');
  await walkTiles('up', 2);
  await pressKeys(['a']);
  await waitMode('dialogue');
  await advanceDialogue();
  await waitMode('menu');
  await pressKeys([...Array(starterIndex).fill('down'), 'a']);
  await page.waitForFunction(() => window.__PM.state().menu?.items.includes('YES'));
  await pressKeys(['a']);
  await waitMode('dialogue');
  await advanceDialogue();
  await waitMode('overworld');
  return getState();
}

// ---------- findings report ----------
const SEVERITY_ORDER = { blocker: 0, major: 1, minor: 2, polish: 3, question: 4, good: 5 };

function writeFindings() {
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.index - b.index,
  );
  fs.writeFileSync(
    path.join(RUN_DIR, 'findings.json'),
    JSON.stringify({ runId: RUN_ID, meta: RUN_META, count: sorted.length, findings: sorted }, null, 2),
  );

  const lines = [`# Findings: ${RUN_ID}`, ''];
  const bySeverity = SEVERITIES.map((sev) => [sev, sorted.filter((f) => f.severity === sev)]).filter(
    ([, list]) => list.length,
  );
  lines.push(
    `Total ${sorted.length} (` + bySeverity.map(([sev, list]) => `${list.length} ${sev}`).join(', ') + ')',
  );
  lines.push('');
  lines.push('| # | severity | area | category | title | seen | repro |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const f of sorted) {
    lines.push(
      `| ${f.index} | ${f.severity} | ${f.area} | ${f.category} | ${f.title.replace(/\|/g, '/')} | ${f.occurrences}x | ${f.reproduced ? 'confirmed' : 'once'} |`,
    );
  }

  for (const f of sorted) {
    lines.push('', `## ${f.index}. [${f.severity}/${f.area}/${f.category}] ${f.title}`, '');
    if (f.expected) lines.push(`- expected: ${f.expected}`);
    if (f.actual) lines.push(`- actual: ${f.actual}`);
    lines.push(`- source: ${f.source} | occurrences: ${f.occurrences} | reproduced: ${f.reproduced}`);
    lines.push(`- fingerprint: \`${f.print}\``);
    if (f.screenshot) lines.push(`- screenshot: \`${f.screenshot}\``);
    if (f.detail) lines.push('', f.detail);
    const r = f.repro;
    if (r) {
      lines.push('', '<details><summary>repro context</summary>', '');
      lines.push('```');
      lines.push(`seed: ${r.seed ?? 'random'} | speed: ${r.speed}x`);
      if (r.state) lines.push(`state: ${r.state.mode} @ ${r.state.map} (${r.state.x},${r.state.y}) money ${r.state.money} badges ${r.state.badges.length}`);
      if (r.state?.party?.length) lines.push(`party: ${r.state.party.join(', ')}`);
      if (r.state?.objective) lines.push(`objective: ${r.state.objective}`);
      lines.push('preceding tool calls:');
      for (const c of r.recentToolCalls ?? []) {
        lines.push(`  ${c.tool}(${JSON.stringify(c.args ?? {})})${c.error ? ` -> ERROR ${c.error}` : ''}`);
      }
      lines.push('```');
      lines.push('', '</details>');
    }
  }
  fs.writeFileSync(path.join(RUN_DIR, 'findings.md'), lines.join('\n'));
  return sorted;
}

// Cross-run rollup so a fingerprint seen in several runs is obviously the same
// defect rather than N separate tickets.
function updateFindingsIndex() {
  fs.mkdirSync(INDEX_DIR, { recursive: true });
  const indexPath = path.join(INDEX_DIR, 'findings-index.json');
  let index;
  try {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch {
    index = {};
  }
  for (const f of findings) {
    const entry = index[f.print] ?? {
      print: f.print,
      severity: f.severity,
      area: f.area,
      category: f.category,
      title: f.title,
      runs: [],
      totalOccurrences: 0,
      status: 'open',
    };
    entry.status ??= 'open';
    if (!entry.runs.includes(RUN_ID)) entry.runs.push(RUN_ID);
    entry.totalOccurrences += f.occurrences;
    entry.lastSeenAt = f.lastSeenAt;
    // If a fingerprint was marked "fixed" but appears in a new run,
    // the fix didn't work - flip to "regressed".
    if (entry.status === 'fixed') {
      entry.status = 'regressed';
    }
    index[f.print] = entry;
  }
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  fs.writeFileSync(path.join(INDEX_DIR, 'findings-index.md'), renderFindingsIndexMd(index));

  return index;
}

// ---------- report ----------
function buildReport(status, summary, usage) {
  const cost = computeCost(usage, RUN_META.model);
  const unknownModelPricing = !!usage && !!RUN_META.model && !cost;
  if (unknownModelPricing && !events.some((e) => e.type === 'warning' && e.kind === 'unknown-model-pricing' && e.model === RUN_META.model)) {
    stats.warnings++;
    logEvent('warning', { kind: 'unknown-model-pricing', model: RUN_META.model });
  }

  const endedAt = new Date().toISOString();
  const durationMs = Date.parse(endedAt) - Date.parse(RUN_META.startedAt);
  const anomalies = events.filter((e) => e.type === 'anomaly');
  const warnings = events.filter((e) => e.type === 'warning');
  const milestones = events.filter((e) => e.type === 'milestone');
  const agentNotes = events.filter((e) => e.type === 'agent_note');
  const agentMessages = events.filter((e) => e.type === 'agent_message');
  const toolResults = events.filter((e) => e.type === 'tool_result');
  // File/shell tools the agent used outside the pm_* surface. Reading the game
  // source turns a blind playthrough into a sighted one, so any of these make
  // discoverability findings from this run untrustworthy.
  const outsideTools = events
    .filter((e) => e.type === 'agent_tool' || e.type === 'agent_shell')
    .map((e) => e.tool ?? e.command ?? 'unknown');
  const report = {
    meta: { ...RUN_META, speedFinal: speed, endedAt, durationMs, status },
    finalState: lastStatus ? stateSummary(lastStatus) : null,
    stats,
    outsideToolCalls: outsideTools.slice(0, 40),
    usage: usage ?? null,
    cost,
    summary: summary ?? null,
    milestones,
    anomalies,
    warnings,
    findings: writeFindings(),
    agentNotes: agentNotes.map((e) => e.text),
  };
  updateFindingsIndex();
  fs.writeFileSync(path.join(RUN_DIR, 'report.json'), JSON.stringify(report, null, 2));

  const lines = [];
  lines.push(`# Agent Run Report: ${RUN_ID}`);
  lines.push('');
  lines.push(`- status: **${status}**`);
  if (RUN_META.profile) lines.push(`- profile: ${RUN_META.profile}`);
  if (RUN_META.model) lines.push(`- model: ${RUN_META.model} | reasoning effort: ${RUN_META.effort ?? 'default'}`);
  if (RUN_META.goal) lines.push(`- goal: ${RUN_META.goal}`);
  lines.push(
    `- seed: ${RUN_META.seed ?? 'random'} | speed: ${RUN_META.speed}x start -> ${speed}x final | headless: ${RUN_META.headless}`,
  );
  lines.push(`- duration: ${(durationMs / 1000).toFixed(1)}s | tool calls: ${toolResults.length} | keys: ${stats.keysPressed} | tiles: ${stats.tilesWalked} | battles: ${stats.battlesRun}`);
  if (usage) lines.push(`- tokens: in ${usage.input_tokens ?? '?'} (cached ${usage.cached_input_tokens ?? 0}) / out ${usage.output_tokens ?? '?'}`);
  if (report.cost) lines.push(`- cost: $${report.cost.total.toFixed(2)} (input $${report.cost.inputCost.toFixed(2)} + cached $${report.cost.cachedCost.toFixed(2)} + output $${report.cost.outputCost.toFixed(2)})`);
  else if (unknownModelPricing) lines.push('- cost: unknown (model not in pricing table)');
  if (outsideTools.length) {
    lines.push(
      '',
      `> **WARNING:** the agent made ${outsideTools.length} tool call(s) outside the pm_* surface (${[...new Set(outsideTools)].slice(0, 6).join(', ')}).`,
      '> It may have read the game source instead of discovering things by playing. Treat discoverability and UX findings from this run as unverified.',
    );
  }
  if (summary) {
    lines.push('');
    lines.push('## Agent Summary');
    lines.push(summary);
  }
  if (report.finalState) {
    const f = report.finalState;
    lines.push('');
    lines.push('## Final State');
    lines.push(`- mode: ${f.mode} | map: ${f.map} (${f.x},${f.y}) | money: ${f.money} | badges: ${f.badges.length}`);
    lines.push(`- party: ${f.party.join(', ') || '(empty)'}`);
    lines.push(`- dex: seen ${f.seen} / caught ${f.caught} | storage: ${f.storage}`);
  }
  if (milestones.length) {
    lines.push('');
    lines.push('## Milestones');
    for (const m of milestones) {
      lines.push(`- [${m.ts.slice(11, 19)}] ${m.kind}: ${m.kind === 'map-change' ? `${m.from} -> ${m.to}` : JSON.stringify({ ...m, seq: undefined, ts: undefined, type: undefined, kind: undefined })}`);
    }
  }
  if (report.findings.length) {
    lines.push('');
    lines.push('## Findings');
    lines.push(`See findings.md for full repro context and screenshots.`);
    for (const f of report.findings) {
      lines.push(`- [${f.severity}/${f.area}/${f.category}] ${f.title}${f.occurrences > 1 ? ` (${f.occurrences}x)` : ''}`);
    }
  }
  if (agentNotes.length) {
    lines.push('');
    lines.push('## Free-form Notes');
    for (const n of agentNotes) lines.push(`- [${n.ts.slice(11, 19)}] ${n.text}`);
  }
  if (anomalies.length) {
    lines.push('');
    lines.push('## Anomalies');
    for (const a of anomalies) lines.push(`- [${a.ts.slice(11, 19)}] ${a.message}`);
  }
  if (warnings.length) {
    lines.push('');
    lines.push('## Warnings');
    for (const w of warnings) lines.push(`- [${w.ts.slice(11, 19)}] ${w.message}`);
  }
  if (agentMessages.length) {
    lines.push('');
    lines.push('## Last Agent Message');
    lines.push(agentMessages[agentMessages.length - 1].text ?? '');
  }
  fs.writeFileSync(path.join(RUN_DIR, 'report.md'), lines.join('\n'));
  return report;
}

// ---------- boot ----------
async function waitForVite(timeoutMs = 45000) {
  const url = `http://localhost:${VITE_PORT}/`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`vite ${FROZEN ? 'preview' : 'dev'} server did not come up on port ${VITE_PORT}`);
}

function buildOnce() {
  return new Promise((resolve, reject) => {
    const p = spawn('npx', ['vite', 'build'], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += String(d)));
    p.stdout.on('data', () => {});
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`vite build failed (${code}): ${err.slice(-600)}`))));
  });
}

async function boot() {
  // A dev server reloads the page whenever anyone edits src/, which wipes the
  // agent's progress mid-run. Serving a build freezes the game for the run.
  if (FROZEN) {
    logEvent('build_start', {});
    await buildOnce();
  }
  const viteArgs = FROZEN
    ? ['vite', 'preview', '--port', String(VITE_PORT), '--strictPort']
    : ['vite', '--port', String(VITE_PORT), '--strictPort'];
  viteProc = spawn('npx', viteArgs, {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  viteProc.stdout.on('data', () => {});
  viteProc.stderr.on('data', (d) => {
    const s = String(d);
    if (s.toLowerCase().includes('error')) logEvent('warning', { kind: 'vite', message: s.slice(0, 300) });
  });
  await waitForVite();

  browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1200, height: 700 } });
  // the page declares no favicon, and the browser's automatic request would
  // otherwise show up in every run report as a 404 warning
  await context.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }));
  await context.addInitScript(OVERLAY_INIT);
  page = await context.newPage();
  page.on('pageerror', (err) => {
    logEvent('anomaly', { kind: 'pageerror', message: String(err).slice(0, 500) });
    stats.anomalies++;
    autoFinding({
      severity: 'blocker',
      category: 'crash',
      area: 'game',
      title: `uncaught exception: ${String(err.message ?? err).slice(0, 90)}`,
      expected: 'the game runs without uncaught exceptions',
      actual: String(err.stack ?? err).slice(0, 800),
    });
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // favicon/devtools probes 404 in dev and are not game defects
    if (/favicon|\.map\b/i.test(text) && /404/.test(text)) return;
    stats.warnings++;
    logEvent('warning', { kind: 'console', message: text.slice(0, 300) });
  });
  page.on('requestfailed', (req) => {
    if (/favicon/i.test(req.url())) return;
    logEvent('warning', { kind: 'request-failed', url: req.url(), message: req.failure()?.errorText ?? 'failed' });
    stats.warnings++;
  });

  const params = new URLSearchParams();
  if (RUN_META.seed !== null) params.set('seed', String(RUN_META.seed));
  expectReload = true;
  await page.goto(`http://localhost:${VITE_PORT}/?${params}`);
  await page.waitForFunction(() => !!window.__PM);
  page.on('load', () => {
    if (expectReload) {
      expectReload = false;
      return;
    }
    stats.warnings++;
    prevSummary = null;
    logEvent('warning', {
      kind: 'page-reload',
      message: 'page reloaded outside of new-game (vite HMR on a source edit, or a crash); all game progress was reset to the title screen',
    });
    pushFeed('!! page reloaded - progress reset');
    autoFinding({
      severity: 'major',
      category: 'crash',
      area: 'environment',
      title: 'page reloaded outside of a navigation and reset unsaved progress',
      expected: 'the live page stays loaded for the whole run',
      actual:
        'the page fired a load event mid-run, resetting the game to the title screen; usually a vite HMR reload caused by editing src/ during the run (use --build for long runs), otherwise a hard crash',
    });
  });
  if (speed !== 1) await page.evaluate((n) => window.__PM.debug.setSpeed(n), speed);
  await getState();
  pushFeed(`run ${RUN_ID} started (speed ${speed}x${HEADLESS ? ', headless' : ''})`);
  await updateOverlay();
  logEvent('run_start', { meta: RUN_META });
}

async function shutdown(code = 0) {
  try {
    if (browser) await browser.close();
  } catch {
    // ignore
  }
  try {
    if (viteProc) viteProc.kill('SIGTERM');
  } catch {
    // ignore
  }
  logStream.end();
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// ---------- HTTP API ----------
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(body);
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) data += chunk;
  if (!data) return {};
  return JSON.parse(data);
}

function recordTool(tool, toolArgs, fn) {
  return withPageLock(() => runTool(tool, toolArgs, fn));
}

async function runTool(tool, toolArgs, fn) {
  const start = Date.now();
  logEvent('tool_call', { tool, args: toolArgs });
  stats.toolCalls[tool] = (stats.toolCalls[tool] ?? 0) + 1;
  try {
    const result = await fn();
    const s = result?.state ?? (result === undefined ? await getState() : null);
    if (s) trackStuck(s, tool);
    await flushAuto();
    const durationMs = Date.now() - start;
    logEvent('tool_result', { tool, durationMs, result: summarizeResult(result), state: s ? stateSummary(s) : null });
    pushFeed(describeTool(tool, toolArgs, result));
    await updateOverlay();
    return { ok: true, ...(result ?? {}), state: result?.state ? stateSummary(result.state) : s ? stateSummary(s) : null };
  } catch (err) {
    const durationMs = Date.now() - start;
    logEvent('tool_result', { tool, durationMs, error: String(err?.message ?? err).slice(0, 400) });
    pushFeed(`!! ${tool} failed: ${String(err?.message ?? err).slice(0, 120)}`);
    await updateOverlay();
    return { ok: false, error: String(err?.message ?? err) };
  }
}

function summarizeResult(result) {
  if (!result) return null;
  const r = { ...result };
  delete r.state;
  if (r.messages) r.messages = r.messages.slice(0, 40);
  if (r.textSeen) r.textSeen = r.textSeen.slice(0, 20);
  return r;
}

function describeTool(tool, a, result) {
  switch (tool) {
    case 'press': {
      const t = result?.textSeen?.length ? ` "${result.textSeen[0].slice(0, 56)}"` : '';
      return `press [${(a.keys ?? []).join(',')}]${t}`;
    }
    case 'walk':
      return `walk ${a.dir} x${a.tiles} = ${result?.walked ?? 0} tiles -> (${result?.to?.x},${result?.to?.y})${result?.blocked ? ' BLOCKED' : ''}${result?.interrupted ? ` -> ${result.interrupted}` : ''}`;
    case 'battle':
      return `battle (${result?.messages?.length ?? 0} msgs)`;
    case 'new-game':
      return `new game seed=${a.seed ?? 'rnd'} starter=${a.starterIndex ?? 0}`;
    case 'debug':
      return `debug.${a.action}(${JSON.stringify(a.args ?? [])})`;
    case 'speed':
      return `speed -> ${a.multiplier}x`;
    case 'wait':
      return `wait ${a.mode ?? 'idle'}`;
    default:
      return tool;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const route = `${req.method} ${url.pathname}`;
  try {
    if (route === 'GET /api/health') {
      return json(res, 200, { ok: true, runId: RUN_ID, pageOpen: !!page && !page.isClosed(), events: seq, speed, cleared });
    }
    if (route === 'GET /api/run-info') {
      return json(res, 200, {
        ok: true,
        meta: RUN_META,
        stats,
        runDir: RUN_DIR,
        cleared,
        digest: lastStatus ? stateSummary(lastStatus) : null,
        recentActions: reproTrail(8),
        milestones: events.filter((e) => e.type === 'milestone').slice(-8),
        findings: findings.map((f) => ({
          index: f.index,
          severity: f.severity,
          area: f.area,
          category: f.category,
          title: f.title,
          occurrences: f.occurrences,
          reproduced: f.reproduced,
        })),
      });
    }
    if (route === 'GET /api/state') {
      const s = await withPageLock(async () => {
        const st = await getState();
        await updateOverlay();
        return st;
      });
      return json(res, 200, { ok: true, state: stateSummary(s), raw: s });
    }
    if (route === 'GET /api/map') {
      const info = await withPageLock(() => page.evaluate(() => window.__PM.debug.mapInfo()));
      return json(res, 200, { ok: true, map: info });
    }
    if (route === 'GET /api/screenshot') {
      const buf = await withPageLock(() => page.screenshot());
      res.writeHead(200, { 'content-type': 'image/png' });
      return res.end(buf);
    }
    if (req.method !== 'POST') return json(res, 404, { ok: false, error: 'not found' });

    const body = await readBody(req);
    switch (route) {
      case 'POST /api/press': {
        const keys = body.keys ?? [body.key ?? 'a'];
        const out = await recordTool('press', { keys }, () => pressKeys(keys));
        return json(res, out.ok ? 200 : 500, out);
      }
      case 'POST /api/walk': {
        const out = await recordTool('walk', body, async () => walkTiles(body.dir, Number(body.tiles ?? 1)));
        return json(res, out.ok ? 200 : 500, out);
      }
      case 'POST /api/wait': {
        const out = await recordTool('wait', body, async () => {
          if (body.mode) await waitMode(body.mode, body.timeoutMs ?? 15000);
          else await waitIdle(body.timeoutMs ?? 10000);
          return { state: await getState() };
        });
        return json(res, out.ok ? 200 : 500, out);
      }
      case 'POST /api/battle': {
        const out = await recordTool('battle', body, async () => {
          stats.battlesRun++;
          const r = await battleLoop(body);
          return { ...r, state: lastStatus };
        });
        return json(res, out.ok ? 200 : 500, out);
      }
      case 'POST /api/new-game': {
        const out = await recordTool('new-game', body, async () => ({
          state: await newGame(body.seed ?? RUN_META.seed, Number(body.starterIndex ?? 0), body.noEncounters === true),
        }));
        return json(res, out.ok ? 200 : 500, out);
      }
      case 'POST /api/continue': {
        const out = await recordTool('continue', body, async () => ({
          state: await continueGame(body.noEncounters === true),
        }));
        return json(res, out.ok ? 200 : 500, out);
      }
      case 'POST /api/grind': {
        const out = await recordTool('grind', body, async () => grind(body));
        return json(res, out.ok ? 200 : 500, out);
      }
      case 'POST /api/debug': {
        const out = await recordTool('debug', body, async () => {
          const r = await page.evaluate(
            ({ action, args: a }) => window.__PM.debug[action](...(a ?? [])),
            { action: body.action, args: body.args },
          );
          return { debugResult: r ?? null, state: await getState() };
        });
        return json(res, out.ok ? 200 : 500, out);
      }
      case 'POST /api/speed': {
        speed = Math.max(0.25, Math.min(20, Number(body.multiplier ?? 1)));
        const out = await recordTool('speed', { multiplier: speed }, async () => {
          await page.evaluate((n) => window.__PM.debug.setSpeed(n), speed);
          return { state: await getState() };
        });
        return json(res, out.ok ? 200 : 500, out);
      }
      case 'POST /api/overlay-note': {
        agentNote = String(body.note ?? '');
        logEvent('agent_note', { text: agentNote });
        pushFeed(`note: ${agentNote.slice(0, 80)}`);
        await updateOverlay();
        return json(res, 200, { ok: true });
      }
      case 'POST /api/finding': {
        const record = await withPageLock(() => recordFinding(body));
        agentNote = `[${record.severity}/${record.area}] ${record.title}`;
        await updateOverlay();
        return json(res, 200, {
          ok: true,
          finding: {
            index: record.index,
            print: record.print,
            severity: record.severity,
            category: record.category,
            area: record.area,
            occurrences: record.occurrences,
            screenshot: record.screenshot,
            duplicate: record.occurrences > 1,
          },
          hint:
            record.occurrences > 1
              ? 'Already filed earlier in this run; occurrence count incremented instead of creating a duplicate.'
              : 'Filed with a screenshot and the preceding tool calls attached.',
          allowed: { severity: SEVERITIES, category: CATEGORIES, area: AREAS },
          invalidFields: record.invalidFields ?? null,
        });
      }
      case 'POST /api/log-event': {
        const type = String(body.type ?? 'agent_event').replace(/[^a-z_]/g, '');
        const data = { ...body };
        delete data.type;
        if (type === 'agent_message') {
          agentNote = String(data.text ?? '').slice(0, 420);
          updateOverlay();
        }
        logEvent(type, data);
        return json(res, 200, { ok: true });
      }
      case 'POST /api/finalize': {
        try {
          if (page && !page.isClosed()) {
            await withPageLock(() => page.screenshot({ path: path.join(RUN_DIR, 'final.png') }));
          }
        } catch {
          // ignore
        }
        const report = buildReport(String(body.status ?? 'completed'), body.summary, body.usage);
        logEvent('run_end', { status: body.status ?? 'completed' });
        return json(res, 200, {
          ok: true,
          report: { anomalies: report.anomalies.length, warnings: report.warnings.length, cost: report.cost },
          findings: report.findings.map((f) => ({
            severity: f.severity,
            area: f.area,
            category: f.category,
            title: f.title,
            occurrences: f.occurrences,
          })),
          runDir: RUN_DIR,
        });
      }
      default:
        return json(res, 404, { ok: false, error: 'not found' });
    }
  } catch (err) {
    logEvent('error', { message: String(err?.stack ?? err).slice(0, 600) });
    return json(res, 500, { ok: false, error: String(err?.message ?? err) });
  }
});

await boot();
server.listen(PORT, () => {
  console.log(`[pm-server] run ${RUN_ID}`);
  console.log(`[pm-server] api:  http://localhost:${PORT}/api`);
  console.log(`[pm-server] game: http://localhost:${VITE_PORT} (${HEADLESS ? 'headless' : 'headed, watch live'})`);
  console.log(`[pm-server] logs: ${RUN_DIR}`);
});
