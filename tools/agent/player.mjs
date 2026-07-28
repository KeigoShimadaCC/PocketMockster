#!/usr/bin/env node
// Codex player: runs a Codex SDK agent that plays Pocket Mockster live in a
// browser via the pm-server + MCP bridge. Produces JSONL event logs and a
// run report (report.md / report.json) under agent-runs/<id>/.
//
// Usage:
//   node tools/agent/player.mjs --profile casual-kid --goal "Beat gym leader Rocco and earn the badge"
//   node tools/agent/player.mjs --profile qa-adversary --seed 42 --max-turns 8 --headless
// Overrides: --model X --effort low|medium|high|xhigh --speed N --seed N --run-id X

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Codex } from '@openai/codex-sdk';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILES_PATH = path.join(REPO_ROOT, 'tools', 'agent', 'profiles.json');
const MCP_PATH = path.join(REPO_ROOT, 'tools', 'agent', 'pm-mcp.mjs');
const SERVER_PATH = path.join(REPO_ROOT, 'tools', 'agent', 'pm-server.mjs');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const profileName = String(args.profile ?? 'casual-kid');
const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
const profile = profiles[profileName];
if (!profile) {
  console.error(`unknown profile "${profileName}". Available: ${Object.keys(profiles).join(', ')}`);
  process.exit(1);
}

const cfg = {
  profile: profileName,
  goal: String(args.goal ?? 'Start a new game, get your starter, explore outside, and win your first wild battle.'),
  model: String(args.model ?? profile.model),
  effort: String(args.effort ?? profile.effort),
  speed: Number(args.speed ?? profile.speed ?? 1),
  seed: args.seed !== undefined ? Number(args.seed) : 42,
  maxTurns: Number(args['max-turns'] ?? 12),
  maxMinutes: Number(args['max-minutes'] ?? 45),
  headless: !!args.headless,
  runId: String(args['run-id'] ?? `${profileName}-${new Date().toISOString().replace(/[:.]/g, '-')}`),
  port: Number(args.port ?? 8787),
  vitePort: Number(args['vite-port'] ?? 5199),
};

const PM_URL = `http://localhost:${cfg.port}`;

