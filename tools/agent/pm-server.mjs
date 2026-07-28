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
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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
const RUN_ID = String(args['run-id'] ?? new Date().toISOString().replace(/[:.]/g, '-'));
const RUN_META = {
  runId: RUN_ID,
  profile: args.profile ?? null,
  goal: args.goal ?? null,
  seed: args.seed !== undefined ? Number(args.seed) : null,
  speed: Number(args.speed ?? 1),
  model: args.model ?? null,
  effort: args.effort ?? null,
  headless: HEADLESS,
  startedAt: new Date().toISOString(),
};

// Deliberately not under test-results/: playwright wipes that directory on every run.
const RUN_DIR = path.join(REPO_ROOT, 'agent-runs', RUN_ID);
fs.mkdirSync(RUN_DIR, { recursive: true });

// ---------- event log ----------
let seq = 0;
const events = [];
const logStream = fs.createWriteStream(path.join(RUN_DIR, 'events.jsonl'), { flags: 'a' });
const KNOWN_MODES = new Set(['title', 'overworld', 'dialogue', 'menu', 'battle', 'ending', 'naming']);

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
let lastPosKey = null;
let expectReload = false;
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
};

function stateSummary(s) {
  if (!s) return null;
  return {
    mode: s.mode,
    map: s.map,
    x: s.x,
    y: s.y,
    money: s.money,
    badges: s.badges,
    party: s.party.map((m) => `${m.species} L${m.level} ${m.hp}/${m.maxHp}`),
    storage: s.storageCount,
    menu: s.menu ? `${s.menu.title} [${s.menu.index}]` : null,
    dialogue: s.dialogue ? s.dialogue.slice(0, 90) : null,
    battle: s.battle
      ? `${s.battle.phase} vs ${s.battle.enemy.species} L${s.battle.enemy.level} (${s.battle.enemy.hp}/${s.battle.enemy.maxHp})`
      : null,
    seen: s.seen,
    caught: s.caught,
    minute: s.minute,
  };
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
  }
  if (!KNOWN_MODES.has(s.mode)) out.push(`unknown mode: ${s.mode}`);
  return out;
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
  if (sum.party.length > prevSummary.party.length) {
    logEvent('milestone', { kind: 'party-add', party: sum.party });
    pushFeed(`+++ party now ${sum.party.length}: ${sum.party.join(', ')}`);
  }
  prevSummary = sum;
}

async function getState() {
  const s = await page.evaluate(() => window.__PM.state());
  const anomalies = checkAnomalies(s);
  for (const a of anomalies) {
    stats.anomalies++;
    logEvent('anomaly', { message: a, state: stateSummary(s) });
    pushFeed(`!! ANOMALY: ${a}`);
  }
  lastStatus = s;
  detectMilestones(stateSummary(s));
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
  const key = `${s.mode}:${s.map}:${s.x},${s.y}`;
  if (key === lastPosKey) {
    samePosStreak++;
  } else {
    samePosStreak = 0;
    stuckWarned = false;
  }
  lastPosKey = key;
  if (samePosStreak >= 12 && !stuckWarned) {
    stuckWarned = true;
    stats.warnings++;
    logEvent('warning', { kind: 'stuck', message: `position unchanged across ${samePosStreak} actions`, lastAction: actionDesc, state: stateSummary(s) });
    pushFeed(`!! STUCK? no movement for ${samePosStreak} actions`);
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

async function pressKeys(keys) {
  for (const k of keys) {
    await page.evaluate((kk) => window.__PM.press(kk), k);
    stats.keysPressed++;
    await page.waitForTimeout(pressDelay());
  }
  return getState();
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
  let walked = 0;
  for (let i = 0; i < tiles; i++) {
    const before = `${s.map}:${s.x},${s.y}`;
    s = await stepOnce(dir);
    stats.tilesWalked++;
    const after = `${s.map}:${s.x},${s.y}`;
    if (after !== before) walked++;
    if (s.mode !== 'overworld') return { state: s, from, to: posOf(s), walked, blocked: false, interrupted: s.mode };
    if (after === before) return { state: s, from, to: posOf(s), walked, blocked: true };
  }
  return { state: s, from, to: posOf(s), walked, blocked: false };
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
    } else {
      return s;
    }
    await page.waitForTimeout(pressDelay());
  }
  return getState();
}

async function battleLoop(opts = {}) {
  const messages = [];
  const maxIter = (opts.maxTurns ?? 60) * 12;
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
          moveIndex =
            opts.moveIndex !== undefined && b.active.moves[opts.moveIndex]?.pp > 0
              ? opts.moveIndex
              : b.active.moves.findIndex((m) => m.pp > 0);
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

async function newGame(seed, starterIndex = 0, noEncounters = true) {
  const params = new URLSearchParams();
  if (seed !== null && seed !== undefined) params.set('seed', String(seed));
  if (noEncounters) params.set('noenc', '1');
  expectReload = true;
  await page.goto(`http://localhost:${VITE_PORT}/?${params}`);
  await page.waitForFunction(() => !!window.__PM);
  await page.evaluate(() => window.__PM.debug.clearSave());
  if (speed !== 1) await page.evaluate((n) => window.__PM.debug.setSpeed(n), speed);
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

// ---------- report ----------
function buildReport(status, summary, usage) {
  const endedAt = new Date().toISOString();
  const durationMs = Date.parse(endedAt) - Date.parse(RUN_META.startedAt);
  const anomalies = events.filter((e) => e.type === 'anomaly');
  const warnings = events.filter((e) => e.type === 'warning');
  const milestones = events.filter((e) => e.type === 'milestone');
  const agentNotes = events.filter((e) => e.type === 'agent_note');
  const agentMessages = events.filter((e) => e.type === 'agent_message');
  const toolResults = events.filter((e) => e.type === 'tool_result');
  const report = {
    meta: { ...RUN_META, speedFinal: speed, endedAt, durationMs, status },
    finalState: lastStatus ? stateSummary(lastStatus) : null,
    stats,
    usage: usage ?? null,
    summary: summary ?? null,
    milestones,
    anomalies,
    warnings,
    agentNotes: agentNotes.map((e) => e.text),
  };
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
  if (agentNotes.length) {
    lines.push('');
    lines.push('## Agent Observations');
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
  throw new Error(`vite dev server did not come up on port ${VITE_PORT}`);
}

async function boot() {
  viteProc = spawn('npx', ['vite', '--port', String(VITE_PORT), '--strictPort'], {
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
  return r;
}

function describeTool(tool, a, result) {
  switch (tool) {
    case 'press':
      return `press [${(a.keys ?? []).join(',')}]`;
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
      return json(res, 200, { ok: true, runId: RUN_ID, pageOpen: !!page && !page.isClosed(), events: seq, speed });
    }
    if (route === 'GET /api/run-info') {
      return json(res, 200, { ok: true, meta: RUN_META, stats, runDir: RUN_DIR });
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
        const out = await recordTool('press', { keys }, async () => ({ state: await pressKeys(keys) }));
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
          state: await newGame(body.seed ?? RUN_META.seed, Number(body.starterIndex ?? 0), body.noEncounters !== false),
        }));
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
        return json(res, 200, { ok: true, report: { anomalies: report.anomalies.length, warnings: report.warnings.length }, runDir: RUN_DIR });
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
