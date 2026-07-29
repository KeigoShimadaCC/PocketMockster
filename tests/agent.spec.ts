import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// End-to-end test of the agent infrastructure (no LLM): boots pm-server
// (vite + headless browser + HTTP API + overlay + JSONL log), plays the game
// through the API exactly as an agent would, then validates logs/reports.
// Also verifies the MCP stdio server speaks JSON-RPC correctly against the
// running pm-server.

const API_PORT = 8798;
const VITE_PORT = 5198;
const PM_URL = `http://localhost:${API_PORT}`;
const RUN_ID = `e2e-${Date.now()}`;
const RUN_DIR = path.join(__dirname, '..', 'agent-runs', RUN_ID);
const SERVER_PATH = path.join(__dirname, '..', 'tools', 'agent', 'pm-server.mjs');
const MCP_PATH = path.join(__dirname, '..', 'tools', 'agent', 'pm-mcp.mjs');

let serverProc: ChildProcess;

async function api(pathname: string, body?: unknown): Promise<any> {
  const res = await fetch(`${PM_URL}${pathname}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.json();
}

async function waitHealth(timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await api('/api/health');
      if (r.ok && r.pageOpen) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('pm-server did not become healthy');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  serverProc = spawn(
    process.execPath,
    [
      SERVER_PATH,
      '--port', String(API_PORT),
      '--vite-port', String(VITE_PORT),
      '--run-id', RUN_ID,
      '--seed', '42',
      '--speed', '1',
      '--profile', 'e2e-script',
      '--goal', 'scripted e2e validation',
      '--headless',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  serverProc.stdout?.on('data', (d) => process.stdout.write(`[pm-server] ${d}`));
  serverProc.stderr?.on('data', (d) => process.stderr.write(`[pm-server:err] ${d}`));
  await waitHealth();
}, 100_000);

test.afterAll(async () => {
  serverProc?.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 500));
});

test('health, speed parameter takes effect, new game flow', async () => {
  test.setTimeout(120_000);
  const health = await api('/api/health');
  expect(health.ok).toBe(true);
  expect(health.pageOpen).toBe(true);

  const sp = await api('/api/speed', { multiplier: 4 });
  expect(sp.ok).toBe(true);
  const s0 = await api('/api/state');
  expect(s0.raw.speed).toBe(4);

  const ng = await api('/api/new-game', { seed: 42, starterIndex: 0, noEncounters: false });
  expect(ng.ok).toBe(true);
  expect(ng.state.mode).toBe('overworld');
  expect(ng.state.map).toBe('lab');
  expect(ng.state.party.length).toBe(1);
  expect(ng.state.party[0]).toContain('sproutle');

  // movement through the API (right stays in the lab; walking down would
  // trigger the scripted rival ambush)
  const w = await api('/api/walk', { dir: 'right', tiles: 1 });
  expect(w.ok).toBe(true);
  expect(w.state.mode).toBe('overworld');
  expect(w.state.x).toBe(6);
});

// A live agent batches tool calls, so concurrent requests must not interleave
// keypresses (that produced bogus walked/blocked results before serialization).
test('concurrent tool calls are serialized and report consistent positions', async () => {
  const before = await api('/api/state');
  const startX = before.raw.x;

  const [left, s1, right, s2] = await Promise.all([
    api('/api/walk', { dir: 'left', tiles: 1 }),
    api('/api/state'),
    api('/api/walk', { dir: 'right', tiles: 1 }),
    api('/api/state'),
  ]);

  for (const w of [left, right]) {
    expect(w.ok).toBe(true);
    expect(w.blocked).toBeFalsy();
    expect(w.walked).toBe(1);
  }
  expect(left.to.x).toBe(left.from.x - 1);
  expect(right.to.x).toBe(right.from.x + 1);
  for (const s of [s1, s2]) expect([startX - 1, startX]).toContain(s.raw.x);

  const after = await api('/api/state');
  expect(after.raw.x).toBe(startX);
  expect(after.raw.moving).toBe(false);
});

// Full-clear runs depend on these: the story objective to know where to go,
// pm_grind to level up cheaply, and continue-from-save to span sessions.
test('state exposes objective and inventory, grind levels up, continue resumes a save', async () => {
  test.setTimeout(240_000);

  const s0 = await api('/api/state');
  expect(typeof s0.state.objective).toBe('string');
  expect(s0.state.objective.length).toBeGreaterThan(0);
  expect(s0.state.inventory).toBeTruthy();
  expect(s0.state.healPoint).toBeTruthy();
  expect(s0.state.cleared).toBe(false);

  const warp = await api('/api/debug', { action: 'warp', args: ['route1', 4, 3] });
  expect(warp.ok).toBe(true);
  const levelBefore = Number(/L(\d+)/.exec((await api('/api/state')).state.party[0])![1]);

  const g = await api('/api/grind', { targetLevel: levelBefore + 1, maxBattles: 6 });
  expect(g.ok).toBe(true);
  expect(g.battles).toBeGreaterThan(0);
  expect(['target-level', 'max-battles', 'blackout', 'step-budget']).toContain(g.stoppedBecause);

  // save through the pause menu, then reload and continue from the autosave
  // (a grind can end in a blackout, so wait for the overworld before opening it)
  await api('/api/wait', { mode: 'overworld', timeoutMs: 30_000 });
  await api('/api/press', { keys: ['start'] });
  await api('/api/wait', { mode: 'menu', timeoutMs: 10_000 });
  const menu = await api('/api/state');
  const saveIdx = menu.raw.menu.items.indexOf('SAVE');
  expect(saveIdx).toBeGreaterThanOrEqual(0);
  await api('/api/press', { keys: [...Array(saveIdx).fill('down'), 'a'] });
  await api('/api/wait', { mode: 'dialogue', timeoutMs: 10_000 });
  await api('/api/press', { keys: ['a'] });
  await api('/api/wait', { mode: 'overworld', timeoutMs: 10_000 });

  const cont = await api('/api/continue', {});
  expect(cont.ok).toBe(true);
  expect(cont.state.mode).toBe('overworld');
  expect(cont.state.party.length).toBeGreaterThan(0);
});

// Findings are the product of a debugging run, so their schema, evidence
// capture and deduplication are contract-level behavior.
test('findings: validation, evidence capture, dedupe, and auto-detection', async () => {
  test.setTimeout(120_000);

  const filed = await api('/api/finding', {
    title: 'walking left from the lab door reports blocked but the player moves',
    severity: 'major',
    category: 'logic',
    area: 'harness',
    expected: 'walk result matches pm_state',
    actual: 'walk said blocked:true while state showed x-1',
    detail: 'hypothesis: results are not serialized',
    reproduced: true,
  });
  expect(filed.ok).toBe(true);
  expect(filed.finding.severity).toBe('major');
  expect(filed.finding.area).toBe('harness');
  expect(filed.finding.duplicate).toBe(false);
  expect(filed.finding.screenshot).toMatch(/^findings\/01-.*\.png$/);
  expect(fs.existsSync(path.join(RUN_DIR, filed.finding.screenshot))).toBe(true);

  // same issue again -> merged, not a second entry
  const again = await api('/api/finding', {
    title: 'Walking LEFT from the lab door reports blocked but the player moves!!',
    severity: 'major',
    category: 'logic',
    area: 'harness',
    expected: 'walk result matches pm_state',
    actual: 'same as before',
  });
  expect(again.finding.duplicate).toBe(true);
  expect(again.finding.occurrences).toBe(2);
  expect(again.finding.print).toBe(filed.finding.print);

  // invalid enum values fall back instead of throwing away the report
  const sloppy = await api('/api/finding', {
    title: 'professor gives no dialogue when talked to twice',
    severity: 'CRITICAL!!',
    category: 'weirdness',
    area: 'gameplay',
    expected: 'some dialogue',
    actual: 'nothing happened',
  });
  expect(sloppy.ok).toBe(true);
  expect(sloppy.finding.severity).toBe('major');
  expect(sloppy.finding.category).toBe('logic');
  expect(sloppy.finding.area).toBe('game');
  expect(sloppy.invalidFields).toContain('CRITICAL!!');

  // mechanical detector floor: a level regression is caught without the agent
  const before = (await api('/api/state')).state.party[0];
  const level = Number(/L(\d+)/.exec(before)![1]);
  await api('/api/debug', { action: 'setPartyLevels', args: [Math.max(2, level - 2)] });
  await api('/api/state');
  const info = await api('/api/run-info');
  const auto = info.findings.find((f: any) => f.category === 'logic' && /level regressed/.test(f.title));
  expect(auto, 'level regression should be detected automatically').toBeTruthy();
  expect(auto.severity).toBe('major');
});

// Regression: battle state must expose move name/category/power so the
// battle loop can prefer damaging moves over status moves (Growl spam fix).
// Also verifies move type is exposed (needed for manual mode type effectiveness).
test('battle state exposes move details (name, type, category, power)', async () => {
  test.setTimeout(120_000);
  await api('/api/debug', { action: 'warp', args: ['route1', 4, 3] });
  for (let i = 0; i < 80; i++) {
    const r = await api('/api/walk', { dir: i % 2 === 0 ? 'up' : 'down', tiles: 1 });
    if (r.interrupted === 'battle' || r.state?.mode === 'battle' || r.state?.battle) break;
  }
  const s = await api('/api/state');
  expect(s.raw.battle).toBeTruthy();
  const moves = s.raw.battle.active.moves;
  expect(moves.length).toBeGreaterThan(0);
  for (const m of moves) {
    expect(typeof m.id).toBe('string');
    expect(typeof m.name).toBe('string');
    expect(typeof m.type).toBe('string');
    expect(['physical', 'special', 'status']).toContain(m.category);
    expect(typeof m.power).toBe('number');
  }
  // At least one damaging move should exist
  expect(moves.some((m: any) => m.category !== 'status')).toBe(true);
  // stateSummary battle field should be an object with move strings including type
  expect(s.state.battle).toBeTruthy();
  expect(typeof s.state.battle).toBe('object');
  expect(s.state.battle.active.moves.length).toBeGreaterThan(0);
  // Run the battle to completion so the next test starts from a clean state
  await api('/api/battle', { maxTurns: 30 });
  await api('/api/wait', { mode: 'overworld', timeoutMs: 10_000 });
});

// Regression: state must include nearbyTiles (5x5 grid around player)
// so the agent can see its surroundings without a separate pm_map call.
test('state includes nearbyTiles grid', async () => {
  test.setTimeout(60_000);
  const s = await api('/api/state');
  expect(s.raw.nearbyTiles).toBeTruthy();
  expect(Array.isArray(s.raw.nearbyTiles)).toBe(true);
  expect(s.raw.nearbyTiles.length).toBe(5); // 5x5 grid
  expect(s.raw.nearbyTiles[0].length).toBe(5);
  // Center tile should be the player's tile (floor or similar, not '#')
  const center = s.raw.nearbyTiles[2][2];
  expect(typeof center).toBe('string');
  expect(center).not.toBe('#');
});

// Regression: grind must stay on the starting map and not wander through
// warps to other maps (the old version rotated through all 4 directions).
test('grind stays on the starting map', async () => {
  test.setTimeout(120_000);
  // Ensure we're in overworld before warping (previous test may have left us in a battle)
  await api('/api/wait', { mode: 'overworld', timeoutMs: 10_000 });
  await api('/api/debug', { action: 'warp', args: ['route1', 4, 3] });
  const before = await api('/api/state');
  const level = Number(/L(\d+)/.exec(before.state.party[0])![1]);
  const g = await api('/api/grind', { targetLevel: level + 1, maxBattles: 4 });
  expect(g.ok).toBe(true);
  // 'left-map' means the grind walked through a warp - that's the bug we fixed
  expect(g.stoppedBecause).not.toBe('left-map');
  expect(['target-level', 'max-battles', 'blackout', 'step-budget', 'no-grass']).toContain(g.stoppedBecause);
  // If grind completed without blackout, the player should still be on route1
  if (g.stoppedBecause !== 'blackout') {
    expect(g.state.map).toBe('route1');
  }
});

test('map endpoint, battle loop, notes, finalize and artifacts', async () => {
  test.setTimeout(180_000);

  const here = await api('/api/state');
  const map = await api('/api/map');
  expect(map.ok).toBe(true);
  expect(map.map.id).toBe(here.state.map);
  expect(map.map.tiles.length).toBeGreaterThan(0);
  expect(map.map.player).toBeTruthy();

  // warp into route1 grass and walk until a wild battle triggers
  const warp = await api('/api/debug', { action: 'warp', args: ['route1', 4, 3] });
  expect(warp.ok).toBe(true);

  let inBattle = false;
  for (let i = 0; i < 80; i++) {
    const dir = i % 2 === 0 ? 'up' : 'down';
    const r = await api('/api/walk', { dir, tiles: 1 });
    expect(r.ok).toBe(true);
    if (r.interrupted === 'battle' || r.state.mode === 'battle' || r.state.battle) {
      inBattle = true;
      break;
    }
  }
  expect(inBattle).toBe(true);

  const battle = await api('/api/battle', { maxTurns: 30 });
  expect(battle.ok).toBe(true);
  expect(battle.messages.length).toBeGreaterThan(0);
  expect(['win', 'lose', 'caught', 'run']).toContain(battle.outcome);
  expect(['overworld', 'battle']).toContain(battle.state.mode);

  const note = await api('/api/overlay-note', { note: 'e2e scripted observation: pipeline works' });
  expect(note.ok).toBe(true);
  await api('/api/log-event', { type: 'agent_message', text: 'GOAL_COMPLETE scripted run finished' });

  const fin = await api('/api/finalize', { status: 'completed', summary: 'scripted e2e', usage: { input_tokens: 1, output_tokens: 1 } });
  expect(fin.ok).toBe(true);
  expect(fin.runDir).toBe(RUN_DIR);

  // artifacts
  expect(fs.existsSync(path.join(RUN_DIR, 'events.jsonl'))).toBe(true);
  expect(fs.existsSync(path.join(RUN_DIR, 'report.json'))).toBe(true);
  expect(fs.existsSync(path.join(RUN_DIR, 'report.md'))).toBe(true);
  expect(fs.existsSync(path.join(RUN_DIR, 'final.png'))).toBe(true);
  expect(fs.existsSync(path.join(RUN_DIR, 'findings.md'))).toBe(true);
  expect(fs.existsSync(path.join(RUN_DIR, 'findings.json'))).toBe(true);

  const findings = JSON.parse(fs.readFileSync(path.join(RUN_DIR, 'findings.json'), 'utf8'));
  expect(findings.findings.length).toBeGreaterThanOrEqual(3);
  // blockers/majors sort above minor severities
  const severities: string[] = findings.findings.map((f: any) => f.severity);
  const rank = ['blocker', 'major', 'minor', 'polish', 'question', 'good'];
  for (let i = 1; i < severities.length; i++) {
    expect(rank.indexOf(severities[i])).toBeGreaterThanOrEqual(rank.indexOf(severities[i - 1]));
  }
  const withRepro = findings.findings.find((f: any) => f.repro?.recentToolCalls?.length);
  expect(withRepro, 'findings should carry a tool-call trail').toBeTruthy();
  expect(withRepro.repro.seed).toBe(42);

  const fmd = fs.readFileSync(path.join(RUN_DIR, 'findings.md'), 'utf8');
  expect(fmd).toContain('| # | severity | area | category |');
  expect(fmd).toContain('repro context');

  const index = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'agent-runs', 'findings-index.json'), 'utf8'));
  expect(Object.values(index).some((e: any) => e.runs.includes(RUN_ID))).toBe(true);

  const lines = fs
    .readFileSync(path.join(RUN_DIR, 'events.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  const types = new Set(lines.map((e) => e.type));
  for (const t of ['run_start', 'tool_call', 'tool_result', 'agent_note', 'agent_message', 'milestone', 'run_end']) {
    expect(types, `missing event type ${t}`).toContain(t);
  }
  // sequence numbers strictly increasing
  for (let i = 1; i < lines.length; i++) expect(lines[i].seq).toBeGreaterThan(lines[i - 1].seq);

  const report = JSON.parse(fs.readFileSync(path.join(RUN_DIR, 'report.json'), 'utf8'));
  expect(report.meta.status).toBe('completed');
  expect(report.stats.battlesRun).toBeGreaterThanOrEqual(1);
  expect(report.agentNotes).toContain('e2e scripted observation: pipeline works');
  expect(report.finalState).toBeTruthy();
  expect(report.milestones.some((m: any) => m.kind === 'map-change' && m.to === 'route1')).toBe(true);

  const md = fs.readFileSync(path.join(RUN_DIR, 'report.md'), 'utf8');
  expect(md).toContain('# Agent Run Report');
  expect(md).toContain('## Findings');
  expect(md).toContain('## Free-form Notes');
});

// Minimal stdio JSON-RPC client to validate the MCP server end to end.
async function mcpCall(): Promise<string> {
  const proc = spawn(process.execPath, [MCP_PATH], {
    env: { ...process.env, PM_URL },
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  const pending = new Map<number, (msg: any) => void>();
  let buffer = '';
  proc.stdout!.on('data', (d) => {
    buffer += String(d);
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)!(msg);
        pending.delete(msg.id);
      }
    }
  });
  const send = (id: number, method: string, params: unknown) =>
    new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`mcp timeout on ${method}`)), 20_000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  const notify = (method: string, params: unknown) =>
    proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');

  try {
    const init = await send(1, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'e2e', version: '1.0.0' },
    });
    expect(init.result.serverInfo.name).toBe('pocketmockster');
    notify('notifications/initialized', {});

    const tools = await send(2, 'tools/list', {});
    const names = tools.result.tools.map((t: any) => t.name);
    for (const t of ['pm_new_game', 'pm_press', 'pm_walk', 'pm_state', 'pm_map', 'pm_battle', 'pm_set_speed', 'pm_debug', 'pm_report_note', 'pm_wait']) {
      expect(names).toContain(t);
    }

    const call = await send(3, 'tools/call', { name: 'pm_state', arguments: {} });
    const payload = JSON.parse(call.result.content[0].text);
    expect(payload.mode).toBeTruthy();
    return payload.mode as string;
  } finally {
    proc.kill('SIGTERM');
  }
}

test('MCP stdio server: handshake, tools/list, tools/call pm_state', async () => {
  test.setTimeout(60_000);
  const mode = await mcpCall();
  expect(typeof mode).toBe('string');
});
