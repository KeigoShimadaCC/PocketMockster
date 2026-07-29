#!/usr/bin/env node
// MCP server exposing Pocket Mockster game controls (via pm-server HTTP API)
// to any MCP-capable agent. Communicates over stdio.
//
// Env: PM_URL (default http://localhost:8787)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const PM_URL = process.env.PM_URL ?? 'http://localhost:8787';

async function call(pathname, body) {
  const res = await fetch(`${PM_URL}${pathname}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? `pm-server error on ${pathname}`);
  return data;
}

function textResult(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 1) }] };
}

const server = new McpServer({ name: 'pocketmockster', version: '1.0.0' });

const KEY = z.enum(['up', 'down', 'left', 'right', 'a', 'b', 'start']);
const DIR = z.enum(['up', 'down', 'left', 'right']);

server.registerTool(
  'pm_new_game',
  {
    description:
      'Start a fresh game: clears the save, skips intro dialogue, talks to the professor and picks a starter. Ends in the overworld of the lab with the starter in party, wild encounters enabled. Call this first (or pm_continue to resume a save).',
    inputSchema: {
      seed: z.number().int().optional().describe('RNG seed for reproducibility'),
      starterIndex: z.number().int().min(0).max(2).optional().describe('0 = sproutle (grass, default), 1 = cindercub (fire), 2 = puddlefin (water)'),
      noEncounters: z.boolean().optional().describe('disable random wild encounters (default true)'),
    },
  },
  async ({ seed, starterIndex, noEncounters }) => textResult(await call('/api/new-game', { seed, starterIndex, noEncounters })),
);

server.registerTool(
  'pm_press',
  {
    description:
      'Press GBA-style buttons. a = confirm/talk/advance text, b = cancel/back, start = open menu, arrows = move cursor or face a direction. Batch multiple keys in one call (e.g. ["down","down","a"]). Returns the full current screen state after all keys are pressed: mode, position, party, battle details, menu contents, dialogue, nearby tiles. Also returns textSeen: every dialogue line and battle message that appeared between keys. Batched "a" presses advance past text, so the final state may show dialogue:null even though an NPC spoke - read textSeen to know what was said.',
    inputSchema: { keys: z.array(KEY).describe('ordered list of keys to press') },
  },
  async ({ keys }) => textResult(await call('/api/press', { keys })),
);

server.registerTool(
  'pm_walk',
  {
    description:
      'Walk in a direction for N tiles. Returns the full current screen state (mode, position, party, battle, menu, dialogue, nearby tiles) plus from/to positions, walked count, and textSeen (any dialogue or battle messages that appeared while walking). Stops early if blocked (blocked:true) or if a battle/dialogue interrupts (interrupted:<mode>). Prefer this over repeated pm_press for movement.',
    inputSchema: { direction: DIR, tiles: z.number().int().min(1).max(60) },
  },
  async ({ direction, tiles }) => textResult(await call('/api/walk', { dir: direction, tiles })),
);

server.registerTool(
  'pm_state',
  {
    description:
      'Get the full game state: mode (title/overworld/dialogue/menu/battle/ending), position, money, badges, party (species/level/hp/moves/status), menu contents, battle status, pokedex counts.',
    inputSchema: {},
  },
  async () => textResult((await call('/api/state')).state),
);

server.registerTool(
  'pm_map',
  {
    description:
      'Get the current map grid: tiles (T=tree/wall, W=water, G=grass with wild encounters, .=floor, ,=path, D=door), warps (with destinations), NPC positions, items, signs, and your position. Use it to plan paths around obstacles. "doors" lists every D tile: those with a non-null "to" are enterable, the rest are decorative housefronts that will just block you. NPCs are listed by the sprite you can see plus trainer:true/false - to learn who an NPC is and what they want, walk up and talk to them.',
    inputSchema: {},
  },
  async () => textResult((await call('/api/map')).map),
);

server.registerTool(
  'pm_wait',
  {
    description: 'Wait until a given mode is reached (e.g. "overworld" after dialogue) or, without arguments, until movement finishes.',
    inputSchema: { mode: z.string().optional(), timeoutMs: z.number().int().optional() },
  },
  async ({ mode, timeoutMs }) => textResult(await call('/api/wait', { mode, timeoutMs })),
);

server.registerTool(
  'pm_battle',
  {
    description:
      'Run the current battle to completion automatically (handles menus, forced switches, move-learning prompts). Returns all battle messages plus outcome: "win" | "lose" | "caught" | "run". Only call when state.mode == "battle".',
    inputSchema: {
      preferMoves: z.array(z.string()).optional().describe('move ids to prefer, in priority order (e.g. ["vinewhip","tackle"])'),
      moveIndex: z.number().int().optional().describe('always use the move at this slot if it has PP'),
      maxTurns: z.number().int().optional(),
    },
  },
  async ({ preferMoves, moveIndex, maxTurns }) => textResult(await call('/api/battle', { preferMoves, moveIndex, maxTurns })),
);

server.registerTool(
  'pm_grind',
  {
    description:
      'Level up efficiently: paces over grass and auto-runs every wild battle until the lead reaches targetLevel or the battle budget is spent. Stand on or next to a grass tile first (see pm_map, "G"). Returns battles/wins/losses, resulting levels, and stoppedBecause ("target-level" | "max-battles" | "blackout" | "step-budget"). Far cheaper than looping pm_walk yourself.',
    inputSchema: {
      targetLevel: z.number().int().min(2).max(100).optional().describe('stop once the lead mon reaches this level'),
      maxBattles: z.number().int().min(1).max(40).optional().describe('battle budget, default 12'),
      preferMoves: z.array(z.string()).optional().describe('move ids to prefer while battling'),
    },
  },
  async ({ targetLevel, maxBattles, preferMoves }) => textResult(await call('/api/grind', { targetLevel, maxBattles, preferMoves })),
);

server.registerTool(
  'pm_continue',
  {
    description:
      'Resume the game from its autosave (title screen -> CONTINUE) instead of starting over. Use this when a previous session left progress behind; it fails if no save exists.',
    inputSchema: {},
  },
  async () => textResult(await call('/api/continue', {})),
);

server.registerTool(
  'pm_set_speed',
  {
    description: 'Set game speed multiplier (0.25-20). Higher = faster animations/timers. Use high speed (4-8) for grinding/traversal, low speed (1-2) for precision menus.',
    inputSchema: { multiplier: z.number().min(0.25).max(20) },
  },
  async ({ multiplier }) => textResult(await call('/api/speed', { multiplier })),
);

server.registerTool(
  'pm_debug',
  {
    description:
      'God-mode debug actions for TESTING ONLY (never for legitimate playthrough validation): setSeed(n), noEncounters(on), warp(map,x,y), setPartyLevels(level), givemon(species,level), setHp(idx,hp), addItem(item,n), healAll(), setTime(minute), addExp(idx,amount), hatchEggs(), walk(steps), drainPP(idx), clearSave().',
    inputSchema: { action: z.string(), args: z.array(z.any()).optional() },
  },
  async ({ action, args }) => textResult(await call('/api/debug', { action, args })),
);

server.registerTool(
  'pm_report_finding',
  {
    description: [
      'File a structured finding that a developer can act on without asking you follow-up questions.',
      'The server automatically attaches a screenshot, the current game state, the seed, and your preceding tool calls, so do not restate those.',
      '',
      'area (which codebase owns it) - choose carefully, a wrong area sends the fix to the wrong files:',
      '- game: the RPG itself (rules, maps, dialogue, battle math, progression, balance)',
      '- harness: the pm_* tools you are calling (wrong/stale tool results, automation that plays badly, tool errors). pm_battle uses a FIXED scripted policy, it is NOT the game AI, so complaints about move choice during pm_battle are harness, not game.',
      '- docs: a tool description or documented contract disagrees with real behavior',
      '- environment: the page reloaded, the server restarted, playwright errors like "execution context was destroyed" - infrastructure, not the game',
      '',
      'severity: blocker (cannot progress / crash / data loss), major (wrong behavior with a workaround), minor, polish, good (praise worth keeping), question (behavior you cannot classify without design intent - use this instead of guessing "bug").',
      'Filing the same issue twice is fine: identical findings are deduplicated into one entry with an occurrence count.',
    ].join('\n'),
    inputSchema: {
      title: z.string().describe('one line, specific: "walking left from (8,9) in mapletown reports blocked but moves"'),
      severity: z.enum(['blocker', 'major', 'minor', 'polish', 'good', 'question']),
      category: z.enum(['crash', 'softlock', 'progression', 'logic', 'balance', 'ux', 'text', 'collision', 'performance', 'tooling']),
      area: z.enum(['game', 'harness', 'docs', 'environment']),
      expected: z.string().describe('what should have happened'),
      actual: z.string().describe('what actually happened, with concrete values'),
      detail: z.string().optional().describe('extra analysis: your hypothesis about the cause, what you ruled out, exact steps if unusual'),
      reproduced: z.boolean().optional().describe('true only if you deliberately repeated the steps and saw it again'),
    },
  },
  async (input) => textResult(await call('/api/finding', input)),
);

server.registerTool(
  'pm_report_note',
  {
    description:
      'Record a free-form observation that is not a finding (progress commentary, context for later). For anything a developer should fix, use pm_report_finding instead.',
    inputSchema: { text: z.string() },
  },
  async ({ text }) => textResult(await call('/api/overlay-note', { note: text })),
);

await server.connect(new StdioServerTransport());
