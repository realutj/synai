import {
	getCurrentContextSize,
	type ProviderSettings,
	ProviderSettingsManager,
	setCompactionModeGlobally,
	setPlanActModeGlobally,
	setToolAutoApproveGlobally,
	type UserInstructionConfigService,
} from "@synai/core";
import { formatModeSwitchNotice } from "@synai/shared";
import { logCliError } from "../logging/errors";
import { exportHistorySession } from "../session/history-export";
import { deleteSession } from "../session/session";
import {
	loadSynaiAccountSnapshot,
	loadIndividualSubscriptionPlans,
	onProviderChange,
	switchSynaiAccount,
} from "../tui/synai-account";
import type {
	InteractiveConfigItem,
	LoadInteractiveConfigDataOptions,
} from "../tui/interactive-config";
import {
	type InteractiveSlashCommand,
	listInteractiveSlashCommands,
	resolveSynaiWelcomeLine,
} from "../tui/interactive-welcome";
import { disableOpenTuiGraphicsProbe } from "../tui/opentui-env";
import type { QueuedPromptItem, TuiStartupTarget } from "../tui/types";
import { type ChatCommandState, chatCommandHost } from "../utils/chat-commands";
import { applyCliCompactionMode } from "../utils/compaction-mode";
import {
	shouldZeroSynaiFreeModelCost,
	zeroCliAgentEventCost,
	zeroCliUsageCost,
} from "../utils/free-model-cost";
import {
	prepareTerminalForPostTuiOutput,
	writeErr,
	writeln,
} from "../utils/output";
import { createWorkspaceChatCommandHost } from "../utils/plugin-chat-commands";
import { readRepoStatus } from "../utils/repo-status";
import type { Config } from "../utils/types";
import {
	clearAbortInProgress,
	isAbortInProgress,
	setActiveRuntimeAbort,
	setActiveRuntimeCleanup,
} from "./active-runtime";
import { createInteractiveApprovalController } from "./interactive/approvals";
import { runInteractiveChatCommand } from "./interactive/chat-command-runner";
import { createInteractiveConfigDataLoader } from "./interactive/config-data";
import {
	formatInteractiveExitSummary,
	type InteractiveExitSummary,
} from "./interactive/exit-summary";
import { createMistakeLimitDecisionResolver } from "./interactive/mistakes";
import {
	type AppliedModeChange,
	createInteractiveModeSwitchTool,
	createModeSwitchNoticeTracker,
	type PendingModeChange,
	sendTurnWithActModeContinuation,
} from "./interactive/mode";
import { assertInteractivePreflight } from "./interactive/preflight";
import { createInteractiveSessionRuntime } from "./interactive/session-runtime";
import { buildUserInputMessage } from "./prompt";
import { getUIEventEmitter } from "./session-events";

type ModelChangeReasoningConfig = {
	thinking?: boolean;
	reasoningEffort?: Config["reasoningEffort"];
};

export function assertHistorySessionIsDeletable(
	sessionId: string,
	activeSessionId: string,
): void {
	if (activeSessionId && sessionId === activeSessionId) {
		throw new Error(
			"Cannot delete the active session. Start or resume another session first.",
		);
	}
}

export function resolveReasoningForModelChange(
	config: ModelChangeReasoningConfig,
	existing: Pick<ProviderSettings, "reasoning">,
): ProviderSettings["reasoning"] {
	if (config.thinking === false) return { enabled: false };
	if (config.reasoningEffort) {
		return { enabled: true, effort: config.reasoningEffort as any };
	}
	if (config.thinking === true) return { enabled: true };
	return existing.reasoning;
}

