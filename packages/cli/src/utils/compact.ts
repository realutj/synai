import type { Message } from '@synai-code/core';

const FILE_TOOLS = new Set(['write_file', 'edit_file', 'view_file', 'batch_edit']);

/**
 * Pulls a short, human-readable trace out of the messages being dropped during
 * compaction: which files were touched, which commands ran, and what the user
 * actually asked for. This is what gets folded into the summary so compaction
 * loses detail, not the whole task.
 */
function extractStructuredTrace(messages: Message[]): {
  filesTouched: string[];
  commandsRun: string[];
  userRequests: string[];
} {
  const filesTouched = new Set<string>();
  const commandsRun: string[] = [];
  const userRequests: string[] = [];

  for (const m of messages) {
    if (m.role === 'user' && m.content?.trim()) {
      userRequests.push(m.content.trim().slice(0, 160));
    }
    if (m.role === 'assistant' && m.tool_calls) {
      for (const call of m.tool_calls) {
        try {
          const args = JSON.parse(call.function.arguments || '{}');
          if (FILE_TOOLS.has(call.function.name) && args.path) {
            filesTouched.add(args.path);
          }
          if (call.function.name === 'batch_edit' && Array.isArray(args.operations)) {
            for (const op of args.operations) {
              if (op?.path) filesTouched.add(op.path);
            }
          }
          if (call.function.name === 'run_command' && args.command) {
            commandsRun.push(String(args.command).slice(0, 120));
          }
        } catch {
          // Malformed args in a historical message - nothing useful to extract.
        }
      }
    }
  }

  return { filesTouched: [...filesTouched], commandsRun, userRequests };
}

/**
 * Compacts a long conversation into a short synthetic summary message plus a
 * verbatim tail, instead of discarding everything but the very last message.
 * This is a heuristic (non-LLM) compaction: it can't paraphrase intent the way
 * an actual summarization pass would, but it preserves the concrete facts
 * (files touched, commands run, what the user asked for) that the agent needs
 * to keep working coherently after the cut.
 */
export function compactConversation(messages: Message[], instructions?: string): Message[] {
  if (messages.length === 0) return messages;

  const systemMsg = messages[0]?.role === 'system' ? messages[0] : undefined;
  const rest = systemMsg ? messages.slice(1) : messages;

  const KEEP_RECENT = 8; // keep enough recent turns for immediate continuity
  if (rest.length <= KEEP_RECENT) return messages; // not worth compacting yet

  const recent = rest.slice(-KEEP_RECENT);
  const older = rest.slice(0, rest.length - KEEP_RECENT);

  const { filesTouched, commandsRun, userRequests } = extractStructuredTrace(older);

  const summaryLines: string[] = [
    `[Compacted ${older.length} earlier messages to free up context.]`,
  ];
  if (userRequests.length > 0) {
    summaryLines.push(`Earlier requests: ${userRequests.slice(-5).join(' | ')}`);
  }
  if (filesTouched.length > 0) {
    summaryLines.push(`Files touched so far: ${filesTouched.join(', ')}`);
  }
  if (commandsRun.length > 0) {
    summaryLines.push(`Commands run: ${commandsRun.slice(-8).join(' ; ')}`);
  }
  if (instructions?.trim()) {
    summaryLines.push(`User compaction note: ${instructions.trim()}`);
  }
  summaryLines.push(
    'The full detail of these earlier steps is gone - if you need it, re-inspect the relevant files or re-run the relevant commands rather than assuming their exact prior output.'
  );

  const summaryMessage: Message = { role: 'system', content: summaryLines.join('\n') };

  return systemMsg ? [systemMsg, summaryMessage, ...recent] : [summaryMessage, ...recent];
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function getContextUsage(messages: Message[], maxContext: number): { used: number; max: number; percent: number; cached: number } {
  let used = 0;
  for (const m of messages) {
    used += estimateTokenCount(m.content || '');
  }
  return {
    used,
    max: maxContext,
    percent: Math.round((used / maxContext) * 100),
    cached: 0 // Mocked cached count
  };
}

export function formatContextUsage(usage: ReturnType<typeof getContextUsage>): string {
  const barLength = 20;
  const filled = Math.round((usage.percent / 100) * barLength);
  const bar = '[' + '#'.repeat(filled) + '-'.repeat(barLength - filled) + ']';
  return `Context Usage: ${bar} ${usage.percent}% (${usage.used}/${usage.max} tokens)`;
}

export function formatCostSummary(tokenCount: { input: number; output: number; cached: number }, model: string): string {
  const isFreeModel = model.endsWith(':free') || model === 'openrouter/free';

  if (isFreeModel) {
    return (
      `Cost Summary for ${model}:\n` +
      `Input: ${tokenCount.input} tokens\n` +
      `Output: ${tokenCount.output} tokens\n` +
      `Cached: ${tokenCount.cached} tokens\n` +
      `Estimated Cost: $0.0000 (free-tier model)`
    );
  }

  // We don't have this model's real per-token pricing on hand here (that requires
  // an extra fetch to OpenRouter's /models endpoint), so rather than presenting a
  // fabricated-but-precise-looking dollar figure, show a clearly-labeled rough
  // estimate at generic paid-model rates and point at the source of truth.
  const GENERIC_INPUT_RATE_PER_1K = 0.01;
  const GENERIC_OUTPUT_RATE_PER_1K = 0.03;
  const inputCost = (tokenCount.input / 1000) * GENERIC_INPUT_RATE_PER_1K;
  const outputCost = (tokenCount.output / 1000) * GENERIC_OUTPUT_RATE_PER_1K;
  const total = inputCost + outputCost;
  return (
    `Cost Summary for ${model}:\n` +
    `Input: ${tokenCount.input} tokens\n` +
    `Output: ${tokenCount.output} tokens\n` +
    `Cached: ${tokenCount.cached} tokens\n` +
    `Rough Estimate: $${total.toFixed(4)} (generic rate, NOT this model's actual price - check openrouter.ai/models/${model} for exact pricing)`
  );
}
