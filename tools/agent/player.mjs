#!/usr/bin/env node
// Agent player: runs an AI agent (Codex SDK or Cursor CLI) that plays Pocket
// Mockster live in a browser via the pm-server + MCP bridge. Produces JSONL
// event logs and a run report (report.md / report.json) under agent-runs/<id>/.
//
// Usage:
//   node tools/agent/player.mjs --profile casual-kid --goal "Beat gym 1"
//   node tools/agent/player.mjs --profile debugger-claude --engine cursor --seed 42
//   node tools/agent/player.mjs --profile qa-adversary --seed 42 --max-turns 8 --headless
// Overrides: --engine codex|cursor --model X --effort low|medium|high|xhigh --speed N --seed N --run-id X

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCodexSession } from './codex-engine.mjs';
import { createCursorSession, writeMcpConfig } from './cursor-engine.mjs';

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
  engine: String(args.engine ?? profile.engine ?? 'codex'),
  goal: String(args.goal ?? 'Start a new game, get your starter, explore outside, and win your first wild battle.'),
  model: String(args.model ?? profile.model),
  effort: String(args.effort ?? profile.effort ?? 'medium'),
  speed: Number(args.speed ?? profile.speed ?? 1),
  seed: args.seed !== undefined ? Number(args.seed) : 42,
  resume: !!args.continue,
  build: args.build !== undefined ? !!args.build : Number(args['max-minutes'] ?? 45) > 20,
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

  const engineNote =
    cfg.engine === 'cursor'
      ? '\nOnly use pocketmockster MCP tools. Do not use any other MCP servers that may be available.'
      : '';

  const auto = profile.autoTools === true;

  const howToPlay = auto
    ? `## How to play
1. ${cfg.resume ? 'Call pm_continue once at the start to resume the existing save, then pm_state to see where you are.' : `Call pm_new_game(seed=${cfg.seed}) once at the start.`}
2. Use pm_map to see the map grid and plan a route (T=tree, W=water, G=grass with wild encounters, .=floor, ,=path, D=door; NPCs block tiles).
3. Move with pm_walk (chunked, fast). Face NPCs/signs with a direction press, then press "a" to interact. Advance dialogue with "a".
4. When pm_state shows mode:"battle", call pm_battle to run it automatically.
5. Menus are navigated with arrows + "a" (confirm) / "b" (cancel). "start" opens the pause menu.
6. Check pm_state whenever you are unsure what is happening.
7. Grass tiles ('G') trigger wild battles. Trainers battle you when you walk into their line of sight.
8. The game speed is currently ${cfg.speed}x. You may call pm_set_speed to adjust (slow for tricky menus, fast for traversal).
9. pm_state includes "objective", the game's own next story step - trust it to know where to go next.
10. To level up before a gym or boss, call pm_grind(targetLevel) from a grass area instead of stepping around manually. Heal at the healPoint shown in pm_state (talk to the nurse) before hard fights.`
    : `## How to play
You play like a real player: press buttons and see the result on screen. Every action you take (pm_press, pm_walk) returns the full current screen state - mode, position, party, battle details, menu contents, dialogue, nearby tiles. You do NOT need to call pm_state separately after an action; the result IS the screen.

1. ${cfg.resume ? 'Call pm_continue once at the start to resume the existing save.' : `Call pm_new_game(seed=${cfg.seed}) once at the start.`}
2. Use pm_map to see the full map grid and plan a route (T=tree, W=water, G=grass with wild encounters, .=floor, ,=path, D=door; NPCs block tiles). The state also includes nearbyTiles, a 5x5 grid around you.
3. Move with pm_walk (direction + tile count). It returns your new position plus the full screen state. If a battle or dialogue interrupts, the state shows it.
4. Press buttons with pm_press. Batch sequences like ["a","down","down","a"] for menu navigation. a = confirm/talk/advance text, b = cancel/back, start = open menu, arrows = move cursor or face a direction.
5. In battles, navigate the battle menu manually with pm_press. The battle state shows enemy species/HP, your active mon HP, and available moves with type/category/power/PP. Pick moves wisely based on type effectiveness.
6. Grass tiles ('G') trigger wild battles. Trainers (marked trainer:true in pm_map) battle you when you walk into their line of sight.
7. The game speed is currently ${cfg.speed}x. Use pm_set_speed to adjust (slow for tricky menus, fast for traversal).
8. The state includes "objective", the game's own next story step - trust it to know where to go next.
9. To heal, go to the healPoint shown in state (talk to the nurse). To level up, walk in grass and fight wild battles manually.
10. Call pm_state only when you want to check the screen without taking an action.`;

  return `${profile.system}

You are playing Pocket Mockster, a GBA-style monster-catching RPG, LIVE in a real browser through MCP tools. A human is watching you play on screen right now.
${engineNote}

${howToPlay}

## Debugging duty
You are the tester of record for this build. When something looks wrong, work like a debugger, not a reviewer:
1. OBSERVE: check the screen state from your last action, before doing anything else, so the evidence is the real state and not your memory.
2. HYPOTHESIZE: state one candidate cause and what observation would disprove it.
3. MINIMIZE: reduce it to the shortest action that still shows it (one pm_walk of 1 tile, one pm_press), starting from a known position.
4. REPRODUCE: repeat that minimal sequence. Only set reproduced:true if you saw it a second time.
5. FILE: call pm_report_finding with precise area/severity/category. A screenshot, the seed, the live state and your last tool calls are attached automatically.

Attribution rules (a wrong "area" sends the fix into the wrong files):
${auto ? `- A pm_* result that contradicts pm_state, or automation that plays badly, is area "harness", not a game bug. pm_battle follows a fixed scripted policy and is NOT the game's AI; to judge the game's own battle behavior, play a fight manually with pm_press.` : `- A pm_* result that contradicts the screen state, or a tool that returns wrong data, is area "harness", not a game bug.`}
- The screen jumping back to the title, or a tool erroring with something like "execution context was destroyed", is area "environment" (the page reloaded). Re-check pm_state and recover with pm_continue rather than filing it as a game defect.
- A tool description that disagrees with real behavior is area "docs".
- If you cannot tell whether behavior is intended design, file severity "question" instead of asserting a bug.

Duplicates are merged automatically, so file each distinct issue once and move on. Do file severity "good" for things that work notably well, and prefer a few well-evidenced findings over many vague ones.

## Rules
- ${debugRule}
- Play autonomously; do not ask the user questions.
- Keep going across multiple turns if needed.

## Your goal
${cfg.goal}

## Completion protocol
Work toward the goal turn by turn. When the goal is fully achieved, make your final message start with exactly "GOAL_COMPLETE" followed by a short summary of what you did and your QA observations. If you become completely unable to progress (blocked, soft-locked, or the game is broken), make your final message start with exactly "STUCK" followed by the reason.`;
}