export async function applyInteractiveModelChange(input: {
	config: Config;
	providerSettingsManager: Pick<
		ProviderSettingsManager,
		"getProviderSettings" | "saveProviderSettings"
	>;
	sessionRuntime: Pick<
		ReturnType<typeof createInteractiveSessionRuntime>,
		| "ensureReady"
		| "restartWithCurrentMessages"
		| "updateCurrentSessionConnection"
	>;
}): Promise<void> {
	const { config, providerSettingsManager, sessionRuntime } = input;
	await sessionRuntime.ensureReady();
	await onProviderChange({
		config,
		providerId: config.providerId || "openrouter",
	});
	const existing = providerSettingsManager.getProviderSettings(
		config.providerId || "openrouter",
	) ?? {
		provider: config.providerId || "openrouter",
	};
	const reasoning = resolveReasoningForModelChange(config, existing);
	providerSettingsManager.saveProviderSettings({
		...existing,
		model: config.modelId,
		...(reasoning === undefined ? {} : { reasoning }),
	});

	// Provider changes affect more than the model connection: startup resolves
	// the endpoint, headers, provider-specific options, tools, and plugins. Rebuild
	// the runtime with the existing transcript so all of that state changes
	// together. restartWithCurrentMessages preserves the session ID.
	await sessionRuntime.restartWithCurrentMessages();
	// A same-ID restart reuses the existing manifest. Sync its connection label
	// after the fully configured runtime is live so session history reflects the
	// provider/model that will handle subsequent turns.
	await sessionRuntime.updateCurrentSessionConnection({
		providerId: config.providerId,
		modelId: config.modelId,
	});
}

export async function resumeInteractiveSession(
	sessionRuntime: Pick<
		ReturnType<typeof createInteractiveSessionRuntime>,
		"resumeSession" | "getAccumulatedUsage"
	>,
	sessionId: string,
) {
	const previousAgentResume = process.env.SYNAI_HOOK_AGENT_RESUME;
	process.env.SYNAI_HOOK_AGENT_RESUME = "1";
	let messages: Awaited<ReturnType<typeof sessionRuntime.resumeSession>>;
	try {
		messages = await sessionRuntime.resumeSession(sessionId);
	} catch (error) {
		if (previousAgentResume === undefined) {
			delete process.env.SYNAI_HOOK_AGENT_RESUME;
		} else {
			process.env.SYNAI_HOOK_AGENT_RESUME = previousAgentResume;
		}
		throw error;
	}
	const usage = await sessionRuntime.getAccumulatedUsage({
		inputTokens: 0,
		outputTokens: 0,
	});
	return {
		messages,
		totalCost: usage.totalCost,
		currentContextSize: getCurrentContextSize(messages),
	};
}

