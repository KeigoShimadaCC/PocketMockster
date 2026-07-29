// Opt-in live e2e test: boots pm-server (headless browser + HTTP API), writes
// a project-scoped .cursor/mcp.json, and runs cursor-agent for 2 turns against
// the real game. Skipped unless PM_CURSOR_LIVE=1 is set so CI needs no Cursor
// login.
//
//   PM_CURSOR_LIVE=1 npx playwright test cursor-live.spec.ts

import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeMcpConfig, createCursorSession } from '../tools/agent/cursor-engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_PATH = path.join(REPO_ROOT, 'tools', 'agent', 'pm-server.mjs');
const MCP_PATH = path.join(REPO_ROOT, 'tools', 'agent', 'pm-mcp.mjs');

const API_PORT = 8791;
const VITE_PORT = 5211;
const PM_URL = `http://localhost:${API_PORT}`;
const RUN_ID = `cursor-live-${Date.now()}`;

const LIVE = process.env.PM_CURSOR_LIVE === '1';

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

test.describe('cursor-agent live e2e', () => {
  test.beforeAll(async () => {
    if (!LIVE) return;
    serverProc = spawn(
      process.execPath,
      [
        SERVER_PATH,
        '--port', String(API_PORT),
        '--vite-port', String(VITE_PORT),
        '--run-id', RUN_ID,
        '--seed', '42',
        '--speed', '1',
        '--profile', 'cursor-live-test',
        '--goal', 'cursor live e2e',
        '--headless',
        '--index-dir', path.join(REPO_ROOT, 'agent-runs', RUN_ID),
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    serverProc.stdout?.on('data', (d) => process.stdout.write(`[pm-server] ${d}`));
    serverProc.stderr?.on('data', (d) => process.stderr.write(`[pm-server:err] ${d}`));
    await waitHealth();
  }, 120_000);

  test.afterAll(async () => {
    if (!LIVE) return;
    serverProc?.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
  });

  test(
    'cursor-agent drives pm-server: state, walk, resume with context',
    { timeout: 300_000 },
    async () => {
      test.skip(!LIVE, 'Set PM_CURSOR_LIVE=1 to run');

      await api('/api/new-game', { seed: 42, starterIndex: 0, noEncounters: false });

      // Agents run in an empty scratch dir outside the repo, so they cannot
      // read the game source and cursor-agent cannot resolve the repo's own
      // .cursor/mcp.json by walking up from cwd.
      const workspace = path.join(os.tmpdir(), `pm-agent-${RUN_ID}`);
      fs.mkdirSync(workspace, { recursive: true });
      writeMcpConfig(workspace, MCP_PATH, PM_URL);

      const events: any[] = [];
      const engine = createCursorSession({
        model: 'composer-2.5',
        cwd: workspace,
        onEvent: (evt) => events.push(evt),
      });

      const r1 = await engine.turn(
        'You are testing a game via MCP tools. Call pm_state from the pocketmockster server and tell me the current game mode, map, and player position. Only use pocketmockster tools.',
      );
      expect(r1.isError).toBe(false);
      expect(r1.text).toBeTruthy();

      const stateCalls = events.filter((e) => e.type === 'tool_call' && e.tool === 'pm_state');
      expect(stateCalls.length).toBeGreaterThanOrEqual(1);

      const before = (await api('/api/state')).raw;
      const startX = before.x;

      const r2 = await engine.turn(
        'In the previous turn you saw the game state. Now call pm_walk with direction="right" and tiles=1, then call pm_state to confirm the new position. Only use pocketmockster tools.',
      );
      expect(r2.isError).toBe(false);

      const walkCalls = events.filter((e) => e.type === 'tool_call' && e.tool === 'pm_walk');
      expect(walkCalls.length).toBeGreaterThanOrEqual(1);

      const after = (await api('/api/state')).raw;
      expect(after.x).toBe(startX + 1);

      expect(engine.totals.input_tokens).toBeGreaterThan(0);
      expect(engine.totals.output_tokens).toBeGreaterThan(0);
    },
  );
});