function continuePrompt(info, turn) {
  const d = info.digest;
  const auto = profile.autoTools === true;
  const lines = [`Continue playing toward your goal (turn ${turn + 2} of ${cfg.maxTurns}).`];
  if (d) {
    lines.push('', 'Progress so far:');
    lines.push(`- objective: ${d.objective ?? 'unknown'}`);
    lines.push(`- badges: ${d.badges.length}${d.badges.length ? ` (${d.badges.join(', ')})` : ''}`);
    lines.push(`- location: ${d.map} (${d.x},${d.y}), mode ${d.mode}`);
    lines.push(`- party: ${d.party.join(', ') || '(empty)'}`);
    lines.push(`- money: ${d.money} | heal point: ${d.healPoint ?? 'unknown'} | dex: ${d.caught} caught`);
    const keyItems = Object.entries(d.inventory ?? {})
      .map(([k, n]) => `${k} x${n}`)
      .join(', ');
    if (keyItems) lines.push(`- items: ${keyItems}`);
  }
  const recent = (info.milestones ?? []).slice(-4).map((m) => m.kind + (m.objective ? `: ${m.objective}` : m.to ? `: ${m.to}` : ''));
  if (recent.length) lines.push(`- recent milestones: ${recent.join(' | ')}`);
  // Recent action history so the agent remembers what it just did
  const actions = info.recentActions ?? [];
  if (actions.length) {
    lines.push('', 'Recent actions:');
    for (const a of actions) {
      const args = a.args ? JSON.stringify(a.args) : '';
      lines.push(`  ${a.tool}(${args})${a.error ? ` -> ERROR ${a.error}` : ''}`);
    }
  }
  const filed = info.findings ?? [];
  if (filed.length) {
    lines.push('', `Findings you already filed (do not refile these): ${filed.map((f) => `#${f.index} ${f.title}`).join('; ')}`);
    const unconfirmed = filed.filter((f) => !f.reproduced && f.severity !== 'good');
    if (unconfirmed.length) {
      lines.push(
        `Unconfirmed so far: ${unconfirmed.map((f) => `#${f.index}`).join(', ')}. If you get a chance, reproduce one minimally and refile it with reproduced:true.`,
      );
    }
  }
  lines.push(
    '',
    auto
      ? 'If your party is under-levelled for the next fight, use pm_grind. Remember: end with GOAL_COMPLETE or STUCK when done or blocked.'
      : 'If your party is under-levelled, walk in grass and fight wild battles. Remember: end with GOAL_COMPLETE or STUCK when done or blocked.',
  );
  return lines.join('\n');
}

let serverProc = null;
let finalized = false;

async function finalize(status, summary, usage) {
  if (finalized) return;
  finalized = true;
  try {
    const r = await api('/api/finalize', { status, summary, usage });
    console.log(`\n[player] run ${cfg.runId} -> ${status}`);
    if (r.findings?.length) {
      console.log(`[player] ${r.findings.length} findings:`);
      for (const f of r.findings) {
        console.log(`  \x1b[33m[${f.severity}/${f.area}/${f.category}]\x1b[0m ${f.title}${f.occurrences > 1 ? ` (${f.occurrences}x)` : ''}`);
      }
    } else {
      console.log('[player] no findings filed');
    }
    console.log(`[player] artifacts: ${r.runDir}`);
    console.log(`[player]   - findings.md / findings.json (+ findings/*.png evidence)`);
    console.log(`[player]   - events.jsonl (full event log)`);
    console.log(`[player]   - report.md / report.json (${r.report.anomalies} anomalies, ${r.report.warnings} warnings)`);
    if (r.report.cost) {
      console.log(`[player]   - cost: $${r.report.cost.total.toFixed(2)} (in $${r.report.cost.inputCost.toFixed(2)} + cached $${r.report.cost.cachedCost.toFixed(2)} + out $${r.report.cost.outputCost.toFixed(2)})`);
    }
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
  console.log(
    `[player] engine=${cfg.engine} profile=${cfg.profile} model=${cfg.model} effort=${cfg.effort} speed=${cfg.speed}x seed=${cfg.seed}${cfg.resume ? ' (resuming save)' : ''}${cfg.build ? ' (frozen build)' : ''}`,
  );
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
      ...(cfg.build ? ['--build'] : []),
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

  let lastAgentText = '';

  const onEvent = (evt) => {
    switch (evt.type) {
      case 'agent_message':
        lastAgentText = evt.text;
        console.log(`\x1b[36m[agent]\x1b[0m ${evt.text.slice(0, 600)}`);
        api('/api/log-event', { type: 'agent_message', text: evt.text }).catch(() => {});
        break;
      case 'agent_reasoning':
        console.log(`\x1b[2m[thinking] ${evt.text.slice(0, 240)}\x1b[0m`);
        api('/api/log-event', { type: 'agent_reasoning', text: evt.text }).catch(() => {});
        break;
      case 'tool_call': {
        const argStr = JSON.stringify(evt.arguments ?? {});
        console.log(`\x1b[33m[tool]\x1b[0m ${evt.tool}(${argStr.slice(0, 160)})${evt.error ? ' ERROR: ' + evt.error : ''}`);
        api('/api/log-event', { type: 'agent_tool_call', tool: evt.tool, arguments: evt.arguments, error: evt.error ?? null }).catch(() => {});
        break;
      }
      case 'tool_result':
        if (evt.error) {
          api('/api/log-event', { type: 'agent_error', message: `${evt.tool} result error: ${evt.error}` }).catch(() => {});
        }
        break;
      case 'shell':
        console.log(`\x1b[35m[shell]\x1b[0m ${evt.command.slice(0, 160)}`);
        api('/api/log-event', { type: 'agent_shell', command: evt.command, exitCode: evt.exitCode ?? null }).catch(() => {});
        break;
      case 'error':
        api('/api/log-event', { type: 'agent_error', message: evt.message }).catch(() => {});
        break;
    }
  };

  let engine;
  if (cfg.engine === 'cursor') {
    const mcpConfigPath = writeMcpConfig(REPO_ROOT, MCP_PATH, PM_URL);
    console.log(`[player] cursor MCP config: ${mcpConfigPath}`);
    engine = createCursorSession({ model: cfg.model, cwd: REPO_ROOT, onEvent });
  } else {
    engine = createCodexSession({ model: cfg.model, effort: cfg.effort, cwd: REPO_ROOT, mcpPath: MCP_PATH, pmUrl: PM_URL, onEvent });
  }

  const deadline = Date.now() + cfg.maxMinutes * 60_000;
  let status = 'max-turns';

  const deadlineTimer = setInterval(() => {
    if (Date.now() > deadline && !finalized) {
      status = 'timeout';
      clearInterval(deadlineTimer);
      finalize(status, `Hit wall-clock limit of ${cfg.maxMinutes} minutes. Last agent message:\n${lastAgentText}`, engine.totals).then(() => process.exit(4));
    }
  }, 5000);

  try {
    let prompt = buildPrompt();
    for (let turn = 0; turn < cfg.maxTurns; turn++) {
      console.log(`\n[player] === turn ${turn + 1}/${cfg.maxTurns} ===`);
      const result = await engine.turn(prompt);
      lastAgentText = result.text;
      console.log(`[player] turn tokens: in=${result.usage.input_tokens ?? '?'} out=${result.usage.output_tokens ?? '?'}`);

      if (result.isError) {
        console.error(`[player] engine reported error turn`);
      }

      const info = await api('/api/run-info');
      if (info.cleared) {
        console.log('[player] ending reached - game cleared');
        status = 'cleared';
        break;
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
      prompt = continuePrompt(info, turn);
    }
  } catch (err) {
    status = 'error';
    lastAgentText = `player error: ${String(err?.message ?? err)}\n\nLast agent message:\n${lastAgentText}`;
  } finally {
    clearInterval(deadlineTimer);
  }

  await finalize(status, lastAgentText, engine.totals);
  serverProc?.kill('SIGTERM');
  process.exit(status === 'completed' || status === 'cleared' ? 0 : status === 'stuck' ? 2 : 3);
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
