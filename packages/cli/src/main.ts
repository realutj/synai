import { fstatSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { ToolPolicy } from "@synai/core";

import { registerDisposable } from "@synai/shared";
import type { Command } from "commander";
import { registerHistoryCommand } from "./commands/history-command";
import {
  CommanderError,
  commanderToParsedArgs,
  createProgram,
} from "./commands/program";
import { autoUpdateOnStartup } from "./commands/update";
import { CLI_DEFAULT_CHECKPOINT_CONFIG } from "./runtime/defaults";
import type { TuiStartupTarget } from "./tui/types";
import { filterChatModels } from "./utils/chat-models";
import { getCliBuildInfo } from "./utils/common";
import {
  buildCliCompactionConfig,
  CLI_COMPACTION_MODE_EXPECTED_TEXT,
} from "./utils/compaction-mode";
import {
  refreshCliFeatureFlagsInBackground,
  setCliFeatureFlagsAccountContext,
} from "./utils/feature-flags";
import {
  configureSandboxEnvironment,
  normalizeAutoApproveArgs,
  resolveWorkspaceRoot,
} from "./utils/helpers";
import {
  c,
  installStreamErrorGuards,
  setCurrentOutputMode,
  writeErr,
  writeln,
} from "./utils/output";
import {
  ensureOAuthProviderApiKey,
  getPersistedProviderApiKey,
  isOAuthProvider,
  normalizeProviderId,
} from "./utils/provider-auth";
import { resolveCliReasoning } from "./utils/reasoning";
import {
  resolveStartupCompactionMode,
  resolveStartupMode,
  resolveStartupToolAutoApprove,
} from "./utils/startup-settings";
import { rewriteTeamPrompt, TEAM_COMMAND_USAGE } from "./utils/team-command";
import {
  captureCliExtensionActivated,
  getCliTelemetryService,
  identifyTelemetryAccount,
} from "./utils/telemetry";
import type { Config } from "./utils/types";
import { runConnectWizard } from "./wizards/connect";
import { runMcpWizard } from "./wizards/mcp";
import { runScheduleWizard } from "./wizards/schedule";

export function stdinHasPipedInput(): boolean {
  if (process.stdin.isTTY) return false;
  try {
    const stats = fstatSync(0);
    return stats.isFIFO() || stats.isFile();
  } catch {
    return false;
  }
}

async function createProviderSettingsManager() {
  const { ProviderSettingsManager } = await import("@synai/core");
  return new ProviderSettingsManager();
}

async function loadCliRuntimeModules() {
  const [coreServer, prompt, runAgentModule] = await Promise.all([
    import("@synai/core"),
    import("./runtime/prompt"),
    import("./runtime/run-agent"),
  ]);
  return {
    coreServer,
    resolveSystemPrompt: prompt.resolveSystemPrompt,
    runAgent: runAgentModule.runAgent,
  };
}

async function loadInteractiveRuntimeModule() {
  const { runInteractive } = await import("./runtime/run-interactive");
  return runInteractive;
}

/**
 * Two-pass approach for --config: a quick scan of process.argv extracts the
 * config directory before commander parses, because setClineDir() must run
 * before any code that reads the home/config directory.
 *
 * Recognizes both Commander spellings:
 *   --config <dir>
 *   --config=<dir>
 *
 * Exported for unit testing; callers in this file should use this rather
 * than reimplementing the scan.
 */
export function resolveConfigDirArg(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--config") {
      const value = argv[i + 1]?.trim();
      return value ? value : undefined;
    }
    if (arg?.startsWith("--config=")) {
      const value = arg.slice("--config=".length).trim();
      return value ? value : undefined;
    }
  }
  return undefined;
}

function collectOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

// Shells strip quote characters before argv reaches us, so a prompt that was
// typed in quotes is only observable when it remains one argv token with spaces.
function promptArgLooksQuoted(arg: string | undefined): boolean {
  return !!arg && /\s/.test(arg);
}

function writePromptArgError(args: string[]): void {
  const renderedArgs = args.join(" ");
  writeErr(
    `Unknown command or unquoted prompt: ${renderedArgs}\nPrompt text must be passed as a single quoted argument, for example: synai "fix the tests". Use "synai --help" to see available commands and flags.`,
  );
}

function startupTargetTakesPrecedenceOverMigrationNotice(
  target: TuiStartupTarget | undefined,
): boolean {
  return target === "config" || target === "history";
}

