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

test('map endpoint, battle loop, notes, finalize and artifacts', async () => {
  test.setTimeout(180_000);

  const map = await api('/api/map');
  expect(map.ok).toBe(true);
  expect(map.map.id).toBe('lab');
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
  expect(report.stats.battlesRun).toBe(1);
  expect(report.agentNotes).toContain('e2e scripted observation: pipeline works');
  expect(report.finalState).toBeTruthy();
  expect(report.milestones.some((m: any) => m.kind === 'map-change' && m.to === 'route1')).toBe(true);

  const md = fs.readFileSync(path.join(RUN_DIR, 'report.md'), 'utf8');
  expect(md).toContain('# Agent Run Report');
  expect(md).toContain('## Agent Observations');
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
