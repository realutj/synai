import {
	captureProviderConfigured,
	getLocalProviderModels,
	getProviderConfigFields,
	type ProviderConfigFieldKey,
	type ProviderConfigFields,
	ProviderSettingsManager,
	refreshProviderModelsFromSource,
	resolveProviderConfig,
	saveLocalProviderSettings,
} from "@synai/core";
import { isSynaiProvider } from "@synai/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isChatProviderModel } from "../../../utils/chat-models";
import {
	getCliSubscriptionUrl,
	getIndividualPlanFeatures,
} from "../../../utils/synai-errors";
import {
	checkLocalCliInstalled,
	getLocalCliInfo,
	type LocalCliStatus,
	type ProviderLocalCli,
} from "../../../utils/local-cli";
import open from "../../../utils/open";
import {
	getPersistedProviderApiKey,
	isLocalAuthProvider,
	isOAuthProvider,
} from "../../../utils/provider-auth";
import { listLocalProviders } from "../../../utils/provider-catalog";
import { getCliTelemetryService } from "../../../utils/telemetry";
import {
	loadCurrentUserPlanFromProviderSettings,
	loadIndividualSubscriptionPlansFromProviderSettings,
} from "../../synai-account";
import {
	buildFeaturedModelEntries,
	type SynaiModelPickerEntry,
	useSynaiRecommendedModels,
} from "../../components/model-selector/synai-model-picker";
import {
	type SearchableItem,
	useSearchableList,
} from "../../components/searchable-list";
import { useTheme } from "../../hooks/use-theme";
import {
	getDefaultAwsRegion,
	type ProviderConfigValues,
	resolveProviderConfigAwsRegion,
	resolveProviderConfigAzure,
	resolveProviderConfigSap,
	updateProviderConfigValue,
} from "../../utils/provider-config-values";
import { getProviderSection } from "../../utils/provider-sections";
import {
	isOnboardingOAuthProviderId,
	type OnboardingOAuthProviderId,
	runDeviceCodeAuthFlow,
	runOAuthAuthFlow,
} from "./auth";
import { FIELD_ORDER } from "./fields";
import { useOnboardingKeyboard } from "./keyboard";
import {
	SYNAI_PASS_SUBSCRIPTION_OPTIONS,
	type SynaiPassSubscriptionStatus,
	canContinueLocalCliSetup,
	DEFAULT_THINKING_LEVEL_INDEX,
	getMainMenuOptions,
	type ModelEntry,
	type OnboardingResult,
	type OnboardingStep,
	type ProviderEntry,
	type ReasoningEffort,
	resolveProviderSetupRoute,
	shouldUseFeaturedSynaiModelPicker,
	type ThinkingLevel,
	toModelEntriesFromKnownModels,
	toModelEntry,
	toProviderEntry,
} from "./model";

const CUSTOM_MODEL_ID_ACTION = "__custom_model_id__";

export interface OnboardingControllerProps {
	onComplete: (result: OnboardingResult) => void;
	onExit: () => void;
	providerSettingsManager?: ProviderSettingsManager;
}

