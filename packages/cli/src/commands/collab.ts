/**
 * Multi-Agent Collaboration Command
 * Launch multiple AI agents to discuss and solve problems together
 */

import { Command } from "commander";
import {
	DEFAULT_AGENTS,
	MultiAgentOrchestrator,
	OpenRouterClient,
	ProviderSettingsManager,
	getPersistedProviderApiKey,
} from "@synai/core";

// Output utilities - will be injected via closure
let writeln: (str: string) => void = console.log;
let writeErr: (str: string) => void = console.error;
let reportExitCode: (code: number) => void = (code) => { process.exitCode = code; };

export function setCollabOutput(
  writeOutput: (str: string) => void,
  writeError: (str: string) => void,
  setExitCode?: (code: number) => void,
) {
  writeln = writeOutput;
  writeErr = writeError;
  if (setExitCode) reportExitCode = setExitCode;
}

interface CollabOptions {
  agents?: string;
  rounds?: string;
  models?: string;
  provider?: string;
  key?: string;
  verbose?: boolean;
}

function normalizeModelId(providerId: string, modelId: string): string {
  const model = modelId.trim();
  if (!model) throw new Error("Model IDs cannot be empty.");
  if (providerId !== "openrouter" || model.includes("/")) return model;

  // Keep the short IDs shown in the CLI examples compatible with OpenRouter.
  const aliases: Record<string, string> = {
    "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
    "claude-3-5-sonnet": "anthropic/claude-3.5-sonnet",
    "gpt-4": "openai/gpt-4",
    "gpt-4-turbo": "openai/gpt-4-turbo",
    "gpt-4o": "openai/gpt-4o",
    "gemini-pro": "google/gemini-pro-1.5",
    "deepseek-chat": "deepseek/deepseek-chat",
  };
  return aliases[model.toLowerCase()] || model;
}

/**
 * Create the collaboration command
 */
export function createCollabCommand(): Command {
  const cmd = new Command("collab").alias("collaborate").alias("multi");

  cmd
    .description(
      "[COLLAB] Multi-agent collaboration mode - AI agents discuss and solve problems together",
    )
    .argument("<topic>", "Problem or task for agents to discuss")
    .option(
      "-a, --agents <names>",
      "Comma-separated agent IDs to use (default: architect,developer,reviewer)",
    )
    .option(
      "-r, --rounds <number>",
      "Maximum discussion rounds (default: 5)",
      "5",
    )
    .option(
      "-m, --models <models>",
      "Comma-separated models for each agent (e.g., 'claude-3.5-sonnet,gpt-4,deepseek-chat')",
    )
    .option("-P, --provider <id>", "Provider service (default: openrouter)")
    .option("-k, --key <api-key>", "API key override")
    .option("-v, --verbose", "Show provider, model, and response timing diagnostics")
    .addHelpText(
      "after",
      `

Examples:
  $ synai collab "Build REST API" -m "claude-3.5-sonnet,gpt-4-turbo,deepseek-chat"
  $ synai collab "Fix bugs" --models "gemini-pro" --rounds 3
  $ synai collab "Design system" -a architect,developer -m "claude-3.5-sonnet,gpt-4"
    `,
    )
    .action(async (topic: string, options: CollabOptions) => {
      await runCollaboration(topic, options);
    });

  return cmd;
}

/**
 * Run multi-agent collaboration session
 */
