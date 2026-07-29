// Codex SDK engine: wraps the OpenAI Codex SDK behind the same {turn, usage}
// interface that cursor-engine.mjs exposes, so player.mjs can swap engines
// without touching the digest loop or event logging.

import { Codex } from '@openai/codex-sdk';

/**
 * Create a Codex SDK session.
 *
 * @param {object} opts
 * @param {string} opts.model         - codex model name (e.g. "gpt-5.6-sol")
 * @param {string} opts.effort        - reasoning effort (low|medium|high|xhigh)
 * @param {string} opts.cwd           - working directory
 * @param {string} opts.mcpPath       - absolute path to pm-mcp.mjs
 * @param {string} opts.pmUrl         - PM_URL for the MCP server env
 * @param {function} opts.onEvent     - callback for normalized events
 * @returns {{ turn: function, totals: object }}
 */
export function createCodexSession({ model, effort, cwd, mcpPath, pmUrl, onEvent }) {
  const codex = new Codex({
    config: {
      mcp_servers: {
        pm: {
          command: process.execPath,
          args: [mcpPath],
          env: { PM_URL: pmUrl },
        },
      },
    },
  });

  const thread = codex.startThread({
    model,
    modelReasoningEffort: effort,
    sandboxMode: 'read-only',
    // NOTE: approval_policy "never" auto-cancels MCP tool calls in codex exec;
    // "on-request" auto-approves them in non-interactive mode.
    approvalPolicy: 'on-request',
    skipGitRepoCheck: true,
    workingDirectory: cwd,
    networkAccessEnabled: false,
  });

  const totals = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };

  async function turn(prompt) {
    let lastAgentText = '';
    const streamed = await thread.runStreamed(prompt);

    for await (const event of streamed.events) {
      if (event.type !== 'item.completed') {
        if (event.type === 'turn.completed') {
          const u = event.usage ?? {};
          totals.input_tokens += u.input_tokens ?? 0;
          totals.cached_input_tokens += u.cached_input_tokens ?? 0;
          totals.output_tokens += u.output_tokens ?? 0;
        }
        continue;
      }

      const item = event.item;
      if (item.type === 'agent_message') {
        lastAgentText = item.text;
        onEvent({ type: 'agent_message', text: item.text });
      } else if (item.type === 'reasoning') {
        onEvent({ type: 'agent_reasoning', text: item.text });
      } else if (item.type === 'mcp_tool_call') {
        onEvent({
          type: 'tool_call',
          tool: item.tool,
          arguments: item.arguments,
          error: item.error?.message ?? null,
        });
      } else if (item.type === 'command_execution') {
        onEvent({ type: 'shell', command: item.command, exitCode: item.exit_code ?? null });
      } else if (item.type === 'error') {
        onEvent({ type: 'error', message: item.message });
      }
    }

    return { text: lastAgentText, usage: { ...totals }, isError: false };
  }

  return { turn, totals };
}
