"use client";

import { AgentWelcomeHero, Button, IconButton } from "@synai/ui";
import {
	ArrowLeft,
	CheckCircle2,
	ExternalLink,
	Import,
	KeyRound,
	Loader2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImportSessionsDialog } from "@/components/import-sessions-dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { OAUTH_MANAGED_PROVIDERS } from "@/hooks/chat-session/constants";
import { desktopClient, openExternalUrl } from "@/lib/desktop-client";
import {
	readModelSelectionStorageFromWindow,
	writeModelSelectionStorageToWindow,
} from "@/lib/model-selection";
import { getProviderApiKeyUrl } from "@/lib/provider-key-urls";
import {
	fetchProviderCatalog,
	invalidateProviderCatalogCache,
} from "@/lib/provider-model-catalog";
import type { Provider } from "@/lib/provider-schema";
import {
	type ListImportableSessionsResponse,
	SESSION_IMPORT_TOOL_LABELS,
	SESSION_IMPORT_TOOL_ORDER,
	type SessionImportTool,
} from "@/lib/session-import";
import { cn } from "@/lib/utils";

export const GITHUB_ONBOARDING_FEATURE_FLAG = "code-onboarding-github";

export type OnboardingStep =
	| "welcome"
	| "connect"
	| "github"
	| "import"
	| "done";

export type OnboardingConnection = {
	kind: "provider";
	providerName: string;
};

export type SetupMethod = "api-key";

/**
 * Providers surfaced first in the bring-your-own-key picker. Everything else
 * from the catalog follows alphabetically.
 */
const PREFERRED_PROVIDER_ORDER = [
	"openrouter",
	"anthropic",
	"openai-native",
	"gemini",
	"deepseek",
	"xai",
	"groq",
	"mistral",
	"ollama",
];

/**
 * True when entering an API key is all the provider needs: it declares an
 * API-key config field and nothing beyond key/base-URL.
 */
function isApiKeyOnlyProvider(provider: Provider): boolean {
	const fields = provider.configFields;
	if (!fields) {
		return true;
	}
	return (
		fields.some((field) => field.path === "apiKey") &&
		fields.every((field) => field.path === "apiKey" || field.path === "baseUrl")
	);
}

/**
 * Orders the provider catalog for the API-key setup step.
 */
export function sortProvidersForApiKeySetup(providers: Provider[]): Provider[] {
	const rank = (id: string) => {
		const index = PREFERRED_PROVIDER_ORDER.indexOf(id);
		return index === -1 ? PREFERRED_PROVIDER_ORDER.length : index;
	};
	return providers
		.filter(
			(provider) =>
				!OAUTH_MANAGED_PROVIDERS.has(provider.id) &&
				provider.id !== "synai" &&
				provider.id !== "synai-pass" &&
				isApiKeyOnlyProvider(provider),
		)
		.sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
}

/**
 * Remembers the connected provider so the chat composer opens pointed at what
 * the user just set up.
 */
function rememberProviderSelection(provider: {
	id: string;
	defaultModelId?: string;
}): void {
	const selection = readModelSelectionStorageFromWindow();
	writeModelSelectionStorageToWindow({
		lastProvider: provider.id,
		lastModelByProvider: provider.defaultModelId
			? {
					...selection.lastModelByProvider,
					[provider.id]: provider.defaultModelId,
				}
			: selection.lastModelByProvider,
	});
}

function OnboardingContent({
	children,
	surface = "plain",
}: {
	children: React.ReactNode;
	surface?: "panel" | "plain" | "transparent";
}) {
	return (
		<div
			className={cn(
				"relative z-10 w-full max-w-148 rounded-2xl p-8 pb-6 max-[720px]:p-5",
				surface === "panel" && "border border-border bg-background",
				surface === "plain" && "bg-background",
				surface === "transparent" && "bg-transparent",
			)}
			data-onboarding-content={surface}
		>
			{children}
		</div>
	);
}