async function runCollaboration(
  topic: string,
  options: CollabOptions,
): Promise<void> {
  writeln("Initializing multi-agent collaboration...\n");
  const markFailed = () => reportExitCode(1);

  try {
    const roundsCount = Number(options.rounds ?? "5");
    if (!Number.isInteger(roundsCount) || roundsCount < 1 || roundsCount > 8) {
      throw new Error("--rounds must be an integer from 1 to 8.");
    }

    // Parse agent selection
    const agentIds = options.agents
      ? [...new Set(options.agents.split(",").map((id) => id.trim()).filter(Boolean))]
      : ["architect", "developer", "reviewer"];

    const unknownAgentIds = agentIds.filter(
      (id) => !DEFAULT_AGENTS.some((agent) => agent.id === id),
    );
    if (unknownAgentIds.length > 0) {
      writeErr(`[FAIL] Unknown agent(s): ${unknownAgentIds.join(", ")}`);
      writeln(`Available agents: ${DEFAULT_AGENTS.map((agent) => agent.id).join(", ")}`);
      markFailed();
      return;
    }

    const selectedAgents = DEFAULT_AGENTS.filter((agent) =>
      agentIds.includes(agent.id),
    );

    if (selectedAgents.length === 0) {
      writeErr("[FAIL] No valid agents selected\n");
      writeln("Available agents:");
      DEFAULT_AGENTS.forEach((agent) => {
        writeln(`  * ${agent.id} - ${agent.role}`);
      });
      markFailed();
      return;
    }

    // Parse model selection
    let modelAssignments: Map<string, string> = new Map();

    if (options.models) {
      const models = options.models.split(",").map((m) => m.trim());

      if (models.length === 1) {
        // Single model - use for all agents
        selectedAgents.forEach((agent) => {
          modelAssignments.set(agent.id, normalizeModelId((options.provider || "openrouter").trim().toLowerCase(), models[0]));
        });
      } else if (models.length === selectedAgents.length) {
        // One model per agent
        selectedAgents.forEach((agent, index) => {
          modelAssignments.set(agent.id, normalizeModelId((options.provider || "openrouter").trim().toLowerCase(), models[index]));
        });
      } else {
        writeErr(
          `[FAIL] Model count mismatch: ${models.length} models for ${selectedAgents.length} agents\n`,
        );
        writeln(
          "Either provide one model for all agents, or one model per agent.",
        );
        markFailed();
        return;
      }
    } else {
      // Default model
      const provider = (options.provider || "openrouter").trim().toLowerCase();
      const settings = new ProviderSettingsManager().getProviderSettings(provider);
      const defaultModel =
        settings.modelId || settings.model ||
        ({
          openrouter: "openrouter/free",
          openai: "gpt-4o",
          "openai-codex": "gpt-5.6-luna",
          anthropic: "claude-3-7-sonnet-20250219",
          deepseek: "deepseek-chat",
          google: "gemini-2.0-flash",
          gemini: "gemini-2.0-flash",
          groq: "llama-3.3-70b-versatile",
          ollama: "llama3.2",
          mistral: "mistral-large-latest",
          xai: "grok-2-latest",
          opencode: "openrouter/free",
        } as Record<string, string>)[provider] || "openrouter/free";
      selectedAgents.forEach((agent) => modelAssignments.set(agent.id, normalizeModelId(provider, defaultModel)));
    }

    writeln(`[OK] Starting collaboration with ${selectedAgents.length} agents\n`);

    const providerId = (options.provider || "openrouter").trim().toLowerCase();
    const providerSettings = new ProviderSettingsManager().getProviderSettings(providerId);
    const apiKey = options.key?.trim() || getPersistedProviderApiKey(providerId);
    const baseUrl =
      providerSettings.baseUrl ||
      ({
        openrouter: "https://openrouter.ai/api/v1",
        openai: "https://api.openai.com/v1",
        "openai-codex": "https://chatgpt.com/backend-api/codex",
        anthropic: "https://api.anthropic.com/v1",
        deepseek: "https://api.deepseek.com/v1",
        google: "https://generativelanguage.googleapis.com/v1beta/openai",
        gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
        groq: "https://api.groq.com/openai/v1",
        ollama: "http://localhost:11434/v1",
        mistral: "https://api.mistral.ai/v1",
        xai: "https://api.x.ai/v1",
        opencode: "https://opencode.ai/zen/v1",
      } as Record<string, string>)[providerId];
    const localProvider = ["ollama", "lm-studio", "openai-compatible", "byo"].includes(providerId);
    if (!baseUrl) {
      throw new Error(`Unsupported provider "${providerId}". Configure a provider base URL or choose a supported provider.`);
    }
    if (!apiKey && !localProvider && providerId !== "opencode") {
      writeErr(`[FAIL] No API key is configured for ${providerId}. Run synai provider or pass --key.`);
      markFailed();
      return;
    }
    const client = new OpenRouterClient(apiKey || (providerId === "opencode" ? "public" : "local"), baseUrl);

    // Display participants
    writeln("=======================================================");
    writeln("[COLLAB] MULTI-AGENT COLLABORATION");
    writeln(`Topic: ${topic}`);
    writeln("=======================================================\n");

    writeln("Participants:");
    selectedAgents.forEach((agent) => {
      const model = modelAssignments.get(agent.id) || "default";
      writeln(`  * ${agent.name} - ${agent.role} [${model}]`);
    });
    writeln("");

    // Initialize orchestrator
    const orchestrator = new MultiAgentOrchestrator();
    const session = await orchestrator.startSession(
      topic,
      selectedAgents,
      roundsCount,
    );

    const maxRounds = roundsCount;

    // Collaboration loop
    writeln("Discussion:\n");

    for (let round = 0; round < maxRounds; round++) {
        const responses = await Promise.all(
        selectedAgents.map(async (agent) => {
          const context = orchestrator.getConversationContext(session.id, agent.id);
          const model = modelAssignments.get(agent.id) || "openrouter/free";
          const startedAt = Date.now();
          const response = await generateAgentResponse(client, agent, topic, context, round, model);
          return { agent, model, response, elapsedMs: Date.now() - startedAt };
        }),
      );
      for (const { agent, model: agentModel, response, elapsedMs } of responses) {
        // Add message to session
        orchestrator.addMessage(session.id, {
          agentId: agent.id,
          agentName: agent.name,
          content: response,
          type:
            round === maxRounds - 1
              ? "final"
              : round === 0
                ? "proposal"
                : "discussion",
        });

        // Display message
        const icon = round === maxRounds - 1 ? "[OK]" : round === 0 ? "[IDEA]" : ">";
        writeln(`${icon} ${agent.name} [${agentModel}]:`);
        writeln(`   ${response}\n`);
        if (options.verbose) writeln(`   [timing] ${elapsedMs} ms via ${providerId}\n`);
      }

      if (round < maxRounds - 1) {
        writeln(`--- Round ${round + 2} ---\n`);
      }
    }

    // Generate final summary
    const finalResult = await generateFinalSummary(
      client,
      modelAssignments.get(selectedAgents[0].id) || "openrouter/free",
      topic,
      orchestrator.getSession(session.id)?.messages || [],
    );
    orchestrator.completeSession(session.id, finalResult);

    // Display final result
    writeln("\n=======================================================");
    writeln("[OK] FINAL DECISION:\n");
    writeln(finalResult);
    writeln("=======================================================");
    reportExitCode(0);
  } catch (error) {
    writeErr("[FAIL] Collaboration failed");
    writeErr("\n" + (error instanceof Error ? error.message : String(error)));
    markFailed();
  }
}

