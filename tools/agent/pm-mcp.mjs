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
      'Start a fresh game: clears the save, skips intro dialogue, talks to the professor and picks a starter. Ends in the overworld of the lab with the starter in party. Call this first.',
    inputSchema: {
      seed: z.number().int().optional().describe('RNG seed for reproducibility'),
      starterIndex: z.number().int().min(0).max(2).optional().describe('0 = first starter (cindercub), 1 = second, 2 = third'),
      noEncounters: z.boolean().optional().describe('disable random wild encounters (default true)'),
    },
  },
  async ({ seed, starterIndex, noEncounters }) => textResult(await call('/api/new-game', { seed, starterIndex, noEncounters })),
);

server.registerTool(
  'pm_press',
  {
    description:
      'Press GBA-style buttons. a = confirm/talk/advance text, b = cancel/back, start = open menu, arrows = move cursor or face a direction. Batch multiple keys in one call (e.g. ["down","down","a"]).',
    inputSchema: { keys: z.array(KEY).describe('ordered list of keys to press') },
  },
  async ({ keys }) => textResult(await call('/api/press', { keys })),
);

server.registerTool(
  'pm_walk',
  {
    description:
      'Walk in a direction for N tiles. Stops early if blocked (returns blocked:true) or if a battle/dialogue interrupts (returns interrupted:<mode>). Prefer this over repeated pm_press for movement.',
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
      'Get the current map grid: tiles (T=tree/wall, W=water, G=grass with wild encounters, .=floor, ,=path, D=door/warp), warps (with destinations), NPC positions, items, signs, and your position. Use it to plan paths around obstacles.',
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
      'Run the current battle to completion automatically (handles menus, forced switches, move-learning prompts). Returns all battle messages and the outcome. Only call when state.mode == "battle".',
    inputSchema: {
      preferMoves: z.array(z.string()).optional().describe('move ids to prefer, in priority order (e.g. ["vinewhip","tackle"])'),
      moveIndex: z.number().int().optional().describe('always use the move at this slot if it has PP'),
      maxTurns: z.number().int().optional(),
    },
  },
  async ({ preferMoves, moveIndex, maxTurns }) => textResult(await call('/api/battle', { preferMoves, moveIndex, maxTurns })),
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
  'pm_report_note',
  {
    description:
      'Record an observation in the run report. Use this whenever you notice a bug, odd behavior, confusing UX, or anything worth telling the developers. Include what you did, what you expected, and what happened.',
    inputSchema: { text: z.string() },
  },
  async ({ text }) => textResult(await call('/api/overlay-note', { note: text })),
);

await server.connect(new StdioServerTransport());