function SetupOptionCard({
	children,
	id,
	onSelect,
	selectLabel,
	selected,
}: {
	children: React.ReactNode;
	id: SetupMethod;
	onSelect: () => void;
	selectLabel: string;
	selected: boolean;
}) {
	const contentRef = useRef<HTMLDivElement>(null);
	const wasSelectedRef = useRef(selected);

	useEffect(() => {
		if (selected && !wasSelectedRef.current) {
			contentRef.current
				?.querySelector<HTMLElement>(
					'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
				)
				?.focus();
		}
		wasSelectedRef.current = selected;
	}, [selected]);

	return (
		<div
			className={cn(
				"relative rounded-xl border p-6 pb-8",
				selected
					? "border-primary/20 bg-primary/4 ring-1 ring-primary/20 ring-inset hover:bg-primary/8"
					: "border-border/70 hover:bg-surface-hover-lighter/60",
			)}
			data-onboarding-option={id}
			data-selected={selected}
		>
			{!selected ? (
				<button
					aria-label={selectLabel}
					className="absolute inset-0 z-10 cursor-pointer rounded-xl bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
					onClick={onSelect}
					type="button"
				/>
			) : null}
			<div
				data-onboarding-option-content
				inert={!selected ? true : undefined}
				ref={contentRef}
			>
				{children}
			</div>
		</div>
	);
}

function SetupOptionHeader({
	accessory,
	description,
	icon,
	title,
}: {
	accessory?: React.ReactNode;
	description: React.ReactNode;
	icon: React.ReactNode;
	title: string;
}) {
	return (
		<div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 text-left max-[720px]:gap-x-3 max-[720px]:gap-y-3">
			<span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/4 text-muted-foreground max-[720px]:mt-0">
				{icon}
			</span>
			<div className="min-w-0 mt-1 max-[720px]:col-span-3 max-[720px]:col-start-1 max-[720px]:row-start-2 max-[720px]:mt-0">
				<h4 className="text-lg font-semibold text-foreground">{title}</h4>
				<div className="mt-2 text-sm text-muted-foreground">{description}</div>
			</div>
			{accessory ? (
				<div className="mt-1 max-[720px]:col-start-3 max-[720px]:row-start-1 max-[720px]:mt-0">
					{accessory}
				</div>
			) : null}
		</div>
	);
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
	return (
		<OnboardingContent surface="transparent">
			<div className="flex flex-col items-center py-4 text-center">
				<div className="w-full">
					<AgentWelcomeHero variant="bot-only" />
				</div>
				<h1 className="mt-5 text-4xl font-semibold text-foreground">SynAI</h1>
				<p className="mt-2 text-lg text-foreground">Build software your way</p>
				<p className="mt-6 text-md text-muted-foreground">
					SynAI is an AI coding agent. It reads your code, edits files, runs
					commands, and works through tasks with you — in any project on your
					machine.
				</p>
				<Button
					className="mt-8 w-full max-w-64"
					onClick={onContinue}
					size="lg"
					tone="accent"
					type="button"
					variant="fill"
				>
					Get started
				</Button>
				<p className="mt-8 text-xs text-muted-foreground">
					Takes less than a minute. Everything can be changed later in Settings.
				</p>
			</div>
		</OnboardingContent>
	);
}