export function useOnboardingController(props: OnboardingControllerProps) {
	const { onComplete } = props;
	const theme = useTheme();
	const providerSettingsManager = useMemo(
		() => props.providerSettingsManager ?? new ProviderSettingsManager(),
		[props.providerSettingsManager],
	);
	const menuOptions = useMemo(
		() =>
			getMainMenuOptions({
				isSynaiPassEnabled: false,
			}),
		[],
	);
	const [step, setStep] = useState<OnboardingStep>("menu");
	const [menuSelected, setMenuSelected] = useState(0);
	const [oauthProvider, setOauthProvider] = useState("");
	const [authStatus, setAuthStatus] = useState("");
	const [authUrl, setAuthUrl] = useState("");
	const [authError, setAuthError] = useState("");
	const [activeProviderId, setActiveProviderId] = useState("");
	const [activeProviderName, setActiveProviderName] = useState("");
	const localCli = useMemo(
		() => getLocalCliInfo(activeProviderId),
		[activeProviderId],
	);
	const [byoFields, setByoFields] = useState<ProviderConfigFields["fields"]>(
		{},
	);
	const [byoDescription, setByoDescription] = useState<string | undefined>();
	const [byoValues, setByoValues] = useState<ProviderConfigValues>({});
	const [byoFocusedField, setByoFocusedField] =
		useState<ProviderConfigFieldKey>("apiKey");
	const [localCliStatus, setLocalCliStatus] = useState<
		LocalCliStatus | undefined
	>();
	const [localCliChecking, setLocalCliChecking] = useState(false);
	const localCliProbeRef = useRef(0);
	const authAbortRef = useRef(false);

	// Device code flow
	const [deviceUserCode, setDeviceUserCode] = useState("");
	const [deviceVerifyUrl, setDeviceVerifyUrl] = useState("");
	const [deviceStatus, setDeviceStatus] = useState("");
	const [deviceError, setDeviceError] = useState("");
	const deviceAbortRef = useRef(false);

	// Provider catalog
	const [providers, setProviders] = useState<ProviderEntry[]>([]);
	const [providersLoading, setProvidersLoading] = useState(true);

	useEffect(() => {
		listLocalProviders(providerSettingsManager)
			.then(({ providers: list }) => {
				setProviders(list.map(toProviderEntry));
			})
			.catch(() => {})
			.finally(() => setProvidersLoading(false));
	}, [providerSettingsManager]);

	const providerItems: SearchableItem[] = useMemo(
		() =>
			providers.map((p) => {
				let label = p.name;
				if (p.id === "synai") {
					label = "SynAI Cloud (Usage-Billing)";
				} else if (p.id === "synai-pass") {
					label = "SynAI Pass";
				} else {
					label = label.replaceAll("Synai", "SynAI").replaceAll("synai", "synai");
				}
				return {
					key: p.id,
					label,
					section: getProviderSection(p),
					detail: p.isOAuth
						? "(OAuth)"
						: p.isLocalAuth
							? "(local CLI)"
							: undefined,
					searchText: `${label} ${p.id}`,
					rightLabel: p.hasAuth ? "[*]" : undefined,
					rightLabelColor: theme.accents.success,
				};
			}),
		[providers, theme.accents.success],
	);

	const providerList = useSearchableList(providerItems);

	// Model catalog for selected provider
	const [modelEntries, setModelEntries] = useState<ModelEntry[]>([]);
	const [modelsLoading, setModelsLoading] = useState(false);
	const [modelsDefaultId, setModelsDefaultId] = useState("");
	const [customModelId, setCustomModelId] = useState("");
	const [customModelError, setCustomModelError] = useState("");
	const [synaiPassSubscriptionStatus, setSynaiPassSubscriptionStatus] =
		useState<SynaiPassSubscriptionStatus>("loading");
	const [synaiPassSubscriptionError, setSynaiPassSubscriptionError] =
		useState("");
	const [synaiPassCurrentPlanName, setSynaiPassCurrentPlanName] = useState("");
	const [synaiPassPlanFeatures, setSynaiPassPlanFeatures] = useState<string[]>(
		[],
	);
	const [synaiPassSubscriptionSelected, setSynaiPassSubscriptionSelected] =
		useState(0);
	const [synaiPassSubscriptionOpenStatus, setSynaiPassSubscriptionOpenStatus] =
		useState("");
	const synaiPassSubscriptionUrl = useMemo(() => getCliSubscriptionUrl(), []);

	const modelItems: SearchableItem[] = useMemo(
		() =>
			modelEntries.map((m) => ({
				key: m.id,
				label: m.name,
				searchText: `${m.name} ${m.id}`,
				rightLabel: m.id === modelsDefaultId ? "(default)" : undefined,
				rightLabelColor: "gray",
			})),
		[modelEntries, modelsDefaultId],
	);

	const createCustomModelItem = useCallback(
		(_search: string, filteredItems: SearchableItem[]) => {
			if (activeProviderId === "synai-pass") {
				return undefined;
			}
			if (filteredItems.some((item) => item.key === CUSTOM_MODEL_ID_ACTION)) {
				return undefined;
			}
			return {
				key: CUSTOM_MODEL_ID_ACTION,
				label: "Create custom model ID",
				detail: "manual entry",
				searchText: "create custom model id manual entry",
			} satisfies SearchableItem;
		},
		[activeProviderId],
	);

	const modelList = useSearchableList(modelItems, createCustomModelItem);

	// synai featured model picker (SynaiPass gets Subscribed/Free sections)
	const recommended = useSynaiRecommendedModels();
	const synaiEntries: SynaiModelPickerEntry[] = useMemo(
		() =>
			recommended.data
				? buildFeaturedModelEntries(activeProviderId, recommended.data)
				: [],
		[recommended.data, activeProviderId],
	);
	const [synaiModelSelected, setSynaiModelSelected] = useState(0);
	const [synaiModelReasoningIds, setSynaiModelReasoningIds] = useState<
		Set<string>
	>(new Set());

	useEffect(() => {
		// The featured picker serves both synai and synai-pass, so pool
		// reasoning support from both catalogs. Display names need no catalog
		// here: fetchSynaiRecommendedModels resolves them.
		void Promise.allSettled(
			["synai", "synai-pass"].map((providerId) =>
				getLocalProviderModels(providerId),
			),
		).then((results) => {
			const ids = new Set<string>();
			for (const result of results) {
				if (result.status !== "fulfilled") continue;
				for (const m of result.value.models.filter(isChatProviderModel)) {
					if (m.supportsReasoning) ids.add(m.id);
				}
			}
			setSynaiModelReasoningIds(ids);
		});
	}, []);

	// Thinking level
	const [thinkingSelected, setThinkingSelected] = useState(
		DEFAULT_THINKING_LEVEL_INDEX,
	);
	const [selectedModelName, setSelectedModelName] = useState("");
	const [selectedModelId, setSelectedModelId] = useState("");
	const [selectedThinking, setSelectedThinking] = useState(false);
	const [selectedReasoningEffort, setSelectedReasoningEffort] = useState<
		ReasoningEffort | undefined
	>(undefined);

	const loadModelsForProvider = useCallback(
		(providerId: string) => {
			setModelsLoading(true);
			setModelEntries([]);
			refreshProviderModelsFromSource(providerSettingsManager, providerId)
				.catch(() => {})
				.then(async () => {
					const providerConfig = providerSettingsManager.getProviderConfig(
						providerId,
						{ includeKnownModels: false },
					);
					const resolved = await resolveProviderConfig(
						providerId,
						{
							loadLatestOnInit: true,
							loadPrivateOnAuth: true,
							failOnError: false,
						},
						providerConfig,
					);
					const resolvedModels = toModelEntriesFromKnownModels(
						resolved?.knownModels,
					);
					if (resolvedModels.length > 0) {
						setModelsDefaultId(resolved?.modelId ?? "");
						return resolvedModels;
					}
					const { models } = await getLocalProviderModels(
						providerId,
						providerConfig,
					);
					return models.filter(isChatProviderModel).map(toModelEntry);
				})
				.then((models) => {
					setModelEntries(models);
				})
				.catch(() => {})
				.finally(() => setModelsLoading(false));
		},
		[providerSettingsManager],
	);

	const refreshSynaiPassSubscriptionStatus = useCallback(() => {
		setSynaiPassSubscriptionStatus("loading");
		setSynaiPassSubscriptionError("");
		setSynaiPassCurrentPlanName("");
		setSynaiPassSubscriptionOpenStatus("");

		loadCurrentUserPlanFromProviderSettings({ providerSettingsManager })
			.then(
				(value) => ({ status: "fulfilled" as const, value }),
				(reason) => ({ status: "rejected" as const, reason }),
			)
			.then((currentPlanResult) =>
				loadIndividualSubscriptionPlansFromProviderSettings({
					providerSettingsManager,
				})
					.then(
						(value) => ({ status: "fulfilled" as const, value }),
						(reason) => ({ status: "rejected" as const, reason }),
					)
					.then((availablePlansResult) => ({
						availablePlansResult,
						currentPlanResult,
					})),
			)
			.then(({ currentPlanResult, availablePlansResult }) => {
				if (availablePlansResult.status === "fulfilled") {
					setSynaiPassPlanFeatures(
						getIndividualPlanFeatures(availablePlansResult.value),
					);
				}

				if (currentPlanResult.status === "rejected") {
					const error = currentPlanResult.reason;
					const message =
						error instanceof Error ? error.message : String(error);
					if (message.trim().toLowerCase() === "no plan found for user") {
						setSynaiPassSubscriptionStatus("unsubscribed");
						return;
					}
					setSynaiPassSubscriptionError(message);
					setSynaiPassSubscriptionStatus("error");
					return;
				}

				const plan = currentPlanResult.value?.plan;
				if (plan) {
					setSynaiPassCurrentPlanName(
						plan.displayName || plan.name || plan.id || "SynaiPass",
					);
					setSynaiPassSubscriptionStatus("subscribed");
				} else {
					setSynaiPassSubscriptionStatus("unsubscribed");
				}
			});
	}, [providerSettingsManager]);

	const transitionToModelPicker = useCallback(
		(providerId: string) => {
			setActiveProviderId(providerId);
			const provider = providers.find((p) => p.id === providerId);
			setActiveProviderName(provider?.name ?? providerId);
			setModelsDefaultId(provider?.defaultModelId ?? "");
			if (shouldUseFeaturedSynaiModelPicker(providerId)) {
				setSynaiModelSelected(0);
				setStep("synai_model");
			} else if (providerId === "openai-compatible") {
				const existing =
					providerSettingsManager.getProviderSettings(providerId);
				setCustomModelId(existing?.model ?? provider?.defaultModelId ?? "");
				setCustomModelError("");
				setStep("custom_model_id");
			} else {
				setStep("model_picker");
				loadModelsForProvider(providerId);
			}
		},
		[providers, loadModelsForProvider, providerSettingsManager],
	);

	const transitionToSynaiPassSubscription = useCallback(() => {
		setActiveProviderId("synai-pass");
		const provider = providers.find((p) => p.id === "synai-pass");
		setActiveProviderName(provider?.name ?? "SynaiPass");
		setModelsDefaultId(provider?.defaultModelId ?? "");
		setSynaiPassSubscriptionSelected(0);
		setStep("synai_pass_subscription");
		refreshSynaiPassSubscriptionStatus();
	}, [providers, refreshSynaiPassSubscriptionStatus]);

	const handleAuthComplete = useCallback(
		(providerId: OnboardingOAuthProviderId) => {
			if (providerId === "synai-pass") {
				transitionToSynaiPassSubscription();
				return;
			}
			transitionToModelPicker(providerId);
		},
		[transitionToSynaiPassSubscription, transitionToModelPicker],
	);

	const resetAuth = useCallback(() => {
		setAuthStatus("");
		setAuthUrl("");
		setAuthError("");
		authAbortRef.current = false;
	}, []);

	const startDeviceCodeFlow = useCallback(
		(providerId: OnboardingOAuthProviderId) => {
			deviceAbortRef.current = false;
			setDeviceUserCode("");
			setDeviceVerifyUrl("");
			setDeviceError("");
			setDeviceStatus("Requesting device code...");
			setOauthProvider(providerId);
			setStep("device_code");

			runDeviceCodeAuthFlow({
				providerId,
				providerSettingsManager,
				isAborted: () => deviceAbortRef.current,
				setUserCode: setDeviceUserCode,
				setVerifyUrl: setDeviceVerifyUrl,
				setStatus: setDeviceStatus,
				setError: setDeviceError,
				onComplete: handleAuthComplete,
				telemetry: getCliTelemetryService(),
			});
		},
		[providerSettingsManager, handleAuthComplete],
	);

	const startOAuthFlow = useCallback(
		(providerId: OnboardingOAuthProviderId) => {
			if (isSynaiProvider(providerId)) {
				startDeviceCodeFlow(providerId);
				return;
			}

			resetAuth();
			setOauthProvider(providerId);
			setStep("oauth_pending");
			setAuthStatus("Opening browser...");

			runOAuthAuthFlow({
				providerId,
				providerSettingsManager,
				isAborted: () => authAbortRef.current,
				setStatus: setAuthStatus,
				setAuthUrl,
				setError: setAuthError,
				onComplete: handleAuthComplete,
				telemetry: getCliTelemetryService(),
			});
		},
		[
			providerSettingsManager,
			resetAuth,
			handleAuthComplete,
			startDeviceCodeFlow,
		],
	);

	const continueFromSynaiPassSubscription = useCallback(() => {
		transitionToModelPicker("synai-pass");
	}, [transitionToModelPicker]);

	const openSynaiPassSubscriptionPage = useCallback(() => {
		setSynaiPassSubscriptionOpenStatus("Opening subscription page...");
		void open(synaiPassSubscriptionUrl, { wait: false })
			.then(() => {
				setSynaiPassSubscriptionOpenStatus(
					"Opened subscription page in your browser.",
				);
			})
			.catch(() => {
				setSynaiPassSubscriptionOpenStatus(
					`Could not open browser automatically. Open ${synaiPassSubscriptionUrl}`,
				);
			});
	}, [synaiPassSubscriptionUrl]);

	useEffect(() => {
		if (
			step === "synai_pass_subscription" &&
			synaiPassSubscriptionStatus === "subscribed"
		) {
			transitionToModelPicker("synai-pass");
		}
	}, [step, synaiPassSubscriptionStatus, transitionToModelPicker]);

	const refreshLocalCliStatus = useCallback((provider: ProviderLocalCli) => {
		// Probing spawns the provider's CLI, so a result can land long after the
		// user moved on. Two local-CLI providers share this single status, so an
		// unlabelled result could mark the selected provider ready off a probe of
		// the previous one (or block it off a stale failure). Only the newest
		// probe may write.
		const probeId = ++localCliProbeRef.current;
		const isCurrentProbe = () => localCliProbeRef.current === probeId;
		setLocalCliStatus(undefined);
		setLocalCliChecking(true);
		checkLocalCliInstalled(provider)
			.then((status) => {
				if (isCurrentProbe()) setLocalCliStatus(status);
			})
			.finally(() => {
				if (isCurrentProbe()) setLocalCliChecking(false);
			});
	}, []);

	const selectProvider = useCallback(
		(providerId: string) => {
			const names: Record<string, string> = {
				openrouter: "OpenRouter Engine",
				anthropic: "Anthropic Claude",
				openai: "OpenAI Platform",
				"openai-codex": "ChatGPT OAuth",
				deepseek: "DeepSeek",
				google: "Google Gemini",
				groq: "Groq",
				ollama: "Ollama",
				byo: "Custom / Local Provider",
			};
			const provider: ProviderEntry = providers.find((p) => p.id === providerId) ?? {
				id: providerId,
				name: names[providerId] || providerId,
				isOAuth: isOAuthProvider(providerId),
				isLocalAuth: isLocalAuthProvider(providerId),
				hasAuth: false,
				models: 0,
				defaultModelId: "",
			};
			if (provider.isOAuth) {
				if (isOnboardingOAuthProviderId(provider.id)) {
					startOAuthFlow(provider.id);
				}
				return;
			}
			if (resolveProviderSetupRoute(provider.id) === "local_cli") {
				setActiveProviderId(provider.id);
				setActiveProviderName(provider.name);
				setStep("local_cli_setup");
				// Only providers that name a CLI have something to probe; the
				// rest reach the screen with readiness simply unknown.
				const localCliProvider = getLocalCliInfo(provider.id);
				if (localCliProvider) refreshLocalCliStatus(localCliProvider);
				return;
			}
			const config = getProviderConfigFields(provider.id);
			setActiveProviderId(provider.id);
			setActiveProviderName(provider.name);
			setByoFields(config.fields || {});
			setByoDescription(config.description);

			// Build initial values from existing settings
			const existing = providerSettingsManager.getProviderSettings(provider.id);
			const initialValues: ProviderConfigValues = {};
			if (config.fields?.baseUrl) {
				initialValues.baseUrl =
					existing?.baseUrl?.trim() ??
					config.fields.baseUrl?.defaultValue ??
					"";
			}
			if (config.fields?.azureApiVersion) {
				initialValues.azureApiVersion =
					existing?.azure?.apiVersion?.trim() ?? "";
			}
			if (config.fields?.awsRegion) {
				const existingProfile = existing?.aws?.profile?.trim() ?? "";
				initialValues.awsRegion =
					existing?.aws?.region?.trim() || getDefaultAwsRegion(existingProfile);
			}
			if (config.fields?.apiKey) {
				initialValues.apiKey = existing?.apiKey?.trim() ?? "";
			}
			if (config.fields?.awsProfile) {
				initialValues.awsProfile = existing?.aws?.profile?.trim() ?? "";
			}
			if (config.fields?.sapClientId) {
				initialValues.sapClientId = existing?.sap?.clientId?.trim() ?? "";
			}
			if (config.fields?.sapClientSecret) {
				initialValues.sapClientSecret =
					existing?.sap?.clientSecret?.trim() ?? "";
			}
			if (config.fields?.sapTokenUrl) {
				initialValues.sapTokenUrl = existing?.sap?.tokenUrl?.trim() ?? "";
			}
			if (config.fields?.sapResourceGroup) {
				initialValues.sapResourceGroup =
					existing?.sap?.resourceGroup?.trim() ?? "default";
			}
			if (config.fields?.sapDeploymentId) {
				initialValues.sapDeploymentId =
					existing?.sap?.deploymentId?.trim() ?? "";
			}
			setByoValues(initialValues);

			// Focus the first visible field
			const firstField = FIELD_ORDER.find(
				(k) => config.fields && config.fields[k] !== undefined,
			);
			setByoFocusedField(firstField ?? "apiKey");
			setStep("byo_apikey");
		},
		[providers, startOAuthFlow, refreshLocalCliStatus, providerSettingsManager],
	);

	const recheckLocalCli = useCallback(() => {
		if (localCli) {
			refreshLocalCliStatus(localCli);
		}
	}, [localCli, refreshLocalCliStatus]);

	const saveLocalCliConfig = useCallback(() => {
		if (!canContinueLocalCliSetup(localCli, localCliStatus)) {
			return;
		}
		saveLocalProviderSettings(providerSettingsManager, {
			providerId: activeProviderId,
		});
		transitionToModelPicker(activeProviderId);
	}, [
		activeProviderId,
		localCli,
		localCliStatus,
		providerSettingsManager,
		transitionToModelPicker,
	]);

	const saveByoConfig = useCallback(() => {
		// No required-field validation. If credentials are missing or wrong,
		// the provider's own auth response is the authoritative error and is
		// surfaced when the model picker / first turn runs.
		const apiKey = byoValues.apiKey?.trim();
		const awsProfile = byoValues.awsProfile?.trim();
		const hasAzureFields = byoFields.azureApiVersion;
		const hasAwsFields = byoFields.awsRegion || byoFields.awsProfile;
		const hasSapFields =
			byoFields.sapClientId ||
			byoFields.sapClientSecret ||
			byoFields.sapTokenUrl ||
			byoFields.sapResourceGroup ||
			byoFields.sapDeploymentId;

		saveLocalProviderSettings(providerSettingsManager, {
			providerId: activeProviderId,
			apiKey: byoFields.apiKey ? apiKey : undefined,
			baseUrl: byoFields.baseUrl ? byoValues.baseUrl?.trim() : undefined,
			azure: hasAzureFields ? resolveProviderConfigAzure(byoValues) : undefined,
			aws: hasAwsFields
				? {
						region: resolveProviderConfigAwsRegion(byoValues),
						authentication: apiKey ? "api-key" : "profile",
						profile: apiKey ? undefined : awsProfile || undefined,
					}
				: undefined,
			sap: hasSapFields ? resolveProviderConfigSap(byoValues) : undefined,
		});
		// Emit a single `user.provider_configured` event mirroring the
		// `{ provider }` payload shape used by the auth funnel. The save above
		// is synchronous and infallible, so there's no start/fail counterpart;
		// invalid credentials surface later as `task.provider_api_error` on
		// the first real API call.
		captureProviderConfigured(getCliTelemetryService(), activeProviderId);
		transitionToModelPicker(activeProviderId);
	}, [
		byoValues,
		byoFields,
		activeProviderId,
		providerSettingsManager,
		transitionToModelPicker,
	]);

	const completeModelSelection = useCallback(
		(modelId: string) => {
			const existing =
				providerSettingsManager.getProviderSettings(activeProviderId);
			providerSettingsManager.saveProviderSettings(
				{ ...(existing ?? { provider: activeProviderId }), model: modelId },
				{ setLastUsed: true },
			);
			setSelectedModelId(modelId);
			const entry = modelEntries.find((m) => m.id === modelId);
			if (entry?.supportsReasoning) {
				setSelectedModelName(entry.name);
				setThinkingSelected(DEFAULT_THINKING_LEVEL_INDEX);
				setStep("thinking_level");
			} else {
				setStep("done");
			}
		},
		[activeProviderId, modelEntries, providerSettingsManager],
	);

	const selectModelItem = useCallback(
		(item: SearchableItem | undefined) => {
			if (!item) return;
			if (item.key === CUSTOM_MODEL_ID_ACTION) {
				setCustomModelId("");
				setCustomModelError("");
				setStep("custom_model_id");
				return;
			}
			completeModelSelection(item.key);
		},
		[completeModelSelection],
	);

	const saveModelSelection = useCallback(() => {
		selectModelItem(modelList.selectedItem);
	}, [modelList.selectedItem, selectModelItem]);

	const saveCustomModelId = useCallback(() => {
		const modelId = customModelId.trim();
		if (!modelId) {
			setCustomModelError("Enter a model ID");
			return;
		}
		completeModelSelection(modelId);
	}, [customModelId, completeModelSelection]);

	const saveSynaiModelSelection = useCallback(
		(modelId: string, modelName: string) => {
			const existing =
				providerSettingsManager.getProviderSettings(activeProviderId);
			providerSettingsManager.saveProviderSettings(
				{
					...(existing ?? { provider: activeProviderId }),
					model: modelId,
				},
				{ setLastUsed: true },
			);
			setSelectedModelId(modelId);
			if (synaiModelReasoningIds.has(modelId)) {
				setSelectedModelName(modelName);
				setThinkingSelected(DEFAULT_THINKING_LEVEL_INDEX);
				setStep("thinking_level");
			} else {
				setStep("done");
			}
		},
		[activeProviderId, synaiModelReasoningIds, providerSettingsManager],
	);

	const saveThinkingLevel = useCallback(
		(level: ThinkingLevel) => {
			const existing =
				providerSettingsManager.getProviderSettings(activeProviderId);
			if (level === "none") {
				providerSettingsManager.saveProviderSettings({
					...(existing ?? { provider: activeProviderId }),
					reasoning: { enabled: false },
				});
				setSelectedThinking(false);
				setSelectedReasoningEffort(undefined);
			} else {
				providerSettingsManager.saveProviderSettings({
					...(existing ?? { provider: activeProviderId }),
					reasoning: { enabled: true, effort: level },
				});
				setSelectedThinking(true);
				setSelectedReasoningEffort(level);
			}
			setStep("done");
		},
		[activeProviderId, providerSettingsManager],
	);

	useEffect(() => {
		if (step !== "done") return undefined;
		const timer = setTimeout(() => {
			const providerSettings =
				providerSettingsManager.getProviderSettings(activeProviderId);
			onComplete({
				providerId: activeProviderId,
				modelId: selectedModelId,
				apiKey: getPersistedProviderApiKey(activeProviderId, providerSettings),
				thinking: selectedThinking,
				reasoningEffort: selectedReasoningEffort,
			});
		}, 500);
		return () => clearTimeout(timer);
	}, [
		step,
		onComplete,
		activeProviderId,
		selectedModelId,
		selectedThinking,
		selectedReasoningEffort,
		providerSettingsManager,
	]);

	useOnboardingKeyboard({
		step,
		onExit: props.onExit,
		oauthProvider,
		activeProviderId,
		menuOptions,
		menuSelected,
		providerList,
		modelList,
		synaiEntries,
		synaiModelSelected,
		synaiPassSubscriptionStatus,
		synaiPassSubscriptionOptions: SYNAI_PASS_SUBSCRIPTION_OPTIONS,
		synaiPassSubscriptionSelected,
		thinkingSelected,
		setStep,
		setMenuSelected,
		resetByoFields: () => {
			setByoFields({});
			setByoValues({});
			setByoDescription(undefined);
		},
		byoFields,
		byoFocusedField,
		setByoFocusedField,
		setDeviceUserCode,
		setDeviceVerifyUrl,
		setDeviceError,
		setDeviceStatus,
		setSynaiModelSelected,
		setSynaiPassSubscriptionSelected,
		setThinkingSelected,
		continueFromSynaiPassSubscription,
		refreshSynaiPassSubscriptionStatus,
		openSynaiPassSubscriptionPage,
		abortOAuth: () => {
			authAbortRef.current = true;
		},
		abortDeviceCode: () => {
			deviceAbortRef.current = true;
		},
		resetAuth,
		refreshLocalCliStatus: recheckLocalCli,
		startOAuthFlow,
		startDeviceCodeFlow,
		selectProvider,
		loadModelsForProvider,
		saveSynaiModelSelection,
		saveLocalCliConfig,
		saveByoConfig,
		saveModelSelection,
		saveThinkingLevel,
	});

	return {
		activeProviderName,
		activeProviderId,
		authError,
		authStatus,
		authUrl,
		byoDescription,
		byoFields,
		byoFocusedField,
		byoValues,
		localCli,
		localCliChecking,
		localCliStatus,
		synaiEntries,
		synaiModelSelected,
		synaiPassCurrentPlanName,
		synaiPassPlanFeatures,
		synaiPassSubscriptionError,
		synaiPassSubscriptionOpenStatus,
		synaiPassSubscriptionOptions: SYNAI_PASS_SUBSCRIPTION_OPTIONS,
		synaiPassSubscriptionSelected,
		synaiPassSubscriptionStatus,
		synaiPassSubscriptionUrl,
		deviceError,
		deviceStatus,
		deviceUserCode,
		deviceVerifyUrl,
		customModelError,
		customModelId,
		customModelTitle:
			activeProviderId === "openai-compatible"
				? "Set model ID"
				: "Create custom model ID",
		handleByoFieldInput: (field: ProviderConfigFieldKey, value: string) => {
			setByoValues((prev) => updateProviderConfigValue(prev, field, value));
		},
		handleCustomModelIdInput: (value: string) => {
			setCustomModelId(value);
			setCustomModelError("");
		},
		handleModelItemSelect: selectModelItem,
		handleMenuSelect: (index: number) => {
			setMenuSelected(index);
			const option = menuOptions[index];
			if (!option) return;
			if (option.value === "byo") {
				setStep("byo_provider");
			} else if (isOnboardingOAuthProviderId(option.value)) {
				startOAuthFlow(option.value);
			} else {
				selectProvider(option.value);
			}
		},
		menuSelected,
		menuOptions,
		modelItems,
		modelList,
		modelsLoading,
		oauthProvider,
		providerList,
		providersLoading,
		recommendedLoading: recommended.loading,
		saveByoConfig,
		saveLocalCliConfig,
		saveCustomModelId,
		selectedModelName,
		step,
		thinkingSelected,
	};
}
