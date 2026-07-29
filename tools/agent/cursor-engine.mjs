// Cursor CLI engine: drives a cursor-agent subprocess that plays Pocket
// Mockster via MCP tools. Mirrors the {turn, usage} interface that
// codex-engine.mjs exposes so player.mjs can use either engine.
//
// cursor-agent stream-json event shapes (verified by live probes):
//   system/init     -> { session_id, model }
//   thinking/delta  -> { text }
//   thinking/completed
//   assistant       -> { message: { content: [{ type:"text", text }] } }
//   tool_call/started   -> { tool_call: { mcpToolCall: { args: { toolName, args } } } }
//   tool_call/completed -> { tool_call: { mcpToolCall: { result: { success: { content: [{ text: { text } }] } } } } }
//   result          -> { is_error, result, usage: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } }

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Write a workspace-scoped .cursor/mcp.json that exposes the pocketmockster
 * MCP server. Merges into an existing file without clobbering other servers.
 * Returns the path to the written file.
 */
export function writeMcpConfig(workspaceDir, mcpPath, pmUrl) {
  const cursorDir = path.join(workspaceDir, '.cursor');
  const configPath = path.join(cursorDir, 'mcp.json');
  fs.mkdirSync(cursorDir, { recursive: true });

  let config = { mcpServers: {} };
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config.mcpServers) config.mcpServers = {};
  } catch {
    // fresh
  }

  config.mcpServers.pocketmockster = {
    command: process.execPath,
    args: [mcpPath],
    env: { PM_URL: pmUrl },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

// mcpToolCall is handled on its own path; tool discovery is not a game action.
const SILENT_TOOL_CALLS = new Set(['mcpToolCall', 'getMcpToolsToolCall']);

/**
 * Parse a single stream-json line into a normalized event.
 * Returns null for lines that don't map to an actionable event.
 */
export function parseStreamEvent(rawLine) {
  let e;
  try {
    e = JSON.parse(rawLine);
  } catch {
    return null;
  }

  switch (e.type) {
    case 'system':
      if (e.subtype === 'init') return { type: 'session', sessionId: e.session_id, model: e.model };
      return null;

    case 'thinking':
      if (e.subtype === 'delta' && e.text) return { type: 'agent_reasoning', text: e.text };
      return null;

    case 'assistant': {
      const content = e.message?.content ?? [];
      const text = content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('');
      return text ? { type: 'agent_message', text } : null;
    }

    case 'tool_call': {
      const tc = e.tool_call ?? {};
      // MCP tool calls
      if (tc.mcpToolCall) {
        const mc = tc.mcpToolCall;
        const toolName = mc.args?.toolName ?? mc.args?.name ?? 'unknown';
        const toolArgs = mc.args?.args ?? {};
        if (e.subtype === 'started') {
          return { type: 'tool_call', tool: toolName, arguments: toolArgs, error: null };
        }
        if (e.subtype === 'completed') {
          const result = mc.result ?? {};
          const success = result.success ?? result;
          const content = success?.content ?? [];
          // cursor wraps MCP text content as { text: { text: "..." } }
          const rawText = content
            .map((c) => (typeof c.text === 'string' ? c.text : c.text?.text ?? ''))
            .join('');
          const isError = success?.isError === true;
          return {
            type: 'tool_result',
            tool: toolName,
            arguments: toolArgs,
            result: rawText,
            error: isError ? rawText : null,
          };
        }
      }
      // Built-in tools (read/grep/shell/...) let the agent inspect the game
      // source instead of discovering it by playing, so surface them rather
      // than dropping them. Tool-discovery calls are harmless and stay quiet.
      if (e.subtype === 'started') {
        const key = Object.keys(tc).find((k) => k.endsWith('ToolCall') && !SILENT_TOOL_CALLS.has(k));
        if (key) {
          return {
            type: 'agent_tool',
            tool: key.replace(/ToolCall$/, ''),
            detail: JSON.stringify(tc[key]?.args ?? {}).slice(0, 200),
          };
        }
      }
      return null;
    }

    case 'result':
      return {
        type: 'result',
        isError: e.is_error === true,
        text: e.result ?? '',
        usage: {
          inputTokens: e.usage?.inputTokens ?? 0,
          outputTokens: e.usage?.outputTokens ?? 0,
          cacheReadTokens: e.usage?.cacheReadTokens ?? 0,
          cacheWriteTokens: e.usage?.cacheWriteTokens ?? 0,
        },
      };

    default:
      return null;
  }
}

const ERROR_PATTERNS = [
  /Authentication required/i,
  /Cannot use this model/i,
  /usage limit/i,
  /rate limit/i,
];

/**
 * Create a Cursor CLI session that can be driven turn-by-turn.
 *
 * @param {object} opts
 * @param {string} opts.model       - full cursor model name (e.g. "composer-2.5")
 * @param {string} opts.cwd         - workspace directory for cursor-agent
 * @param {function} opts.onEvent   - callback for normalized events
 * @returns {{ turn: function, totals: object }}
 */
export function createCursorSession({ model, cwd, onEvent }) {
  let sessionId = null;
  const totals = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };

  async function turn(prompt) {
    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--trust',
      '--force',
      '--approve-mcps',
      '--model', model,
    ];
    if (sessionId) args.push('--resume', sessionId);

    return new Promise((resolve, reject) => {
      // PM_CURSOR_BIN allows an absolute path when cursor-agent is not on PATH.
      const proc = spawn(process.env.PM_CURSOR_BIN || 'cursor-agent', args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdoutBuf = '';
      let stderrBuf = '';
      let lastAgentText = '';
      let gotResult = false;

      proc.stdout.on('data', (chunk) => {
        stdoutBuf += chunk.toString();
        let nl;
        while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
          const line = stdoutBuf.slice(0, nl).trim();
          stdoutBuf = stdoutBuf.slice(nl + 1);
          if (!line) continue;

          const evt = parseStreamEvent(line);
          if (!evt) continue;

          if (evt.type === 'session') {
            sessionId = evt.sessionId;
          } else if (evt.type === 'agent_message') {
            lastAgentText = evt.text;
            onEvent(evt);
          } else if (evt.type === 'agent_reasoning') {
            onEvent(evt);
          } else if (evt.type === 'tool_call') {
            onEvent(evt);
          } else if (evt.type === 'tool_result') {
            onEvent(evt);
          } else if (evt.type === 'agent_tool') {
            onEvent(evt);
          } else if (evt.type === 'result') {
            gotResult = true;
            totals.input_tokens += evt.usage.inputTokens;
            totals.cached_input_tokens += evt.usage.cacheReadTokens;
            totals.output_tokens += evt.usage.outputTokens;
            resolve({
              // e.result concatenates every interim message from the turn, but
              // the completion protocol is about the agent's final message, so
              // the last discrete one wins.
              text: lastAgentText || evt.text,
              usage: { ...totals },
              isError: evt.isError,
            });
          }
        }
      });

      proc.stderr.on('data', (chunk) => {
        stderrBuf += chunk.toString();
      });

      proc.on('error', (err) => {
        reject(new Error(`cursor-agent spawn failed: ${err.message}`));
      });

      proc.on('exit', (code) => {
        if (gotResult) return;
        // Check stderr for known error patterns
        for (const pat of ERROR_PATTERNS) {
          if (pat.test(stderrBuf)) {
            reject(new Error(stderrBuf.trim().slice(0, 400)));
            return;
          }
        }
        if (code !== 0 && !gotResult) {
          const detail = stderrBuf.trim().slice(0, 400) || `cursor-agent exited with code ${code}`;
          reject(new Error(detail));
        }
      });

      // Send the prompt
      proc.stdin.write(prompt);
      proc.stdin.end();
    });
  }

  return { turn, totals };
}