/**
 * Generate one role-specific response without exposing coding tools to the participants.
 */
async function generateAgentResponse(
  client: OpenRouterClient,
  agent: (typeof DEFAULT_AGENTS)[number],
  topic: string,
  context: string,
  round: number,
  model: string,
): Promise<string> {
  const systemPrompt = `${agent.systemPrompt}\n\nYou are participating in a multi-agent discussion. Do not claim consensus unless the discussion supports it. Be concise and specific. Do not use tools or make changes.`;
  const userPrompt = `Topic: ${topic}\nRound: ${round + 1}\n\n${context}\n\nGive your perspective for this round. Address disagreements directly and add a concrete recommendation.`;
  const response = await client.chatStream(
    model,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    [],
    {},
    { maxTokens: 1200, temperature: 0.4 },
  );
  if (!response.content.trim()) throw new Error(`${agent.name} returned an empty response.`);
  return response.content.trim();
}

/**
 * Generate final summary from session
 */
async function generateFinalSummary(
  client: OpenRouterClient,
  model: string,
  topic: string,
  messages: Array<{ agentName: string; content: string }>,
): Promise<string> {
  const transcript = messages.map((message) => `${message.agentName}: ${message.content}`).join("\n\n");
  const response = await client.chatStream(
    model,
    [
      {
        role: "system",
        content: "You are a neutral facilitator. Synthesize the discussion accurately. Separate points of agreement, disagreements, and recommended next steps. Never invent decisions or claim unanimous consensus without evidence.",
      },
      { role: "user", content: `Topic: ${topic}\n\nDiscussion:\n${transcript}\n\nWrite a short, evidence-based synthesis.` },
    ],
    [],
    {},
    { maxTokens: 1600, temperature: 0.2 },
  );
  if (!response.content.trim()) throw new Error("The facilitator returned an empty synthesis.");
  return response.content.trim();
}

export default createCollabCommand;