async function api(pathname, body) {
  const res = await fetch(`${PM_URL}${pathname}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.json();
}

async function waitHealth(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await api('/api/health');
      if (r.ok && r.pageOpen) return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('pm-server did not become healthy');
}

function buildPrompt() {
  const debugRule = profile.debugAllowed
    ? 'You may use pm_debug for edge-case probes as your profile allows, but never use it to make story progress in a normal playthrough.'
    : 'NEVER use pm_debug. You must play legitimately: buttons, walking, battles only.';

  return `${profile.system}

You are playing Pocket Mockster, a GBA-style monster-catching RPG, LIVE in a real browser through MCP tools. A human is watching you play on screen right now.

## How to play
1. Call pm_new_game(seed=${cfg.seed}) once at the start.
2. Use pm_map to see the map grid and plan a route (T=tree, W=water, g=grass with wild encounters, .=floor, D=door; NPCs block tiles).
3. Move with pm_walk (chunked, fast). Face NPCs/signs with a direction press, then press "a" to interact. Advance dialogue with "a".
4. When pm_state shows mode:"battle", call pm_battle to run it automatically.
5. Menus are navigated with arrows + "a" (confirm) / "b" (cancel). "start" opens the pause menu.
6. Check pm_state whenever you are unsure what is happening.
7. Grass tiles ('g') trigger wild battles when encounters are on. Trainers battle you when you walk into their line of sight.
8. The game speed is currently ${cfg.speed}x. You may call pm_set_speed to adjust (slow for tricky menus, fast for traversal).

## Testing duty
You are also a QA tester. Whenever you notice a bug, confusing UX, broken text, weird collision, or anything unexpected, call pm_report_note with a clear description (what you did, what you expected, what happened). Also report things that are notably GOOD.

## Rules
- ${debugRule}
- Play autonomously; do not ask the user questions.
- Keep going across multiple turns if needed.

## Your goal
${cfg.goal}

## Completion protocol
Work toward the goal turn by turn. When the goal is fully achieved, make your final message start with exactly "GOAL_COMPLETE" followed by a short summary of what you did and your QA observations. If you become completely unable to progress (blocked, soft-locked, or the game is broken), make your final message start with exactly "STUCK" followed by the reason.`;
}

let serverProc = null;
let finalized = false;

async function finalize(status, summary, usage) {
  if (finalized) return;
  finalized = true;
  try {
    const r = await api('/api/finalize', { status, summary, usage });
    console.log(`\n[player] run ${cfg.runId} -> ${status}`);
    console.log(`[player] artifacts: ${r.runDir}`);
    console.log(`[player]   - events.jsonl (full event log)`);
    console.log(`[player]   - report.md / report.json (${r.report.anomalies} anomalies, ${r.report.warnings} warnings)`);
    console.log(`[player]   - final.png (screenshot)`);
  } catch (err) {
    console.error('[player] finalize failed:', err?.message ?? err);
  }
  try {
    serverProc?.kill('SIGTERM');
  } catch {
    // ignore
  }
}

async function main() {
  console.log(`[player] profile=${cfg.profile} model=${cfg.model} effort=${cfg.effort} speed=${cfg.speed}x seed=${cfg.seed}`);
  console.log(`[player] goal: ${cfg.goal}`);

  serverProc = spawn(
    process.execPath,
    [
      SERVER_PATH,
      '--port', String(cfg.port),
      '--vite-port', String(cfg.vitePort),
      '--run-id', cfg.runId,
      '--seed', String(cfg.seed),
      '--speed', String(cfg.speed),
      '--profile', cfg.profile,
      '--goal', cfg.goal,
      '--model', cfg.model,
      '--effort', cfg.effort,
      ...(cfg.headless ? ['--headless'] : []),
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  serverProc.stdout.on('data', (d) => process.stdout.write(`  ${d}`));
  serverProc.stderr.on('data', (d) => process.stderr.write(`  ${d}`));
  serverProc.on('exit', (code) => {
    if (!finalized) console.error(`[player] pm-server exited early (code ${code})`);
  });
  await waitHealth();
  console.log('[player] pm-server healthy; browser is live');

  const codex = new Codex({
    config: {
      mcp_servers: {
        pm: {
          command: process.execPath,
          args: [MCP_PATH],
          env: { PM_URL },
        },
      },
    },
  });

  const thread = codex.startThread({
    model: cfg.model,
    modelReasoningEffort: cfg.effort,
    sandboxMode: 'read-only',
    // NOTE: approval_policy "never" auto-cancels MCP tool calls in codex exec;
    // "on-request" auto-approves them in non-interactive mode.
    approvalPolicy: 'on-request',
    skipGitRepoCheck: true,
    workingDirectory: REPO_ROOT,
    networkAccessEnabled: false,
  });

  const totals = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };
  const deadline = Date.now() + cfg.maxMinutes * 60_000;
  let status = 'max-turns';
  let lastAgentText = '';

  const deadlineTimer = setInterval(() => {
    if (Date.now() > deadline && !finalized) {
      status = 'timeout';
      clearInterval(deadlineTimer);
      finalize(status, `Hit wall-clock limit of ${cfg.maxMinutes} minutes. Last agent message:\n${lastAgentText}`, totals).then(() => process.exit(4));
    }
  }, 5000);

  try {
    let prompt = buildPrompt();
    for (let turn = 0; turn < cfg.maxTurns; turn++) {
      console.log(`\n[player] === turn ${turn + 1}/${cfg.maxTurns} ===`);
      const streamed = await thread.runStreamed(prompt);

      for await (const event of streamed.events) {
        if (event.type === 'item.completed') {
          const item = event.item;
          if (item.type === 'agent_message') {
            lastAgentText = item.text;
            console.log(`\x1b[36m[agent]\x1b[0m ${item.text.slice(0, 600)}`);
            await api('/api/log-event', { type: 'agent_message', text: item.text });
          } else if (item.type === 'reasoning') {
            console.log(`\x1b[2m[thinking] ${item.text.slice(0, 240)}\x1b[0m`);
            await api('/api/log-event', { type: 'agent_reasoning', text: item.text });
          } else if (item.type === 'mcp_tool_call') {
            const argStr = JSON.stringify(item.arguments ?? {});
            console.log(`\x1b[33m[tool]\x1b[0m ${item.tool}(${argStr.slice(0, 160)})${item.error ? ' ERROR: ' + item.error.message : ''}`);
            await api('/api/log-event', { type: 'agent_tool_call', tool: item.tool, arguments: item.arguments, error: item.error?.message ?? null });
          } else if (item.type === 'command_execution') {
            console.log(`\x1b[35m[shell]\x1b[0m ${item.command.slice(0, 160)}`);
            await api('/api/log-event', { type: 'agent_shell', command: item.command, exitCode: item.exit_code ?? null });
          } else if (item.type === 'error') {
            await api('/api/log-event', { type: 'agent_error', message: item.message });
          }
        } else if (event.type === 'turn.completed') {
          const u = event.usage ?? {};
          totals.input_tokens += u.input_tokens ?? 0;
          totals.cached_input_tokens += u.cached_input_tokens ?? 0;
          totals.output_tokens += u.output_tokens ?? 0;
          console.log(`[player] turn tokens: in=${u.input_tokens ?? '?'} out=${u.output_tokens ?? '?'}`);
        }
      }

      const verdict = lastAgentText.trimStart();
      if (verdict.startsWith('GOAL_COMPLETE')) {
        status = 'completed';
        break;
      }
      if (verdict.startsWith('STUCK')) {
        status = 'stuck';
        break;
      }
      prompt = 'Continue playing toward your goal. Remember: end with GOAL_COMPLETE or STUCK when done or blocked.';
    }
  } catch (err) {
    status = 'error';
    lastAgentText = `player error: ${String(err?.message ?? err)}\n\nLast agent message:\n${lastAgentText}`;
  } finally {
    clearInterval(deadlineTimer);
  }

  await finalize(status, lastAgentText, totals);
  serverProc?.kill('SIGTERM');
  process.exit(status === 'completed' ? 0 : status === 'stuck' ? 2 : 3);
}

process.on('SIGINT', async () => {
  await finalize('aborted', 'Interrupted by user (Ctrl-C).', null);
  process.exit(130);
});

main().catch(async (err) => {
  console.error('[player] fatal:', err);
  await finalize('error', String(err?.stack ?? err), null);
  process.exit(1);
});