export async function runInteractive(
	config: Config,
	userInstructionService?: UserInstructionConfigService,
	resumeSessionId?: string,
	options?: {
		synaiApiBaseUrl?: string;
		synaiProviderSettings?: ProviderSettings;
		startupTarget?: TuiStartupTarget;
		initialPrompt?: string;
		initialNotice?: string;
		onInitialNoticeShown?: () => void;
	},
): Promise<void> {
	assertInteractivePreflight(config);

	const initialRepoStatus = await readRepoStatus(config.cwd);
	const workflowSlashCommands = listInteractiveSlashCommands(
		userInstructionService,
	);
	let interactiveChatCommandHost = chatCommandHost;
	let pluginChatCommandHostLoaded = false;
	let pluginChatSlashCommands: InteractiveSlashCommand[] = [];
	let pluginChatCommandHostShutdown: (() => Promise<void>) | undefined;
	let pluginChatCommandHostPromise:
		| Promise<InteractiveSlashCommand[]>
		| undefined;
	const ensurePluginChatCommandHost = async (): Promise<
		InteractiveSlashCommand[]
	> => {
		if (pluginChatCommandHostLoaded) {
			return pluginChatSlashCommands;
		}
		pluginChatCommandHostPromise ??= createWorkspaceChatCommandHost({
			cwd: config.cwd,
			workspaceRoot: config.workspaceRoot,
			logger: config.logger,
		})
			.then(({ host, pluginSlashCommands, shutdown }) => {
				interactiveChatCommandHost = host;
				pluginChatCommandHostShutdown = shutdown;
				pluginChatSlashCommands = pluginSlashCommands.map((cmd) => ({
					name: cmd.name,
					instructions: "",
					description: cmd.description ?? "Plugin command",
				}));
				return pluginChatSlashCommands;
			})
			.finally(() => {
				pluginChatCommandHostLoaded = true;
				pluginChatCommandHostPromise = undefined;
			});
		return await pluginChatCommandHostPromise;
	};
	const loadAdditionalSlashCommands = async (): Promise<
		InteractiveSlashCommand[]
	> => await ensurePluginChatCommandHost();
	const shouldTryPluginChatCommands = (prompt: string): boolean => {
		return prompt.trimStart().startsWith("/");
	};

	const enableChatCommands = true;
	const {
		autoApproveAllRef,
		setInteractiveAutoApprove,
		requestToolApproval,
		resolveToolPolicy,
		tuiToolApprover,
		tuiAskQuestion,
	} = createInteractiveApprovalController(config);

	const pendingModeChange: PendingModeChange = {
		current: null,
		source: null,
	};
	const tuiModeChanged: {
		current: ((mode: "plan" | "act") => void) | null;
	} = { current: null };

	const switchToActModeTool = createInteractiveModeSwitchTool({
		config,
		pendingModeChange,
		tuiModeChanged,
	});

	config.extraTools = config.mode === "plan" ? [switchToActModeTool] : [];

	const uiEvents = getUIEventEmitter();
	const chatCommandState: ChatCommandState = {
		enableTools: config.enableTools,
		autoApproveTools: autoApproveAllRef.current,
		cwd: config.cwd,
		workspaceRoot: config.workspaceRoot?.trim() || config.cwd,
	};
	const resolveMistakeLimitDecision = createMistakeLimitDecisionResolver({
		autoApproveAllRef,
		askQuestionRef: tuiAskQuestion,
	});
	const providerSettingsManager = new ProviderSettingsManager();
	let zeroCurrentTurnCost = false;

	const sessionRuntime = createInteractiveSessionRuntime({
		config,
		providerSettingsManager,
		userInstructionService,
		resumeSessionId,
		chatCommandState,
		requestToolApproval,
		resolveToolPolicy,
		askQuestionRef: tuiAskQuestion,
		resolveMistakeLimitDecision,
		switchToActModeTool,
		onAgentEvent: (event) => {
			uiEvents.emit("agent", zeroCliAgentEventCost(event, zeroCurrentTurnCost));
		},
		onTeamEvent: (event) => {
			uiEvents.emit("team", event);
		},
		onPendingPrompts: (event) => {
			uiEvents.emit("pending-prompts", event);
		},
		onPendingPromptSubmitted: (event) => {
			uiEvents.emit("pending-prompt-submitted", event);
		},
	});
	const configDataLoader = createInteractiveConfigDataLoader({
		config,
		userInstructionService,
		loadCoreSettings: sessionRuntime.listCoreSettings,
		toggleCoreSettings: sessionRuntime.toggleCoreSettings,
	});
	let modeChangePromise: Promise<void> | undefined;
	let modeChangeTarget: "plan" | "act" | undefined;
	const modeSwitchNotice = createModeSwitchNoticeTracker();

	const isInteractiveMode = (mode: unknown): mode is "plan" | "act" =>
		mode === "plan" || mode === "act";

	const applyModeChange = (mode: "plan" | "act"): Promise<void> => {
		if (modeChangePromise && modeChangeTarget === mode) {
			return modeChangePromise;
		}
		let next: Promise<void>;
		next = (async () => {
			if (modeChangePromise) {
				await modeChangePromise;
			}
			await sessionRuntime.ensureReady();
			const from = config.mode;
			await sessionRuntime.applyMode(mode);
			if (isInteractiveMode(from)) {
				modeSwitchNotice?.record?.(from, mode);
			}
		})().finally(() => {
			if (modeChangePromise === next) {
				modeChangePromise = undefined;
				modeChangeTarget = undefined;
			}
		});
		modeChangePromise = next;
		modeChangeTarget = mode;
		return next;
	};

	const waitForSubmittedMode = async (mode: unknown): Promise<void> => {
		if (!isInteractiveMode(mode)) return;
		if (modeChangePromise) {
			await modeChangePromise;
		}
		if (config.mode !== mode) {
			await applyModeChange(mode);
		}
	};

	let isRunning = false;
	setActiveRuntimeAbort(sessionRuntime.abortAll);

	let cleanupPromise: Promise<InteractiveExitSummary | undefined> | undefined;

	const handleSigint = () => {
		if (isRunning) {
			if (sessionRuntime.abortAll()) {
				return;
			}
			void cleanupRuntime().finally(() => {
				process.exitCode = 0;
				tuiApp?.destroy();
			});
			return;
		}
		tuiApp?.destroy();
	};
	const handleSigterm = () => {
		if (isRunning) {
			sessionRuntime.abortAll();
			return;
		}
		tuiApp?.destroy();
	};
	const cleanupRuntime = async (): Promise<
		InteractiveExitSummary | undefined
	> => {
		if (cleanupPromise) {
			return await cleanupPromise;
		}
		cleanupPromise = (async () => {
			process.off("SIGINT", handleSigint);
			process.off("SIGTERM", handleSigterm);
			let exitSummary: InteractiveExitSummary | undefined;
			try {
				exitSummary = await sessionRuntime.cleanup();
			} finally {
				await pluginChatCommandHostPromise?.catch(() => []);
				await pluginChatCommandHostShutdown?.().catch(() => {
					// Best effort cleanup for plugin command discovery sandbox.
				});
				pluginChatCommandHostShutdown = undefined;
				setActiveRuntimeAbort(undefined);
				setActiveRuntimeCleanup(undefined);
			}
			return exitSummary;
		})();
		return await cleanupPromise;
	};
	let sessionPolicyRefresh: Promise<void> | undefined;
	let pendingSessionPolicyRefresh = false;
	const refreshInteractiveSessionPolicies = async (): Promise<void> => {
		if (sessionRuntime.isShutdownRequested()) {
			return;
		}
		if (isRunning) {
			pendingSessionPolicyRefresh = true;
			return;
		}
		if (sessionPolicyRefresh) {
			return await sessionPolicyRefresh;
		}
		pendingSessionPolicyRefresh = false;
		sessionPolicyRefresh = (async () => {
			await sessionRuntime.ensureReady();
			if (isRunning || sessionRuntime.isShutdownRequested()) {
				pendingSessionPolicyRefresh = isRunning;
				return;
			}
			await sessionRuntime.restartWithCurrentMessages();
		})()
			.catch((error) => {
				logCliError(config.logger, "Interactive policy refresh failed", {
					error,
				});
				writeErr(error instanceof Error ? error.message : String(error));
			})
			.finally(() => {
				sessionPolicyRefresh = undefined;
			});
		return await sessionPolicyRefresh;
	};
	const refreshInteractiveSessionPoliciesIfPending = (): void => {
		if (pendingSessionPolicyRefresh) {
			void refreshInteractiveSessionPolicies();
		}
	};

	const shouldRefreshInteractiveSessionForConfigItem = (
		item: InteractiveConfigItem,
	): boolean =>
		item.kind === "tool" ||
		item.kind === "plugin" ||
		item.kind === "skill" ||
		item.kind === "mcp";

	const onToggleConfigItem = async (
		item: InteractiveConfigItem,
		options: LoadInteractiveConfigDataOptions = {},
	): Promise<
		Awaited<ReturnType<typeof configDataLoader.onToggleConfigItem>>
	> => {
		const data = await configDataLoader.onToggleConfigItem(item, options);
		if (data && shouldRefreshInteractiveSessionForConfigItem(item)) {
			await refreshInteractiveSessionPolicies();
		}
		return data;
	};
	const onDeleteConfigItem = async (
		item: InteractiveConfigItem,
		options: LoadInteractiveConfigDataOptions = {},
	): Promise<
		Awaited<ReturnType<typeof configDataLoader.onDeleteConfigItem>>
	> => {
		const data = await configDataLoader.onDeleteConfigItem(item, options);
		if (data && shouldRefreshInteractiveSessionForConfigItem(item)) {
			await refreshInteractiveSessionPolicies();
		}
		return data;
	};
	const toQueuedPromptItem = (prompt: {
		id: string;
		prompt: string;
		delivery: "queue" | "steer";
		attachmentCount: number;
	}): QueuedPromptItem => ({
		id: prompt.id,
		prompt: prompt.prompt,
		steer: prompt.delivery === "steer",
		attachmentCount: prompt.attachmentCount,
	});

	process.on("SIGINT", handleSigint);
	process.on("SIGTERM", handleSigterm);

	disableOpenTuiGraphicsProbe();
	let renderOpenTui: (props: any) => Promise<{ destroy: () => void; waitUntilExit: () => Promise<void> }>;
	const hasBunRuntime = typeof (globalThis as Record<string, unknown>).Bun !== "undefined";
	if (hasBunRuntime) {
		try {
			const tuiUrl = new URL("./tui.js", import.meta.url).href;
			const tuiMod = await import(tuiUrl);
			renderOpenTui = tuiMod.renderOpenTui;
		} catch {
			renderOpenTui = renderNodeReadlineFallback;
		}
	} else {
		renderOpenTui = renderNodeReadlineFallback;
	}

	async function renderNodeReadlineFallback(
		props: any,
	): Promise<{ destroy: () => void; waitUntilExit: () => Promise<void> }> {
		const { createInterface } = await import("node:readline/promises");
		const { handleEvent } = await import("../utils/events");
		const { c } = await import("../utils/output");

		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: true,
		});

		const unsubscribeEvents = props.subscribeToEvents({
			onAgentEvent: (ev: any) => handleEvent(ev, props.config),
			onTeamEvent: () => {},
			onPendingPrompts: () => {},
			onPendingPromptSubmitted: () => {},
		});

		writeln(
			`\n${c.bold}${c.cyan}SynAI Interactive CLI${c.reset} ${c.dim}[provider=${props.config.providerId} | model=${props.config.modelId} | mode=${props.config.mode}]${c.reset}`,
		);
		writeln(
			`${c.dim}Commands: /help, /clear, /think <low|medium|high|max>, /exit (or Ctrl+C)${c.reset}\n`,
		);

		let closed = false;
		let resolveExit: (() => void) | undefined;
		const exitPromise = new Promise<void>((resolve) => {
			resolveExit = resolve;
		});

		const destroy = () => {
			if (closed) return;
			closed = true;
			unsubscribeEvents();
			try {
				rl.close();
			} catch {}
			resolveExit?.();
		};

		rl.on("close", () => {
			destroy();
		});

		void (async () => {
			if (props.initialPrompt?.trim()) {
				try {
					await props.onSubmit(
						props.initialPrompt.trim(),
						props.config.mode === "plan" ? "plan" : "act",
						undefined,
						undefined,
						(out: string) => writeln(out),
					);
					writeln("");
				} catch (err: any) {
					writeErr(err instanceof Error ? err.message : String(err));
				}
			}
			while (!closed) {
				let line: string;
				try {
					line = await rl.question(`${c.bold}${c.cyan}SynAI > ${c.reset}`);
				} catch {
					break;
				}
				const trimmed = line.trim();
				if (!trimmed) continue;
				if (trimmed === "/exit" || trimmed === "/quit" || trimmed === "exit" || trimmed === "quit") {
					destroy();
					break;
				}
				try {
					await props.onSubmit(
						trimmed,
						props.config.mode === "plan" ? "plan" : "act",
						undefined,
						undefined,
						(out: string) => writeln(out),
					);
					writeln("");
				} catch (err: any) {
					writeErr(err instanceof Error ? err.message : String(err));
				}
			}
			destroy();
		})();

		return {
			destroy,
			waitUntilExit: () => exitPromise,
		};
	}

	// eslint-disable-next-line prefer-const
	let tuiApp: Awaited<ReturnType<typeof renderOpenTui>> | undefined;
	setActiveRuntimeCleanup(() => {
		tuiApp?.destroy();
	});
	let startupErrorReported = false;
	let updateCliAfterExit = false;
	const loadDeferredInitialMessages = resumeSessionId?.trim()
		? async () => {
				try {
					await sessionRuntime.ensureReady();
					const { messages } = await sessionRuntime.readCurrentMessages();
					const usage = await sessionRuntime.getAccumulatedUsage({
						inputTokens: 0,
						outputTokens: 0,
					});
					return {
						messages,
						totalCost: usage.totalCost,
						currentContextSize: getCurrentContextSize(messages),
					};
				} catch (error) {
					startupErrorReported = true;
					logCliError(config.logger, "Interactive startup failed", { error });
					throw error;
				}
			}
		: undefined;

	tuiApp = await renderOpenTui({
		config,
		startupTarget: options?.startupTarget,
		initialPrompt: options?.initialPrompt,
		loadDeferredInitialMessages,
		initialRepoStatus,
		workflowSlashCommands,
		loadAdditionalSlashCommands,
		loadWelcomeLine: async () =>
			await resolveSynaiWelcomeLine({
				config,
				synaiApiBaseUrl: options?.synaiApiBaseUrl,
				synaiProviderSettings: options?.synaiProviderSettings,
			}),
		loadSynaiAccount: async () =>
			await loadSynaiAccountSnapshot({
				config,
				synaiApiBaseUrl: options?.synaiApiBaseUrl,
			}),
		loadIndividualSubscriptionPlans: async () =>
			await loadIndividualSubscriptionPlans({
				config,
				synaiApiBaseUrl: options?.synaiApiBaseUrl,
				synaiProviderSettings: options?.synaiProviderSettings,
			}),
		switchSynaiAccount: async (organizationId: any) =>
			await switchSynaiAccount({
				config,
				organizationId,
				synaiApiBaseUrl: options?.synaiApiBaseUrl,
			}),
		loadConfigData: configDataLoader.loadConfigData,
		onToggleConfigItem,
		onDeleteConfigItem,
		subscribeToEvents: ({
			onAgentEvent: onAgent,
			onTeamEvent: onTeam,
			onPendingPrompts,
			onPendingPromptSubmitted,
		}: any) => {
			uiEvents.on("agent", onAgent);
			uiEvents.on("team", onTeam);
			uiEvents.on("pending-prompts", onPendingPrompts);
			uiEvents.on("pending-prompt-submitted", onPendingPromptSubmitted);
			return () => {
				uiEvents.off("agent", onAgent);
				uiEvents.off("team", onTeam);
				uiEvents.off("pending-prompts", onPendingPrompts);
				uiEvents.off("pending-prompt-submitted", onPendingPromptSubmitted);
			};
		},
		onSubmit: async (input: any, mode: any, delivery?: any, attachments?: any, onCommandOutput?: any) => {
			let commandOutput: string | undefined;
			let zeroTurnCost = false;
			try {
				await sessionRuntime.ensureReady();
				await waitForSubmittedMode(mode);
				sessionRuntime.resetAbortRequest();
				if (!delivery) {
					isRunning = true;
				}

				let chatCommandResult = await runInteractiveChatCommand({
					prompt: input,
					enabled: enableChatCommands,
					config,
					host: interactiveChatCommandHost,
					chatCommandState,
					autoApproveAllRef,
					setInteractiveAutoApprove,
					sessionRuntime,
					stop: () => tuiApp?.destroy(),
					onCommandOutput,
				});
				if (chatCommandResult.handled) {
					return chatCommandResult.turnResult;
				}
				if (
					shouldTryPluginChatCommands(input) &&
					!pluginChatCommandHostLoaded
				) {
					await ensurePluginChatCommandHost();
					chatCommandResult = await runInteractiveChatCommand({
						prompt: input,
						enabled: enableChatCommands,
						config,
						host: interactiveChatCommandHost,
						chatCommandState,
						autoApproveAllRef,
						setInteractiveAutoApprove,
						sessionRuntime,
						stop: () => tuiApp?.destroy(),
						onCommandOutput,
					});
					if (chatCommandResult.handled) {
						return chatCommandResult.turnResult;
					}
				}
				input = chatCommandResult.input;
				commandOutput = chatCommandResult.commandOutput;
				zeroTurnCost = await shouldZeroSynaiFreeModelCost(config);
				zeroCurrentTurnCost = zeroTurnCost;
				const {
					prompt: userInput,
					userImages,
					userFiles,
				} = await buildUserInputMessage(input, userInstructionService, {
					mode,
				});
				const mergedUserImages = [
					...(attachments?.userImages ?? []),
					...userImages,
				];
				// Mark a preceding user-initiated mode switch on this message so
				// the model sees exactly when the rules changed, instead of only
				// inferring it from the user_input mode attribute flipping.
				const switchNotice = modeSwitchNotice?.consume?.();
				const noticedUserInput = switchNotice
					? `${formatModeSwitchNotice(switchNotice.from, switchNotice.to)}\n${userInput}`
					: userInput;

				const applyPendingModeChange = async (): Promise<
					AppliedModeChange | undefined
				> => {
					if (!pendingModeChange.current) return undefined;
					const applied: AppliedModeChange = {
						mode: pendingModeChange.current,
						source: pendingModeChange.source ?? "ui",
					};
					pendingModeChange.current = null;
					pendingModeChange.source = null;
					const from = config.mode;
					await sessionRuntime.applyMode(applied.mode);
					tuiModeChanged.current?.(applied.mode);
					// The switch_to_act_mode path announces itself through the
					// continuation prompt; only UI toggles need a notice.
					if (applied.source === "ui" && isInteractiveMode(from)) {
						modeSwitchNotice?.record?.(from, applied.mode);
					}
					return applied;
				};

				const result = await sendTurnWithActModeContinuation({
					sendInitialTurn: () =>
						sessionRuntime.sendCurrentTurn({
							prompt: noticedUserInput,
							mode,
							userImages:
								mergedUserImages.length > 0 ? mergedUserImages : undefined,
							userFiles: userFiles.length > 0 ? userFiles : undefined,
							delivery,
						}),
					sendContinuationTurn: (prompt) =>
						sessionRuntime.sendCurrentTurn({ prompt, mode: "act" }),
					applyPendingModeChange,
				});

				if (!result) {
					return {
						usage: { inputTokens: 0, outputTokens: 0 },
						iterations: 0,
						finishReason: "queued",
						queued: delivery === "queue" || delivery === "steer",
						commandOutput,
					};
				}
				if (result.finishReason !== "completed" && result.finishReason !== "stop") {
					if (result.finishReason === "aborted" || isAbortInProgress()) {
						const usage = zeroCliUsageCost(
							await sessionRuntime.getAccumulatedUsage(result.usage),
							zeroTurnCost,
						);
						return {
							usage,
							currentContextSize: getCurrentContextSize(result.messages),
							iterations: result.iterations,
							finishReason: "aborted",
							commandOutput,
						};
					}
					const usage = zeroCliUsageCost(
						await sessionRuntime.getAccumulatedUsage(result.usage),
						zeroTurnCost,
					);
					return {
						usage,
						currentContextSize: getCurrentContextSize(result.messages),
						iterations: result.iterations,
						finishReason: result.finishReason,
						commandOutput,
					};
				}
				const usage = zeroCliUsageCost(
					await sessionRuntime.getAccumulatedUsage(result.usage),
					zeroTurnCost,
				);
				return {
					usage,
					currentContextSize: getCurrentContextSize(result.messages),
					iterations: result.iterations,
					finishReason: result.finishReason,
					commandOutput,
				};
			} catch (error) {
				if (isAbortInProgress()) {
					return {
						usage: { inputTokens: 0, outputTokens: 0 },
						iterations: 0,
						finishReason: "aborted",
						commandOutput,
					};
				}
				logCliError(config.logger, "Interactive turn failed", {
					error,
					sessionId: sessionRuntime.getActiveSessionId() || undefined,
					delivery,
				});
				return {
					usage: { inputTokens: 0, outputTokens: 0 },
					iterations: 0,
					finishReason: "error",
					commandOutput: error instanceof Error ? error.message : String(error),
				};
			} finally {
				zeroCurrentTurnCost = false;
				if (!delivery) {
					isRunning = false;
					clearAbortInProgress();
					refreshInteractiveSessionPoliciesIfPending();
				}
			}
		},
		onUpdatePendingPrompt: async (update: any) => {
			await sessionRuntime.ensureReady();
			const result = await sessionRuntime.updatePendingPrompt(update);
			return {
				sessionId: result.sessionId,
				prompts: result.prompts.map(toQueuedPromptItem),
				prompt: result.prompt ? toQueuedPromptItem(result.prompt) : undefined,
				updated: result.updated,
				removed: result.removed,
			};
		},
		onAbort: () => {
			return sessionRuntime.abortAll();
		},
		onExit: () => {
			tuiApp?.destroy();
		},
		onHubUpdateRestart: () => {
			updateCliAfterExit = true;
			tuiApp?.destroy();
		},
		onRunningChange: (running: any) => {
			isRunning = running;
			if (!running) {
				sessionRuntime.resetAbortRequest();
				refreshInteractiveSessionPoliciesIfPending();
			}
		},
		onTurnErrorReported: () => {},
		onAutoApproveChange: (enabled: any) => {
			setInteractiveAutoApprove(enabled);
			setToolAutoApproveGlobally(enabled);
			void refreshInteractiveSessionPolicies();
		},
		onCompactionModeChange: async (mode: any) => {
			await sessionRuntime.ensureReady();
			applyCliCompactionMode(config, mode);
			setCompactionModeGlobally(mode);
			await sessionRuntime.restartWithCurrentMessages();
		},
		onModeChange: async (mode: any) => {
			if (!isInteractiveMode(mode)) return;
			// Persist the user's choice immediately, even when the switch is
			// deferred until the current turn aborts, so it survives restarts.
			setPlanActModeGlobally(mode);
			if (isRunning) {
				pendingModeChange.current = mode;
				pendingModeChange.source = "ui";
				sessionRuntime.abortAll();
				return;
			}
			await applyModeChange(mode);
		},
		onNewSession: async () => {
			await sessionRuntime.resetForNewSession();
		},
		onModelChange: () =>
			applyInteractiveModelChange({
				config,
				providerSettingsManager,
				sessionRuntime,
			}),
		onSessionRestart: async () => {
			await sessionRuntime.ensureReady();
			await sessionRuntime.restartEmpty();
		},
		onAccountChange: async () => {
			await sessionRuntime.ensureReady();
			await loadSynaiAccountSnapshot({
				config,
				synaiApiBaseUrl: options?.synaiApiBaseUrl,
			}).catch((error) => {
				logCliError(
					config.logger,
					"SynAI account refresh after account change failed",
					{ error },
				);
			});
			await sessionRuntime.restartWithCurrentMessages();
		},
		// resumeSession initializes the manager and starts the selected session
		// directly. Ensuring a session first would mint an empty history entry
		// when the TUI was launched through `synai history`.
		onResumeSession: async (sessionId: string) =>
			await resumeInteractiveSession(sessionRuntime, sessionId),
		onExportHistorySession: async (sessionId: any, format: any) =>
			await exportHistorySession({
				sessionId,
				format,
				outputDirectory: config.cwd,
			}),
		onDeleteHistorySession: async (sessionId: any) => {
			assertHistorySessionIsDeletable(
				sessionId,
				sessionRuntime.getActiveSessionId(),
			);
			return (await deleteSession(sessionId)).deleted;
		},
		onCompact: async () => {
			await sessionRuntime.ensureReady();
			return await sessionRuntime.compactCurrentSession();
		},
		onFork: async () => {
			await sessionRuntime.ensureReady();
			return await sessionRuntime.forkCurrentSession();
		},
		getCheckpointData: async () => {
			await sessionRuntime.ensureReady();
			return await sessionRuntime.getCheckpointData();
		},
		onRestoreCheckpoint: async (runCount: any, restoreWorkspace?: any) => {
			await sessionRuntime.ensureReady();
			return await sessionRuntime.restoreCheckpoint(runCount, restoreWorkspace);
		},
		setToolApprover: (fn: any) => {
			tuiToolApprover.current = fn;
		},
		setAskQuestion: (fn: any) => {
			tuiAskQuestion.current = fn;
		},
		setModeChangeNotifier: (fn: any) => {
			tuiModeChanged.current = fn;
		},
	});

	if (!loadDeferredInitialMessages && options?.startupTarget !== "history") {
		setTimeout(() => {
			void sessionRuntime.ensureReady().catch((error) => {
				if (sessionRuntime.isShutdownRequested() || startupErrorReported) {
					return;
				}
				startupErrorReported = true;
				logCliError(config.logger, "Interactive startup failed", { error });
				writeErr(error instanceof Error ? error.message : String(error));
				tuiApp?.destroy();
			});
		}, 0);
	}

	let exitSummary: InteractiveExitSummary | undefined;
	try {
		await tuiApp.waitUntilExit();
	} finally {
		exitSummary = await cleanupRuntime();
	}
	if (exitSummary) {
		prepareTerminalForPostTuiOutput();
		writeln(formatInteractiveExitSummary(exitSummary));
	}
	if (updateCliAfterExit) {
		if (!exitSummary) {
			prepareTerminalForPostTuiOutput();
		}
		writeln(
			"The shared SynAI Daemon was updated by another SynAI installation. Updating this CLI...",
		);
		const { checkForUpdates } = await import("../commands/update");
		const exitCode = await checkForUpdates({ includeBoard: false });
		writeln(
			exitCode === 0
				? "Start synai again to reconnect to the updated Daemon."
				: "Update did not complete. Run 'synai upgrade' manually, then start synai again.",
		);
	}
}
