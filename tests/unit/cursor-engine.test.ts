import { test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseStreamEvent, writeMcpConfig, createCursorSession } from '../../tools/agent/cursor-engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, '..', 'fixtures');

function loadFixture(name: string): string[] {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8').trim().split('\n');
}

// ---------- stream parser ----------

test('parseStreamEvent: extracts session_id from system/init', () => {
  const events = loadFixture('cursor-simple.jsonl').map(parseStreamEvent).filter(Boolean);
  const init = events.find((e) => e?.type === 'session');
  expect(init).toBeTruthy();
  expect(init!.sessionId).toBe('31f856e6-d5aa-46d5-b691-fb1b40d118e5');
  expect(init!.model).toBe('Composer 2.5');
});

test('parseStreamEvent: extracts agent message text', () => {
  const events = loadFixture('cursor-simple.jsonl').map(parseStreamEvent).filter(Boolean);
  const msg = events.find((e) => e?.type === 'agent_message');
  expect(msg).toBeTruthy();
  expect(msg!.text).toBe('PROBE_OK');
});

test('parseStreamEvent: accumulates thinking deltas', () => {
  const events = loadFixture('cursor-simple.jsonl').map(parseStreamEvent).filter(Boolean);
  const thoughts = events.filter((e) => e?.type === 'agent_reasoning');
  expect(thoughts.length).toBe(2);
  expect(thoughts[0]!.text).toContain('Replying with exactly');
  expect(thoughts[1]!.text).toContain('PROBE_OK');
});

test('parseStreamEvent: extracts usage from result event', () => {
  const events = loadFixture('cursor-simple.jsonl').map(parseStreamEvent).filter(Boolean);
  const result = events.find((e) => e?.type === 'result');
  expect(result).toBeTruthy();
  expect(result!.isError).toBe(false);
  expect(result!.text).toBe('PROBE_OK');
  expect(result!.usage.inputTokens).toBe(28239);
  expect(result!.usage.outputTokens).toBe(34);
  expect(result!.usage.cacheReadTokens).toBe(5957);
});

test('parseStreamEvent: parses MCP tool_call started and completed', () => {
  const events = loadFixture('cursor-mcp.jsonl').map(parseStreamEvent).filter(Boolean);
  const toolCalls = events.filter((e) => e?.type === 'tool_call');
  const toolResults = events.filter((e) => e?.type === 'tool_result');

  // The MCP fixture called pm_state, pm_walk, pm_state
  expect(toolCalls.length).toBeGreaterThanOrEqual(3);
  expect(toolCalls[0]!.tool).toBe('pm_state');
  expect(toolCalls[0]!.arguments).toEqual({});
  expect(toolCalls[0]!.error).toBeNull();

  expect(toolResults.length).toBeGreaterThanOrEqual(3);
  const firstResult = toolResults[0]!;
  expect(firstResult.tool).toBe('pm_state');
  // cursor wraps MCP text as { text: { text: "..." } } - must unwrap
  expect(firstResult.result).toContain('"mode": "overworld"');
  expect(firstResult.result).toContain('"map": "lab"');
  expect(firstResult.error).toBeNull();

  // pm_walk call should have direction/tiles args
  const walkCall = toolCalls.find((e) => e!.tool === 'pm_walk');
  expect(walkCall).toBeTruthy();
  expect(walkCall!.arguments).toEqual({ direction: 'right', tiles: 1 });
});

test('parseStreamEvent: handles error result event', () => {
  const events = loadFixture('cursor-error.jsonl').map(parseStreamEvent).filter(Boolean);
  const result = events.find((e) => e?.type === 'result');
  expect(result).toBeTruthy();
  expect(result!.isError).toBe(true);
  expect(result!.text).toBe('Something went wrong');
  expect(result!.usage.inputTokens).toBe(100);
});

test('parseStreamEvent: returns null for non-actionable lines', () => {
  expect(parseStreamEvent('not json')).toBeNull();
  expect(parseStreamEvent('{"type":"unknown"}')).toBeNull();
  // user echo is not actionable
  const userLine = loadFixture('cursor-simple.jsonl')[1];
  expect(parseStreamEvent(userLine)).toBeNull();
  // getMcpTools tool calls are internal, not actionable
  const getMcpLine = loadFixture('cursor-mcp.jsonl').find((l) =>
    l.includes('getMcpToolsToolCall'),
  );
  if (getMcpLine) expect(parseStreamEvent(getMcpLine)).toBeNull();
});

test('parseStreamEvent: handles empty/garbled input gracefully', () => {
  expect(parseStreamEvent('')).toBeNull();
  expect(parseStreamEvent('{broken')).toBeNull();
});