function ConnectStep({
	onBack,
	onConnected,
	onSkip,
}: {
	onBack: () => void;
	onConnected: (connection: OnboardingConnection) => void;
	onSkip: () => void;
}) {
	const [providers, setProviders] = useState<Provider[]>([]);
	const [providersLoading, setProvidersLoading] = useState(true);
	const [providersError, setProvidersError] = useState<string | null>(null);
	const [selectedProviderId, setSelectedProviderId] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		async function loadProviders() {
			try {
				const payload = await fetchProviderCatalog();
				if (cancelled) {
					return;
				}
				const sorted = sortProvidersForApiKeySetup(payload.providers ?? []);
				setProviders(sorted);
				if (sorted.length > 0 && !selectedProviderId) {
					setSelectedProviderId(sorted[0].id);
				}
				setProvidersError(null);
			} catch (error) {
				if (cancelled) {
					return;
				}
				setProvidersError(getErrorMessage(error));
			} finally {
				if (!cancelled) {
					setProvidersLoading(false);
				}
			}
		}
		void loadProviders();
		return () => {
			cancelled = true;
		};
	}, [selectedProviderId]);

	const selectedProvider =
		providers.find((provider) => provider.id === selectedProviderId) ?? null;
	const selectedProviderKeyUrl = selectedProvider
		? getProviderApiKeyUrl(selectedProvider)
		: null;

	const connectProvider = useCallback(async () => {
		if (!selectedProvider || !apiKey.trim()) {
			return;
		}
		setSaving(true);
		setSaveError(null);
		try {
			await desktopClient.invoke("save_provider_settings", {
				provider: selectedProvider.id,
				enabled: true,
				api_key: apiKey.trim(),
			});
			rememberProviderSelection({
				id: selectedProviderId,
				defaultModelId: selectedProvider.defaultModelId,
			});
			onConnected({
				kind: "provider",
				providerName: selectedProvider.name,
			});
		} catch (error) {
			setSaveError(getErrorMessage(error));
		} finally {
			invalidateProviderCatalogCache();
			setSaving(false);
		}
	}, [apiKey, onConnected, selectedProvider, selectedProviderId]);

	return (
		<OnboardingContent surface="panel">
			<div className="flex flex-col">
				<IconButton
					aria-label="Back"
					className="-ml-2"
					onClick={onBack}
					size="md"
					tone="neutral"
					type="button"
					variant="ghost"
				>
					<ArrowLeft className="size-4" />
				</IconButton>
				<h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
					Set up SynAI
				</h1>
				<p className="mt-4 text-sm text-muted-foreground">
					Choose how SynAI connects to models. You can add more providers
					anytime in Settings.
				</p>
			</div>

			<div className="mt-8 flex flex-col gap-3">
				<SetupOptionCard
					id="api-key"
					onSelect={() => {}}
					selectLabel="Use your own API key"
					selected={true}
				>
					<SetupOptionHeader
						description="Connect with OpenRouter, Anthropic, OpenAI, Gemini, DeepSeek, and more."
						icon={<KeyRound className="size-4" />}
						title="Use your own API key"
					/>
					<div className="flex flex-col gap-3 pt-6" data-onboarding-api-key-form>
						{providersError ? (
							<p className="text-xs text-destructive" role="alert">
								Failed to load providers: {providersError}
							</p>
						) : (
							<Select
								disabled={saving}
								onValueChange={(value) => {
									setSelectedProviderId(value);
									setSaveError(null);
								}}
								value={selectedProviderId}
							>
								<SelectTrigger
									aria-label="Provider"
									className="w-full bg-background"
								>
									<SelectValue
										placeholder={
											providersLoading
												? "Loading providers..."
												: "Choose a provider"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{providers.map((provider) => (
										<SelectItem key={provider.id} value={provider.id}>
											{provider.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						<Input
							aria-label="API key"
							autoComplete="off"
							className="bg-background"
							disabled={saving}
							onChange={(event) => {
								setApiKey(event.target.value);
								setSaveError(null);
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter" && selectedProvider && apiKey.trim() && !saving) {
									void connectProvider();
								}
							}}
							placeholder={
								selectedProvider
									? `${selectedProvider.name} API key`
									: "API key"
							}
							type="password"
							value={apiKey}
						/>
						<div className="flex flex-wrap items-center justify-end gap-2">
							{selectedProvider && selectedProviderKeyUrl ? (
								<Button
									className="mr-auto"
									disabled={saving}
									onClick={() => void openExternalUrl(selectedProviderKeyUrl)}
									size="xs"
									tone="neutral"
									type="button"
									variant="ghost"
								>
									{selectedProvider.docLabel ||
										`Get a ${selectedProvider.name} API key`}
									<ExternalLink className="size-3.5" />
								</Button>
							) : null}
							<Button
								disabled={!selectedProvider || !apiKey.trim() || saving}
								onClick={() => void connectProvider()}
								size="md"
								tone="accent"
								type="button"
								variant="fill"
							>
								{saving ? <Loader2 className="size-4 animate-spin" /> : null}
								{saving ? "Connecting..." : "Connect"}
							</Button>
						</div>
						{saveError ? (
							<p className="text-xs text-destructive" role="alert">
								Failed to save provider: {saveError}
							</p>
						) : null}
					</div>
				</SetupOptionCard>
			</div>

			<div className="mt-5 flex justify-center">
				<Button
					onClick={onSkip}
					size="sm"
					tone="neutral"
					type="button"
					variant="ghost"
				>
					Skip
				</Button>
			</div>
		</OnboardingContent>
	);
}

/**
 * Offers to bring session history over from other coding tools.
 */
function ImportHistoryStep({
	onContinue,
	onFinish,
}: {
	onContinue: () => void;
	onFinish: () => void;
}) {
	const [found, setFound] = useState<{
		count: number;
		tools: SessionImportTool[];
	} | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [imported, setImported] = useState(false);

	const skipRef = useRef(onContinue);
	useEffect(() => {
		skipRef.current = onContinue;
	});

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const response =
					await desktopClient.invoke<ListImportableSessionsResponse>(
						"list_importable_sessions",
						{},
						{ timeoutMs: 120_000 },
					);
				if (cancelled) return;
				const sessions = (response.sessions ?? []).filter(
					(session) => !session.alreadyImportedSessionId,
				);
				if (sessions.length === 0) {
					skipRef.current();
					return;
				}
				const tools = SESSION_IMPORT_TOOL_ORDER.filter((tool) =>
					sessions.some((session) => session.tool === tool),
				);
				setFound({ count: sessions.length, tools });
			} catch {
				if (!cancelled) skipRef.current();
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	if (!found) {
		return (
			<OnboardingContent surface="transparent">
				<div className="flex flex-col items-center py-10 text-center">
					<Loader2
						aria-hidden="true"
						className="size-6 animate-spin text-muted-foreground"
					/>
					<p className="mt-4 text-md text-muted-foreground">
						Checking for session history from other tools…
					</p>
					<Button
						className="mt-8"
						onClick={onContinue}
						size="sm"
						type="button"
						variant="ghost"
					>
						Skip
					</Button>
				</div>
			</OnboardingContent>
		);
	}

	const toolList = found.tools
		.map((tool) => SESSION_IMPORT_TOOL_LABELS[tool])
		.join(found.tools.length === 2 ? " and " : ", ");

	return (
		<OnboardingContent surface="transparent">
			<div className="flex flex-col items-center py-4 text-center">
				<Import aria-hidden="true" className="size-10 text-primary" />
				<h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
					Bring your history with you
				</h1>
				<p className="mt-3 text-md text-muted-foreground">
					{imported
						? "Your sessions are in SynAI's history now. You can import more anytime from the Sessions page."
						: `SynAI found ${found.count} session${found.count === 1 ? "" : "s"} from ${toolList} on this machine. Import them to keep your past conversations — and continue them here.`}
				</p>
				{imported ? (
					<Button
						className="mt-8 w-full max-w-64"
						onClick={onFinish}
						size="lg"
						tone="accent"
						type="button"
						variant="fill"
					>
						Start building
					</Button>
				) : (
					<>
						<Button
							className="mt-8 w-full max-w-64"
							onClick={() => setDialogOpen(true)}
							size="lg"
							tone="accent"
							type="button"
							variant="fill"
						>
							Choose sessions to import
						</Button>
						<Button
							className="mt-3"
							onClick={onContinue}
							size="sm"
							type="button"
							variant="ghost"
						>
							Skip for now
						</Button>
					</>
				)}
				<ImportSessionsDialog
					onImported={() => setImported(true)}
					onOpenChange={setDialogOpen}
					open={dialogOpen}
				/>
			</div>
		</OnboardingContent>
	);
}

function DoneStep({
	connection,
	onFinish,
}: {
	connection: OnboardingConnection | null;
	onFinish: () => void;
}) {
	return (
		<OnboardingContent surface="transparent">
			<div className="flex flex-col items-center py-4 text-center">
				<CheckCircle2 aria-hidden="true" className="size-10 text-primary" />
				<h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
					You&apos;re all set
				</h1>
				<p className="mt-3 text-md text-muted-foreground">
					{connection?.providerName
						? `${connection.providerName} is connected.`
						: "Your provider is connected."}
				</p>
				<Button
					className="mt-8 w-full max-w-64"
					onClick={onFinish}
					size="lg"
					tone="accent"
					type="button"
					variant="fill"
				>
					Start building
				</Button>
			</div>
		</OnboardingContent>
	);
}

export function OnboardingView({
	onComplete,
	initialStep = "welcome",
}: {
	onComplete: () => void;
	initialStep?: OnboardingStep;
}) {
	const [step, setStep] = useState<OnboardingStep>(initialStep);
	const [connection, setConnection] = useState<OnboardingConnection | null>(
		null,
	);

	return (
		<div className="relative h-full w-full overflow-y-auto bg-background">
			<div className="relative flex min-h-full w-full items-center justify-center overflow-hidden p-6">
				<div
					className={
						step === "done"
							? "pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2"
							: "pointer-events-none absolute inset-0"
					}
					data-onboarding-grid={step}
				>
					<AgentWelcomeHero
						interactive={step !== "done"}
						layout={step === "done" ? "wide-grid" : "full-bleed"}
						variant="grid-only"
					/>
				</div>
				{step === "welcome" ? (
					<WelcomeStep onContinue={() => setStep("connect")} />
				) : step === "connect" ? (
					<ConnectStep
						onBack={() => setStep("welcome")}
						onConnected={(nextConnection) => {
							setConnection(nextConnection);
							setStep("import");
						}}
						onSkip={onComplete}
					/>
				) : step === "import" ? (
					<ImportHistoryStep
						onContinue={() => setStep("done")}
						onFinish={onComplete}
					/>
				) : (
					<DoneStep connection={connection} onFinish={onComplete} />
				)}
			</div>
		</div>
	);
}
