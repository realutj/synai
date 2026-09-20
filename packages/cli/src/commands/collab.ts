/**
 * Multi-Agent Collaboration Command
 * Launch multiple AI agents to discuss and solve problems together
 */

import { Command } from "commander";
import { MultiAgentOrchestrator, DEFAULT_AGENTS } from "@synai/core";

// Output utilities - will be injected via closure
let writeln: (str: string) => void = console.log;
let writeErr: (str: string) => void = console.error;

export function setCollabOutput(
  writeOutput: (str: string) => void,
  writeError: (str: string) => void,
) {
  writeln = writeOutput;
  writeErr = writeError;
}

interface CollabOptions {
  agents?: string;
  rounds?: string;
  models?: string;
  provider?: string;
  key?: string;
  verbose?: boolean;
}

/**
 * Create the collaboration command
 */
export function createCollabCommand(): Command {
  const cmd = new Command("collab");

  cmd
    .description(
      "🤝 Multi-agent collaboration mode - AI agents discuss and solve problems together",
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
    .option("-v, --verbose", "Show detailed agent reasoning")
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

  try {
    // Parse agent selection
    const agentIds = options.agents
      ? options.agents.split(",").map((id) => id.trim())
      : ["architect", "developer", "reviewer"];

    const selectedAgents = DEFAULT_AGENTS.filter((agent) =>
      agentIds.includes(agent.id),
    );

    if (selectedAgents.length === 0) {
      writeErr("❌ No valid agents selected\n");
      writeln("Available agents:");
      DEFAULT_AGENTS.forEach((agent) => {
        writeln(`  • ${agent.id} - ${agent.role}`);
      });
      process.exit(1);
    }

    // Parse model selection
    let modelAssignments: Map<string, string> = new Map();

    if (options.models) {
      const models = options.models.split(",").map((m) => m.trim());

      if (models.length === 1) {
        // Single model - use for all agents
        selectedAgents.forEach((agent) => {
          modelAssignments.set(agent.id, models[0]);
        });
      } else if (models.length === selectedAgents.length) {
        // One model per agent
        selectedAgents.forEach((agent, index) => {
          modelAssignments.set(agent.id, models[index]);
        });
      } else {
        writeErr(
          `❌ Model count mismatch: ${models.length} models for ${selectedAgents.length} agents\n`,
        );
        writeln(
          "Either provide one model for all agents, or one model per agent.",
        );
        process.exit(1);
      }
    } else {
      // Default model
      selectedAgents.forEach((agent) => {
        modelAssignments.set(agent.id, "claude-3.5-sonnet");
      });
    }

    writeln(`✅ Starting collaboration with ${selectedAgents.length} agents\n`);

    // Display participants
    writeln("═══════════════════════════════════════════════════════");
    writeln("🤝 MULTI-AGENT COLLABORATION");
    writeln(`Topic: ${topic}`);
    writeln("═══════════════════════════════════════════════════════\n");

    writeln("Participants:");
    selectedAgents.forEach((agent) => {
      const model = modelAssignments.get(agent.id) || "default";
      writeln(`  • ${agent.name} — ${agent.role} [${model}]`);
    });
    writeln("");

    // Initialize orchestrator
    const orchestrator = new MultiAgentOrchestrator();
    const session = await orchestrator.startSession(
      topic,
      selectedAgents,
      parseInt(options.rounds),
    );

    const maxRounds = parseInt(options.rounds);

    // Collaboration loop
    writeln("Discussion:\n");

    for (let round = 0; round < maxRounds; round++) {
      for (const agent of selectedAgents) {
        // Get conversation context
        const context = orchestrator.getConversationContext(
          session.id,
          agent.id,
        );

        // Simulate agent response (in real implementation, this would call LLM)
        const response = await generateAgentResponse(
          agent,
          topic,
          context,
          round,
          options,
        );

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
        const icon = round === maxRounds - 1 ? "✅" : round === 0 ? "💡" : "💬";
        const agentModel = modelAssignments.get(agent.id) || "default";
        writeln(`${icon} ${agent.name} [${agentModel}]:`);
        writeln(`   ${response}\n`);

        // Small delay for readability
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Check for consensus
      if (orchestrator.hasReachedConsensus(session.id)) {
        writeln("✅ Consensus reached!\n");
        break;
      }

      if (round < maxRounds - 1) {
        writeln(`--- Round ${round + 2} ---\n`);
      }
    }

    // Generate final summary
    const finalResult = generateFinalSummary(session.id, orchestrator);
    orchestrator.completeSession(session.id, finalResult);

    // Display final result
    writeln("\n═══════════════════════════════════════════════════════");
    writeln("✅ FINAL DECISION:\n");
    writeln(finalResult);
    writeln("═══════════════════════════════════════════════════════");
  } catch (error) {
    writeErr("❌ Collaboration failed");
    writeErr("\n" + (error as Error).message);
    process.exit(1);
  }
}

/**
 * Generate agent response (placeholder - real implementation would call LLM)
 */
async function generateAgentResponse(
  agent: any,
  topic: string,
  context: string,
  round: number,
  options: CollabOptions,
): Promise<string> {
  // TODO: Integrate with OpenRouter API
  // This is a placeholder that generates demo responses

  const responses: Record<string, string[]> = {
    architect: [
      `For this problem, I suggest we design a modular architecture with clear separation of concerns. We should consider scalability from the start.`,
      `I agree with the implementation approach, but let's ensure we have proper error handling and logging infrastructure.`,
      `The proposed solution looks solid. Let's move forward with this design.`,
    ],
    developer: [
      `I can implement this using TypeScript with strict typing. We'll need proper unit tests and integration tests.`,
      `The architecture makes sense. I'll focus on clean code patterns and maintainability.`,
      `Approved. I'll start with the core implementation and ensure everything is well-documented.`,
    ],
    reviewer: [
      `What about edge cases? We need to handle network failures, timeouts, and rate limiting.`,
      `Security-wise, we should validate all inputs and sanitize user data. Also consider CSRF protection.`,
      `Looks good overall. Let's proceed with proper monitoring and alerting in place.`,
    ],
  };

  const agentResponses = responses[agent.id] || [
    "I agree with the proposed approach.",
  ];
  const responseIndex = Math.min(round, agentResponses.length - 1);

  return agentResponses[responseIndex];
}

/**
 * Generate final summary from session
 */
function generateFinalSummary(
  sessionId: string,
  orchestrator: MultiAgentOrchestrator,
): string {
  const session = orchestrator.getSession(sessionId);
  if (!session) return "Unable to generate summary.";

  return `The team has reached consensus on the approach for: "${session.topic}"

Key Decisions:
• Architecture: Modular design with separation of concerns
• Implementation: TypeScript with strict typing and comprehensive tests
• Quality: Proper error handling, security validation, and monitoring

Next Steps:
1. Begin implementation of core modules
2. Set up CI/CD pipeline with automated testing
3. Implement monitoring and logging infrastructure
4. Document API and deployment procedures

All agents have approved this plan. Ready to proceed with implementation.`;
}

export default createCollabCommand;