// The agent is supposed to learn the game by playing it. If it reaches for a
// file or shell tool it may be reading the source instead, which invalidates
// discoverability findings, so those calls must surface as agent_tool.
// End-to-end through the real session, with a stub cursor-agent on PATH: a turn
// must report the agent's FINAL message. Preferring the cumulative `result`
// field made a run that emitted "GOAL_COMPLETE" carry on to the next turn.
test('createCursorSession: turn text is the final message, not the cumulative result', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-fake-cursor-'));
  const lines = [
    { type: 'system', subtype: 'init', session_id: 's-1', model: 'stub' },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'I got Sproutle!' }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Heading north now.' }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'GOAL_COMPLETE\n\nI reached Verdant City.' }] } },
    {
      type: 'result',
      is_error: false,
      result: 'I got Sproutle!\nHeading north now.\nGOAL_COMPLETE\n\nI reached Verdant City.',
      usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: 0 },
    },
  ];
  // The payload goes in a data file: sh's echo would expand the \n inside the
  // JSON strings and split each line into invalid JSON.
  fs.writeFileSync(path.join(dir, 'stream.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  const bin = path.join(dir, 'cursor-agent');
  fs.writeFileSync(bin, '#!/bin/sh\ncat > /dev/null\ncat "$(dirname "$0")/stream.jsonl"\n', { mode: 0o755 });

  const prevBin = process.env.PM_CURSOR_BIN;
  process.env.PM_CURSOR_BIN = bin;
  try {
    const session = createCursorSession({ model: 'stub', cwd: dir, onEvent: () => {} });
    const turn = await session.turn('play the game');
    expect(turn.text.startsWith('GOAL_COMPLETE')).toBe(true);
    expect(turn.isError).toBe(false);
    expect(turn.usage.input_tokens).toBe(10);
  } finally {
    if (prevBin === undefined) delete process.env.PM_CURSOR_BIN;
    else process.env.PM_CURSOR_BIN = prevBin;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A turn's `result` field concatenates every interim message the agent emitted,
// so GOAL_COMPLETE from the final message ends up buried in the middle. The
// completion protocol checks the start of the final message, which is why the
// session prefers the last discrete assistant message over `result`.
test('parseStreamEvent: result text is the whole turn, not just the final message', () => {
  const line = JSON.stringify({
    type: 'result',
    is_error: false,
    result: 'I got Sproutle!\nHeading north now.\nGOAL_COMPLETE\n\nI reached Verdant City.',
    usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 },
  });
  const evt = parseStreamEvent(line);
  expect(evt?.type).toBe('result');
  expect(evt!.text.startsWith('GOAL_COMPLETE')).toBe(false);
  expect(evt!.text).toContain('GOAL_COMPLETE');
});

test('parseStreamEvent: surfaces non-MCP tool calls as agent_tool', () => {
  const line = JSON.stringify({
    type: 'tool_call',
    subtype: 'started',
    tool_call: {
      readToolCall: { args: { path: 'src/content/maps/mapletown.ts' } },
      toolCallId: 'tc-1',
    },
  });
  const evt = parseStreamEvent(line);
  expect(evt?.type).toBe('agent_tool');
  expect(evt!.tool).toBe('read');
  expect(evt!.detail).toContain('mapletown');
});

test('parseStreamEvent: does not double-report completed outside tool calls', () => {
  const line = JSON.stringify({
    type: 'tool_call',
    subtype: 'completed',
    tool_call: { readToolCall: { args: { path: 'src/game.ts' } }, toolCallId: 'tc-1' },
  });
  expect(parseStreamEvent(line)).toBeNull();
});

// ---------- MCP config writer ----------

test('writeMcpConfig: creates fresh config with pocketmockster server', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-test-'));
  const mcpPath = '/fake/path/pm-mcp.mjs';
  const pmUrl = 'http://localhost:8790';
  const configPath = writeMcpConfig(tmpDir, mcpPath, pmUrl);

  expect(configPath).toBe(path.join(tmpDir, '.cursor', 'mcp.json'));
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  expect(config.mcpServers.pocketmockster).toBeTruthy();
  expect(config.mcpServers.pocketmockster.env.PM_URL).toBe(pmUrl);
  expect(config.mcpServers.pocketmockster.args).toContain(mcpPath);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('writeMcpConfig: merges into existing config without clobbering other servers', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-test-'));
  const cursorDir = path.join(tmpDir, '.cursor');
  fs.mkdirSync(cursorDir, { recursive: true });
  const existingPath = path.join(cursorDir, 'mcp.json');
  fs.writeFileSync(
    existingPath,
    JSON.stringify({
      mcpServers: {
        context7: { command: 'npx', args: ['@upstash/context7-mcp'] },
      },
    }),
  );

  const mcpPath = '/fake/path/pm-mcp.mjs';
  const pmUrl = 'http://localhost:8790';
  writeMcpConfig(tmpDir, mcpPath, pmUrl);

  const config = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
  expect(config.mcpServers.context7).toBeTruthy();
  expect(config.mcpServers.context7.command).toBe('npx');
  expect(config.mcpServers.pocketmockster).toBeTruthy();
  expect(config.mcpServers.pocketmockster.env.PM_URL).toBe(pmUrl);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('writeMcpConfig: overwrites stale pocketmockster entry with new PM_URL', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-test-'));
  const cursorDir = path.join(tmpDir, '.cursor');
  fs.mkdirSync(cursorDir, { recursive: true });
  const existingPath = path.join(cursorDir, 'mcp.json');
  fs.writeFileSync(
    existingPath,
    JSON.stringify({
      mcpServers: {
        pocketmockster: { command: 'old', args: ['old'], env: { PM_URL: 'http://localhost:9999' } },
      },
    }),
  );

  const mcpPath = '/new/path/pm-mcp.mjs';
  const pmUrl = 'http://localhost:8790';
  writeMcpConfig(tmpDir, mcpPath, pmUrl);

  const config = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
  expect(config.mcpServers.pocketmockster.env.PM_URL).toBe(pmUrl);
  expect(config.mcpServers.pocketmockster.args).toContain(mcpPath);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