export async function runCli(): Promise<void> {
  installStreamErrorGuards();
  autoUpdateOnStartup();

  const cliArgs = process.argv.slice(2);
  const isFullTTY =
    process.stdin.isTTY === true && process.stdout.isTTY === true;
  const configDir = resolveConfigDirArg(cliArgs) || join(homedir(), ".synai");
  const { setClineDir, setHomeDir } = await import("@synai/shared/storage");
  if (configDir) {
    setClineDir(configDir);
  }
  setHomeDir(homedir());

  // Capture activation telemetry only after config/home directory selection
  // has been applied, so the telemetry singleton's persisted distinct-id
  // (and any other storage it touches) lands under the user-selected
  // `--config <dir>` rather than the default home/config location.
  captureCliExtensionActivated();

  const normalizedArgs = normalizeAutoApproveArgs(cliArgs);

  // Subcommand routing via Commander
  const ctx: {
    exitCode?: number;
    startupTarget?: TuiStartupTarget;
  } = {};
  const io = { writeln, writeErr };
  const program = createProgram();
  // Re-enable built-in help/version output for the routing program
  program.configureOutput({
    writeOut: (str: string) => process.stdout.write(str),
    writeErr: () => {},
  });
  // Default action handles non-subcommand args (e.g. prompt text)
  program.action(() => {});

  // Auth / Provider configuration subcommand:
  const authCmd = program
    .command("provider")
    .alias("auth")
    .alias("login")
    .alias("key")
    .description(
      "Configure model providers, API credentials, and default endpoints",
    )
    .argument(
      "[provider]",
      "Provider service identifier (positional shorthand for -p)",
    )
    .option("-p, --provider <id>", "Target model provider identifier")
    .option("-k, --apikey <key>", "Provider API authentication token")
    .option("-m, --modelid <id>", "Default model identifier for this provider")
    .option("-b, --baseurl <url>", "Custom base URL endpoint")
    .option(
      "--azure-api-version <version>",
      "Azure OpenAI API specification version",
    )
    .option("--config <dir>", "configuration directory")
    .option("-c, --cwd <path>", "Working directory")
    .option(
      "--data-dir <dir>",
      "Use isolated local state at <dir> instead of ~/.synai (enables sandbox mode)",
    )
    .option("-v, --verbose", "Show verbose output")
    .action(async (positionalProvider: string | undefined) => {
      const opts = authCmd.opts<{
        provider?: string;
        apikey?: string;
        modelid?: string;
        baseurl?: string;
        azureApiVersion?: string;
        config?: string;
        cwd?: string;
        dataDir?: string;
        verbose?: boolean;
      }>();
      // Honor --config inside the action as a defense-in-depth measure.
      if (opts.config?.trim()) {
        const { setClineDir } = await import("@synai/shared/storage");
        setClineDir(opts.config.trim());
      }
      // Honor --data-dir before constructing the provider settings manager
      // so writes land under the chosen data dir instead of ~/.synai.
      configureSandboxEnvironment({
        enabled: !!opts.dataDir || process.env.SYNAI_SANDBOX?.trim() === "1",
        cwd: opts.cwd ?? process.cwd(),
        explicitDir: opts.dataDir,
      });
      const { runAuthCommand } = await import("./commands/auth");
      const providerSettingsManager = await createProviderSettingsManager();
      ctx.exitCode = await runAuthCommand({
        providerSettingsManager,
        explicitProvider: opts.provider ?? positionalProvider,
        apikey: opts.apikey,
        modelid: opts.modelid,
        baseurl: opts.baseurl,
        azureApiVersion: opts.azureApiVersion,
        io,
      });
    });

  const createConfigRuntimeCommand = async () => {
    const { createConfigCommand } = await import("./commands/config");
    let configCmd: Command;
    configCmd = createConfigCommand(
      () => resolveWorkspaceRoot(program.opts().cwd ?? process.cwd()),
      () => {
        const outputMode =
          program.opts().json || configCmd.opts().json
            ? ("json" as const)
            : ("text" as const);
        setCurrentOutputMode(outputMode);
        return outputMode;
      },
      io,
      (code) => {
        ctx.exitCode = code;
      },
      () => {
        ctx.startupTarget = "config";
      },
    );
    return configCmd;
  };

  program
    .command("settings")
    .alias("config")
    .alias("prefs")
    .alias("env")
    .description(
      "Inspect and manage SynAI environment preferences and agent policies",
    )
    .option("--json", "Output as JSON")
    .option("--config <dir>", "configuration directory")
    .allowUnknownOption()
    .allowExcessArguments()
    .passThroughOptions()
    .action(async (_opts: unknown, cmd: Command) => {
      const realCmd = await createConfigRuntimeCommand();
      await realCmd.parseAsync(cmd.args, { from: "user" });
    });

  const pluginCmd = program
    .command("extensions")
    .alias("plugin")
    .alias("extension")
    .alias("ext")
    .description("Install, list, and manage modular SynAI ecosystem extensions")
    .action(() => {
      pluginCmd.help();
    });
  const pluginInstallCmd = pluginCmd
    .command("install")
    .alias("i")
    .alias("add")
    .description(
      "Install an extension package from official keyword, npm, git URL, or local directory",
    )
    .argument(
      "<source>",
      "extension package identifier, git repository, file URL, or local directory path",
    )
    .option("--npm", "Treat source as an npm package")
    .option("--git", "Treat source as a git repository")
    .option("--force", "Replace an existing install for the same source")
    .option("--json", "Output as JSON")
    .option("--cwd <path>", "Install to <path>/.synai/plugins")
    .action(async (source: string) => {
      const opts = pluginInstallCmd.opts<{
        npm?: boolean;
        git?: boolean;
        force?: boolean;
        json?: boolean;
        cwd?: string;
      }>();
      const sourceTypes = [
        opts.npm ? ("npm" as const) : undefined,
        opts.git ? ("git" as const) : undefined,
      ].filter((sourceType) => sourceType !== undefined);
      if (sourceTypes.length > 1) {
        writeErr("extensions install accepts only one source type flag");
        ctx.exitCode = 1;
        return;
      }
      const { runPluginInstallCommand } = await import("./commands/plugin");
      ctx.exitCode = await runPluginInstallCommand({
        source,
        sourceType: sourceTypes[0],
        cwd: opts.cwd,
        force: opts.force === true,
        json: opts.json === true || program.opts().json === true,
        io,
      });
    });
  const pluginUninstallCmd = pluginCmd
    .command("uninstall")
    .alias("remove")
    .alias("rm")
    .description("Remove an installed extension package by name or path")
    .argument(
      "<name>",
      "extension package name, installed slug, or plugin path",
    )
    .option("--json", "Output as JSON")
    .option(
      "--cwd <path>",
      "Search <path>/.synai/plugins before global plugins",
    )
    .action(async (name: string) => {
      const opts = pluginUninstallCmd.opts<{
        json?: boolean;
        cwd?: string;
      }>();
      const { runPluginUninstallCommand } = await import("./commands/plugin");
      ctx.exitCode = await runPluginUninstallCommand({
        name,
        cwd: opts.cwd,
        json: opts.json === true || program.opts().json === true,
        io,
      });
    });
  const skillCmd = program
    .command("actions")
    .alias("skills")
    .alias("skill")
    .alias("tools")
    .description(
      "Integrate reusable agent capabilities and specialized domain skills",
    )
    .allowUnknownOption()
    .passThroughOptions()
    .argument("[args...]", "arguments forwarded to the skills engine")
    .addHelpText(
      "after",
      "\nDelegates to the open skills registry via npx. Examples:\n" +
        "  synai actions add <owner/repo>       Import a skill capability into SynAI\n" +
        "  synai actions list                  Inspect installed skills\n" +
        "  synai actions remove <name>         Remove an installed skill\n" +
        "\nDefaults to '--agent synai'. Run 'npx skills --help' for complete reference.",
    )
    .action(async () => {
      const { runSkillCommand } = await import("./commands/skill");
      ctx.exitCode = await runSkillCommand(skillCmd.args, io);
    });

  const connectCmd = program
    .command("bridge")
    .alias("connect")
    .alias("gateway")
    .alias("link")
    .description(
      "Establish real-time communication bridges to messaging channels (Slack, Discord, Telegram)",
    )
    .argument("[channel]", "Target messaging platform to bridge SynAI to")
    .option("--stop", "Terminate active channel bridge connections")
    .option("--restart", "Restart a channel connection")
    .option("--restart-instance <id>", "Restart specific connector instance")
    .option(
      "--cleanup-instance <id>",
      "Clean up terminated connector instance, preserving autostart",
    )
    .allowUnknownOption()
    .passThroughOptions()
    .addHelpText(
      "after",
      "\nRun 'synai bridge <channel> --help' for platform-specific parameters.",
    )
    .action(async (adapter: string | undefined) => {
      const {
        formatAdapterList,
        runCleanupConnectorInstance,
        runConnectAdapter,
        runRestartConnector,
        runStopAllConnectors,
        runStopConnector,
      } = await import("./commands/connect");
      const opts = connectCmd.opts();
      const exclusiveModes = [
        opts.stop,
        opts.restart || opts.restartInstance,
        opts.cleanupInstance,
      ].filter(Boolean).length;
      if (exclusiveModes > 1) {
        io.writeErr(
          "bridge accepts only one of --stop, --restart or --cleanup-instance",
        );
        ctx.exitCode = 1;
      } else if (opts.cleanupInstance) {
        if (!adapter) {
          io.writeErr("bridge --cleanup-instance requires a channel");
          ctx.exitCode = 1;
        } else {
          ctx.exitCode = await runCleanupConnectorInstance(
            adapter,
            opts.cleanupInstance,
            io,
          );
        }
      } else if (opts.stop) {
        if (adapter) {
          ctx.exitCode = await runStopConnector(adapter, io);
        } else {
          ctx.exitCode = await runStopAllConnectors(io);
        }
      } else if (opts.restart || opts.restartInstance) {
        if (!adapter) {
          io.writeErr("bridge --restart requires a channel");
          ctx.exitCode = 1;
        } else {
          ctx.exitCode = await runRestartConnector(
            adapter,
            connectCmd.args.slice(1),
            io,
            opts.restartInstance,
          );
        }
      } else if (adapter) {
        ctx.exitCode = await runConnectAdapter(
          adapter,
          connectCmd.args.slice(1),
          io,
        );
      } else if (isFullTTY) {
        ctx.exitCode = await runConnectWizard();
      } else {
        writeln(`\nAvailable Bridges:\n${formatAdapterList()}`);
        connectCmd.help();
      }
    });

  const mcpCmd = program
    .command("servers")
    .alias("mcp")
    .alias("integrations")
    .alias("services")
    .description(
      "Configure and supervise Model Context Protocol (MCP) server integrations",
    )
    .action(async () => {
      if (isFullTTY) {
        ctx.exitCode = await runMcpWizard();
      } else {
        writeln(
          "Interactive server wizard requires a TTY. Use 'synai settings mcp' to list registered servers.",
        );
      }
    });
  const mcpInstallCmd = mcpCmd
    .command("install")
    .alias("add")
    .description(
      "Register a new MCP tool server via interactive wizard or parameters",
    )
    .argument("<name>", "MCP server identifier")
    .argument(
      "[targetArgs...]",
      "Endpoint URL for remote servers, or executable command and arguments after -- for stdio",
    )
    .option(
      "--transport <transport>",
      "stdio, sse, http, streamable-http, or streamableHttp (default: stdio)",
    )
    .option(
      "--header <header>",
      "Custom HTTP header for remote servers",
      collectOption,
      [],
    )
    .option(
      "--yes",
      "Install noninteractively without opening the setup wizard",
    )
    .option("--json", "Output as JSON")
    .action(async (name: string, targetArgs: string[]) => {
      const opts = mcpInstallCmd.opts<{
        header?: string[];
        json?: boolean;
        transport?: string;
        yes?: boolean;
      }>();
      const { runMcpInstallCommand } = await import("./commands/mcp");
      ctx.exitCode = await runMcpInstallCommand({
        name,
        headers: opts.header,
        targetArgs,
        transport: opts.transport,
        json: opts.json === true || program.opts().json === true,
        yes: opts.yes === true,
        io,
      });
    });
  const mcpUninstallCmd = mcpCmd
    .command("uninstall")
    .alias("remove")
    .alias("rm")
    .description("Deregister and remove a configured MCP tool server")
    .argument("<name>", "MCP server identifier")
    .option("--json", "Output as JSON")
    .action(async (name: string) => {
      const opts = mcpUninstallCmd.opts<{
        json?: boolean;
      }>();
      const { runMcpUninstallCommand } = await import("./commands/mcp");
      ctx.exitCode = await runMcpUninstallCommand({
        name,
        json: opts.json === true || program.opts().json === true,
        io,
      });
    });

  const createDoctorRuntimeCommand = async () => {
    const { createDoctorCommand } = await import("./commands/doctor");
    return createDoctorCommand(io, (code) => {
      ctx.exitCode = code;
    });
  };

  program
    .command("diagnose")
    .alias("doctor")
    .alias("health")
    .alias("check")
    .description(
      "Run health checks, inspect system logs, and clean up orphaned background processes",
    )
    .allowUnknownOption()
    .allowExcessArguments()
    .passThroughOptions()
    .addHelpText(
      "after",
      "\nSubcommands:\n  fix  Terminate orphaned background processes\n  log  Open the primary SynAI operational log file\n",
    )
    .action(async (_opts: unknown, cmd: Command) => {
      const doctorCmd = await createDoctorRuntimeCommand();
      await doctorCmd.parseAsync(cmd.args, { from: "user" });
    });

  registerHistoryCommand({
    program,
    io,
    setExitCode: (code) => {
      ctx.exitCode = code;
    },
    setStartupTarget: (target) => {
      ctx.startupTarget = target;
    },
    isInteractiveTTY: () => isFullTTY,
  });

  program
    .command("trigger")
    .alias("hook")
    .alias("event")
    .description(
      "Execute automated workflow actions from external lifecycle hook events",
    )
    .allowUnknownOption()
    .allowExcessArguments()
    .action(async () => {
      const { runHookCommand } = await import("./commands/hook");
      ctx.exitCode = await runHookCommand(io);
    });

  const createScheduleRuntimeCommand = async () => {
    const { createScheduleCommand } = await import("./commands/schedule");
    return createScheduleCommand(io, (code) => {
      ctx.exitCode = code;
    });
  };
  const createHubRuntimeCommand = async () => {
    const { createHubCommand } = await import("./commands/hub");
    return createHubCommand(io, (code) => {
      ctx.exitCode = code;
    });
  };

  program
    .command("jobs")
    .alias("schedule")
    .alias("cron")
    .alias("tasks")
    .description(
      "Automate recurring engineering workflows and manage scheduled background jobs",
    )
    .allowUnknownOption()
    .allowExcessArguments()
    .passThroughOptions()
    .action(async (_opts: unknown, cmd: Command) => {
      if (cmd.args.length === 0 && isFullTTY) {
        ctx.exitCode = await runScheduleWizard();
        return;
      }
      const scheduleCmd = await createScheduleRuntimeCommand();
      await scheduleCmd.parseAsync(cmd.args, { from: "user" });
    });
  program
    .command("daemon")
    .alias("hub")
    .alias("engine")
    .alias("service")
    .description(
      "Control the SynAI background supervision engine and worker daemon",
    )
    .allowUnknownOption()
    .allowExcessArguments()
    .passThroughOptions()
    .action(async (_opts: unknown, cmd: Command) => {
      const hubCmd = await createHubRuntimeCommand();
      await hubCmd.parseAsync(cmd.args, { from: "user" });
    });

  const dashboardCmd = program
    .command("studio")
    .alias("dashboard")
    .alias("portal")
    .alias("web")
    .description(
      "Launch the interactive SynAI web studio workspace in your browser",
    )
    .option("--config <dir>", "configuration directory")
    .option("-c, --cwd <path>", "Workspace root", process.cwd())
    .option(
      "--data-dir <dir>",
      "Use isolated local state at <dir> instead of ~/.synai (enables sandbox mode)",
    )
    .option("--host <host>", "Dashboard bind host")
    .option("--port <port>", "Dashboard HTTP/WebSocket port")
    .option("--public-url <url>", "Public dashboard URL")
    .option("--room-secret <secret>", "Invite secret for browser access")
    .option("--no-open", "Start the dashboard without opening a browser")
    .action(async () => {
      const opts = dashboardCmd.opts<{
        config?: string;
        cwd?: string;
        dataDir?: string;
        host?: string;
        port?: string;
        publicUrl?: string;
        roomSecret?: string;
        open?: boolean;
      }>();
      const { runDashboardCommand } = await import("./commands/dashboard");
      ctx.exitCode = await runDashboardCommand({
        configDir: opts.config,
        cwd: opts.cwd,
        dataDir: opts.dataDir,
        host: opts.host,
        port: opts.port,
        publicUrl: opts.publicUrl,
        roomSecret: opts.roomSecret,
        openBrowser: opts.open !== false,
        io,
      });
    });

  const updateCmd = program
    .command("upgrade")
    .alias("update")
    .description("Check for new SynAI releases and update the CLI package")
    .allowUnknownOption()
    .allowExcessArguments()
    .option("-v, --verbose", "Show verbose output")
    .option("--config <dir>", "configuration directory")
    .action(async () => {
      const { checkForUpdates } = await import("./commands/update");
      ctx.exitCode = await checkForUpdates({
        verbose: updateCmd.opts().verbose === true,
      });
    });

  program
    .command("info")
    .alias("version")
    .description(
      "Display SynAI version, system information, and runtime status",
    )
    .action(async () => {
      const { showVersion } = await import("./commands/help");
      showVersion();
      ctx.exitCode = 0;
    });

  // Multi-agent collaboration command
  const collabCmd = program
    .command("collab")
    .alias("collaborate")
    .alias("multi")
    .description(
      "🤝 Multi-agent collaboration - AI agents discuss and solve problems together",
    )
    .argument("<topic>", "Problem or task for agents to discuss")
    .option(
      "-a, --agents <names>",
      "Comma-separated agent IDs (default: architect,developer,reviewer)",
    )
    .option(
      "-r, --rounds <number>",
      "Maximum discussion rounds (default: 5)",
      "5",
    )
    .option("-m, --model <model-id>", "Model to use for agents")
    .option("-P, --provider <id>", "Provider service (default: openrouter)")
    .option("-k, --key <api-key>", "API key override")
    .option("-v, --verbose", "Show detailed agent reasoning")
    .action(async (topic: string) => {
      const { default: createCollabCommand } =
        await import("./commands/collab");
      const cmd = createCollabCommand();
      await cmd.parseAsync([topic, ...collabCmd.args.slice(1)], {
        from: "user",
      });
    });

  try {
    await program.parseAsync(normalizedArgs, { from: "user" });
  } catch (err: unknown) {
    if (err instanceof CommanderError) {
      if (err.exitCode !== 0) {
        writeErr(err.message);
        process.exitCode = err.exitCode;
        return;
      }
      return;
    }
    throw err;
  }

  if (ctx.exitCode !== undefined) {
    process.exitCode = ctx.exitCode;
    return;
  }

  const rootOpts = program.opts<{
    tui?: boolean;
    update?: boolean;
    verbose?: boolean;
  }>();
  if (rootOpts.update) {
    if (rootOpts.tui || program.args.length > 0) {
      writeErr("Use --update without a prompt or task flags.");
      process.exitCode = 1;
      return;
    }
    const { checkForUpdates } = await import("./commands/update");
    process.exitCode = await checkForUpdates({
      verbose: rootOpts.verbose === true,
    });
    return;
  }

  // Default flow: no subcommand matched, or fall-through from config/history.
  let args = commanderToParsedArgs(program);

  let startupTarget = ctx.startupTarget;
  let resumeSessionId: string | undefined;
  if (args.id !== undefined) {
    const sessionId = args.id.trim();
    if (!sessionId) {
      writeErr("--id requires <session-id>");
      process.exitCode = 1;
      return;
    }
    resumeSessionId = sessionId;
    startupTarget = "chat";
    process.env.SYNAI_HOOK_AGENT_RESUME = "1";
  } else {
    delete process.env.SYNAI_HOOK_AGENT_RESUME;
  }
  if (startupTarget) {
    args = {
      ...args,
      interactive: true,
      prompt: undefined,
    };
  }

  if (args.invalidThinkingLevel) {
    writeErr(
      `invalid thinking level "${args.invalidThinkingLevel}" (expected "none", "low", "medium", "high", or "xhigh")`,
    );
    process.exitCode = 1;
    return;
  }
  if (args.invalidCompactionMode) {
    writeErr(
      `invalid compaction mode "${args.invalidCompactionMode}" (expected ${CLI_COMPACTION_MODE_EXPECTED_TEXT})`,
    );
    process.exitCode = 1;
    return;
  }
  if (args.invalidAutoApprove) {
    writeErr(
      `invalid auto-approve value "${args.invalidAutoApprove}" (expected "true" or "false")`,
    );
    process.exitCode = 1;
    return;
  }
  if (args.invalidTimeoutSeconds) {
    writeErr(
      `invalid timeout "${args.invalidTimeoutSeconds}" (expected integer >= 1)`,
    );
    process.exitCode = 1;
    return;
  }
  if (args.invalidRetries) {
    writeln(
      `${c.dim}[warn] ignoring invalid --retries value "${args.invalidRetries}" (expected integer >= 1)${c.reset}`,
    );
  }
  if (args.hooksDir?.trim()) {
    process.env.SYNAI_HOOKS_DIR = args.hooksDir.trim();
  }
  if (args.prompt && !args.interactive) {
    if (program.args.length > 1 || !promptArgLooksQuoted(program.args[0])) {
      writePromptArgError(program.args);
      process.exitCode = 1;
      return;
    }
  }
  setCurrentOutputMode(args.outputMode);

  if (args.outputMode === "json" && (args.interactive || !args.prompt)) {
    writeErr(
      "JSON output mode requires a prompt argument or piped stdin (interactive mode is unsupported)",
    );
    process.exitCode = 1;
    return;
  }

  // ACP mode: mutually exclusive with interactive/piped modes.
  // Enters the Agent Client Protocol stdio transport and never falls through.
  if (args.acpMode) {
    const { runAcpMode } = await import("./acp/index");
    // Only an explicit `--auto-approve true` (or `--yolo`) enables
    // auto-approval in ACP mode; We do not respect the default to
    // avoid accidental auto-approval in ACP mode.
    await runAcpMode({ autoApproveTools: args.autoApproveOverride === true });
    return;
  }

  if (args.worktree) {
    if (
      !args.prompt &&
      !resumeSessionId &&
      !stdinHasPipedInput() &&
      !isFullTTY
    ) {
      writeErr("--worktree without a prompt requires an interactive terminal.");
      process.exitCode = 1;
      return;
    }
    if (resumeSessionId) {
      const { getSessionRow } = await import("./session/session");
      const session = await getSessionRow(resumeSessionId);
      if (!session) {
        writeErr(`Session not found: ${resumeSessionId}`);
        process.exitCode = 1;
        return;
      }
    }
    const { createTaskWorktree } = await import("./utils/worktree");
    const sourceCwd = args.cwd ?? process.cwd();
    const result = await createTaskWorktree({ cwd: sourceCwd });
    if (!result.success || !result.path) {
      writeErr(`--worktree failed: ${result.message}`);
      process.exitCode = 1;
      return;
    }
    writeln(`Created worktree at ${result.path}`);
    args = {
      ...args,
      cwd: result.path,
    };
  }

  const cwd = args.cwd ?? process.cwd();
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  // Sandbox mode is enabled implicitly whenever --data-dir is provided, or
  // when SYNAI_SANDBOX=1 is set in the environment (in which case the data
  // dir falls back to $SYNAI_SANDBOX_DATA_DIR or /tmp/cline-sandbox).
  const sandboxEnabled =
    !!args.dataDir || process.env.SYNAI_SANDBOX?.trim() === "1";
  const sandboxDataDir = configureSandboxEnvironment({
    enabled: sandboxEnabled,
    cwd,
    explicitDir: args.dataDir,
  });

  // Keep command-style subcommands on a narrow path. Runtime-only imports pull
  // in provider resolution, config services, and session startup wiring that
  // should only load when the CLI is actually starting an agent session.
  const providerSettingsManager = await createProviderSettingsManager();
  const {
    coreServer,
    coreServer: { createUserInstructionConfigService },
    resolveSystemPrompt,
    runAgent,
  } = await loadCliRuntimeModules();

  // General settings toggled in the TUI /settings panel persist to the
  // global settings file; explicit CLI flags take precedence over the
  // persisted values, which in turn override the built-in defaults.
  const persistedGlobalSettings = coreServer.readGlobalSettings();
  const defaultToolAutoApprove = true;
  const effectiveToolAutoApprove = resolveStartupToolAutoApprove(
    args,
    persistedGlobalSettings,
    defaultToolAutoApprove,
  );
  const toolPolicies: Record<string, ToolPolicy> = {
    "*": {
      autoApprove: effectiveToolAutoApprove,
    },
  };
  const effectiveMode = resolveStartupMode(args, persistedGlobalSettings);
  const effectiveCompactionMode = resolveStartupCompactionMode(
    args,
    persistedGlobalSettings,
  );

  // Register the SDK early logger as early as possible — before any
  // provider settings reads — so the full startup sequence is captured.
  // These components operate before/outside SynAICore sessions, so the
  // session-scoped logger can't reach them.
  const { createCliLoggerAdapter } = await import("./logging/adapter");
  const loggerAdapter = createCliLoggerAdapter({
    runtime: "cli",
    component: "main",
  });
  coreServer.setSdkLogger(loggerAdapter.core);

  const userInstructionService = createUserInstructionConfigService({
    skills: {
      workspacePath: workspaceRoot,
      includePluginSkills: true,
      cwd,
    },
    rules: { workspacePath: workspaceRoot },
    workflows: { workspacePath: workspaceRoot },
  });
  await userInstructionService.start().catch(() => {});
  let userInstructionServiceDisposed = false;
  const stopUserInstructionService = () => {
    if (userInstructionServiceDisposed) {
      return;
    }
    userInstructionServiceDisposed = true;
    userInstructionService.stop();
  };
  registerDisposable(stopUserInstructionService);
  try {
    const persistedClineAccountId = providerSettingsManager
      .getProviderSettings("cline")
      ?.auth?.accountId?.trim();
    if (persistedClineAccountId) {
      setCliFeatureFlagsAccountContext({ id: persistedClineAccountId });
    }
    refreshCliFeatureFlagsInBackground();
    const lastUsedProviderSettings =
      providerSettingsManager.getLastUsedProviderSettings({
        isClinePassEnabled: false,
      });
    const provider = normalizeProviderId(
      args.provider?.trim() ||
        lastUsedProviderSettings?.provider ||
        "openrouter",
    );
    let selectedProviderSettings =
      providerSettingsManager.getProviderSettings(provider);

    // Apply locally persisted synai account identity so subsequent events
    // (task.*, workspace.initialized) carry user_id when available.
    // Note: user.extension_activated fires anonymously earlier in startup
    // and cannot be retroactively updated; this is by design for
    // lightweight subcommand and pre-auth CLI flows. See CLINE-2406.
    if (provider === "cline") {
      const savedAuth = selectedProviderSettings?.auth;
      if (savedAuth?.accountId) {
        identifyTelemetryAccount({
          id: savedAuth.accountId,
          provider: "cline",
          organizationId: savedAuth.organizationId,
          organizationName: savedAuth.organizationName,
          memberId: savedAuth.memberId,
        });
      }
    }

    const persistedApiKey = getPersistedProviderApiKey(
      provider,
      selectedProviderSettings,
    );
    const providedApiKey = args.key?.trim() || undefined;
    let apiKey = providedApiKey || persistedApiKey || undefined;

    const isYoloMode = args.mode === "yolo";
    const isZenMode = args.mode === "zen";

    // In headless mode (yolo / json / piped stdin without --tui),
    // don't attempt browser-based OAuth. Authentication may still resolve at
    // runtime from environment-based provider auth or persisted OAuth tokens.
    const isHeadless =
      isYoloMode ||
      isZenMode ||
      args.outputMode === "json" ||
      (!process.stdin.isTTY && !args.interactive);
    const isInteractive = (args.interactive || !args.prompt) && !isHeadless;

    if (!apiKey && isOAuthProvider(provider) && !isHeadless && !isInteractive) {
      const oauthResult = await ensureOAuthProviderApiKey({
        providerId: provider,
        currentApiKey: apiKey,
        existingSettings: selectedProviderSettings,
        providerSettingsManager,
        io: { writeln, writeErr },
      });
      selectedProviderSettings =
        oauthResult?.selectedProviderSettings ?? selectedProviderSettings;
      apiKey = oauthResult?.apiKey ?? apiKey;
    }

    let knownModels: Config["knownModels"];
    try {
      const persistedProviderConfig = providerSettingsManager.getProviderConfig(
        provider,
        {
          includeKnownModels: false,
        },
      );
      const catalogOptions = isInteractive
        ? {
            loadLatestOnInit: true,
            loadPrivateOnAuth: true,
            failOnError: false,
          }
        : undefined;
      const resolvedProviderConfig = await coreServer.resolveProviderConfig(
        provider,
        catalogOptions,
        persistedProviderConfig,
      );
      knownModels = resolvedProviderConfig?.knownModels;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeln(
        `${c.dim}[model-catalog] catalog resolution failed (${message})${c.reset}`,
      );
    }
    const knownModelIds = knownModels
      ? Object.keys(filterChatModels(knownModels))
      : [];
    const resolvedReasoning = resolveCliReasoning({
      thinking: args.thinking,
      thinkingExplicitlySet: args.thinkingExplicitlySet,
      reasoningEffort: args.reasoningEffort,
      persistedReasoning: selectedProviderSettings?.reasoning,
    });
    const cliBuildInfo = getCliBuildInfo();
    const { createCliLoggerAdapter } = await import("./logging/adapter");
    const loggerAdapter = createCliLoggerAdapter({
      runtime: "cli",
      component: "main",
    });
    loggerAdapter.core.log("CLI run started", {
      interactive: args.interactive === true,
      hasPrompt: !!args.prompt?.trim(),
      cwd,
    });

    const config: Config = {
      providerId: provider,
      modelId:
        args.model ??
        selectedProviderSettings?.model ??
        knownModelIds[0] ??
        "anthropic/claude-sonnet-4.6",
      apiKey: apiKey ?? "",
      knownModels,
      systemPrompt: await resolveSystemPrompt({
        cwd,
        explicitSystemPrompt: args.systemPrompt,
        providerId: provider,
        mode: effectiveMode,
      }),
      execution: {
        maxConsecutiveMistakes: args.retries ?? 3,
      },
      checkpoint: CLI_DEFAULT_CHECKPOINT_CONFIG,
      compaction: buildCliCompactionConfig(effectiveCompactionMode),
      timeoutSeconds: args.timeoutSeconds,
      sandbox: sandboxEnabled,
      sandboxDataDir,
      verbose: args.verbose,
      thinking: resolvedReasoning.thinking,
      reasoningEffort: resolvedReasoning.reasoningEffort,
      outputMode: args.outputMode,
      mode: effectiveMode,
      logger: loggerAdapter.core,
      loggerConfig: loggerAdapter.runtimeConfig,
      telemetry: getCliTelemetryService(loggerAdapter.core),
      defaultToolAutoApprove,
      toolPolicies,
      enableSpawnAgent: !isYoloMode,
      enableAgentTeams: !isYoloMode,
      enableTools: true,
      cwd,
      workspaceRoot,
      extensionContext: {
        client: {
          name: "synai-cli",
          version: cliBuildInfo.version,
          platform: "cli",
          platformVersion: cliBuildInfo.version,
          isMultiRoot: false,
        },
        workspace: {
          rootPath: workspaceRoot,
          cwd,
          workspaceName: basename(cwd),
          ide: "Terminal Shell",
          platform: process.platform,
        },
        logger: loggerAdapter.core,
      },
      teamName: !isYoloMode ? args.teamName?.trim() || undefined : undefined,
    };
    try {
      // For OAuth providers, don't write the resolved key into apiKey;
      // the token lives in auth.accessToken and apiKey is reserved for
      // migrated/manual keys.
      const persistApiKey =
        // Persist explicit `-k/--key` even for OAuth-capable providers.
        providedApiKey
          ? { apiKey: providedApiKey }
          : apiKey && !isOAuthProvider(provider)
            ? { apiKey }
            : {};
      providerSettingsManager.saveProviderSettings({
        ...(selectedProviderSettings ?? {}),
        provider,
        model: config.modelId,
        ...persistApiKey,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeln(
        `${c.dim}[provider-settings] failed to persist selection (${message})${c.reset}`,
      );
    }
    // Check for piped input (skip when stdin is not a real pipe/file, e.g. headless CI).
    // Guard `isTTY` first so we never block on fd 0 when stdin is a terminal (and avoid
    // redundant fstat work). `stdinHasPipedInput` also checks `isTTY`, but callers may hit
    // inconsistent state in tests or embedded hosts.
    if (!process.stdin.isTTY && stdinHasPipedInput() && !args.interactive) {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer);
      }
      const pipedInput = Buffer.concat(chunks).toString("utf-8").trim();

      if (pipedInput) {
        const prompt = args.prompt
          ? `${args.prompt}\n\n${pipedInput}`
          : pipedInput;
        const rewrittenTeamPrompt = rewriteTeamPrompt(prompt);
        if (rewrittenTeamPrompt.kind === "usage") {
          writeln(TEAM_COMMAND_USAGE);
          return;
        }
        const pipedEffectivePrompt =
          rewrittenTeamPrompt.kind === "rewritten"
            ? rewrittenTeamPrompt.prompt
            : prompt;
        if (isZenMode) {
          const { runZen } = await import("./runtime/run-zen");
          await runZen(pipedEffectivePrompt, config, userInstructionService);
          return;
        }
        await runAgent(pipedEffectivePrompt, config, userInstructionService);
        return;
      }
    }

    // Interactive mode: zen is incompatible because there is no terminal UI
    // to surface results and nothing waits for the background task.
    if (args.interactive || !args.prompt) {
      if (isZenMode) {
        writeErr(
          args.interactive
            ? "--zen is not compatible with interactive mode."
            : "--zen requires a prompt.",
        );
        process.exitCode = 1;
        return;
      }
      const runInteractive = await loadInteractiveRuntimeModule();
      const initialSynaiProviderSettings =
        provider === "synai" ? selectedProviderSettings : undefined;

      await runInteractive(config, userInstructionService, resumeSessionId, {
        initialPrompt: args.prompt,
        synaiApiBaseUrl: initialSynaiProviderSettings?.baseUrl,
        synaiProviderSettings: initialSynaiProviderSettings,
        startupTarget,
      });
      return;
    }

    // Single prompt mode
    const rewrittenTeamPrompt = rewriteTeamPrompt(args.prompt);
    if (rewrittenTeamPrompt.kind === "usage") {
      writeln(TEAM_COMMAND_USAGE);
      return;
    }
    const effectivePrompt =
      rewrittenTeamPrompt.kind === "rewritten"
        ? rewrittenTeamPrompt.prompt
        : args.prompt;

    // Zen mode: dispatch the task to the background hub and exit. The CLI
    // does not stay connected to stream output; completion is delivered via
    // the hub's existing ui.notify broadcast (picked up by the menubar app
    // when installed).
    if (isZenMode) {
      const { runZen } = await import("./runtime/run-zen");
      await runZen(effectivePrompt, config, userInstructionService);
      return;
    }

    await runAgent(effectivePrompt, config, userInstructionService);
    // Exit once agent is done in non-interactive mode
    return;
  } finally {
    stopUserInstructionService();
  }
}
