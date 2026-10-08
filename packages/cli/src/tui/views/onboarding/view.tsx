import type { ProviderSettingsManager } from "@synai/core";
import { useTerminalDimensions } from "@opentui/react";
import { useMouseTracker } from "../../components/tracked-robot";
import { HOME_VIEW_MAX_WIDTH } from "../../types";
import { useOnboardingController } from "./controller";
import { getOAuthProviderLabel, type OnboardingResult } from "./model";
import {
	OnboardingSynaiModelScreen,
	OnboardingSynaiPassSubscriptionScreen,
	OnboardingCustomModelIdScreen,
	OnboardingDeviceCodeScreen,
	OnboardingDoneScreen,
	OnboardingLocalCliScreen,
	OnboardingMainMenuScreen,
	OnboardingModelPickerScreen,
	OnboardingOAuthPendingScreen,
	OnboardingProviderConfigScreen,
	OnboardingProviderPickerScreen,
	OnboardingThinkingLevelScreen,
} from "./screens";

export interface OnboardingViewProps {
	onComplete: (result: OnboardingResult) => void;
	onExit: () => void;
	providerSettingsManager?: ProviderSettingsManager;
}

export function OnboardingView(props: OnboardingViewProps) {
	const { width, height } = useTerminalDimensions();
	const mouse = useMouseTracker();
	const state = useOnboardingController(props);
	const contentWidth = Math.min(width - 4, HOME_VIEW_MAX_WIDTH);
	const compact = height < 28;

	if (state.step === "done") {
		return <OnboardingDoneScreen mouse={mouse} />;
	}

	if (state.step === "oauth_pending") {
		return (
			<OnboardingOAuthPendingScreen
				authError={state.authError}
				authStatus={state.authStatus}
				authUrl={state.authUrl}
				compact={compact}
				contentWidth={contentWidth}
				label={getOAuthProviderLabel(state.oauthProvider)}
				mouse={mouse}
				oauthProvider={state.oauthProvider}
			/>
		);
	}

	if (state.step === "device_code") {
		return (
			<OnboardingDeviceCodeScreen
				compact={compact}
				contentWidth={contentWidth}
				deviceError={state.deviceError}
				deviceStatus={state.deviceStatus}
				deviceUserCode={state.deviceUserCode}
				deviceVerifyUrl={state.deviceVerifyUrl}
				label={getOAuthProviderLabel(state.oauthProvider)}
				mouse={mouse}
			/>
		);
	}

	if (state.step === "byo_apikey") {
		return (
			<OnboardingProviderConfigScreen
				activeProviderName={state.activeProviderName}
				compact={compact}
				contentWidth={contentWidth}
				description={state.byoDescription}
				fields={state.byoFields}
				focusedField={state.byoFocusedField}
				mouse={mouse}
				values={state.byoValues}
				onFieldInput={state.handleByoFieldInput}
				onSubmit={state.saveByoConfig}
			/>
		);
	}

	if (state.step === "local_cli_setup" && state.localCli) {
		return (
			<OnboardingLocalCliScreen
				activeProviderName={state.activeProviderName}
				checking={state.localCliChecking}
				cli={state.localCli}
				compact={compact}
				contentWidth={contentWidth}
				mouse={mouse}
				status={state.localCliStatus}
			/>
		);
	}

	if (state.step === "byo_provider") {
		return (
			<OnboardingProviderPickerScreen
				compact={compact}
				contentWidth={contentWidth}
				mouse={mouse}
				providerList={state.providerList}
				providersLoading={state.providersLoading}
			/>
		);
	}

	if (state.step === "synai_model") {
		return (
			<OnboardingSynaiModelScreen
				synaiEntries={state.synaiEntries}
				synaiModelSelected={state.synaiModelSelected}
				compact={compact}
				contentWidth={contentWidth}
				mouse={mouse}
				recommendedLoading={state.recommendedLoading}
			/>
		);
	}

	if (state.step === "synai_pass_subscription") {
		return (
			<OnboardingSynaiPassSubscriptionScreen
				compact={compact}
				contentWidth={contentWidth}
				currentPlanName={state.synaiPassCurrentPlanName}
				error={state.synaiPassSubscriptionError}
				mouse={mouse}
				openStatus={state.synaiPassSubscriptionOpenStatus}
				options={state.synaiPassSubscriptionOptions}
				planFeatures={state.synaiPassPlanFeatures}
				selected={state.synaiPassSubscriptionSelected}
				status={state.synaiPassSubscriptionStatus}
				subscriptionUrl={state.synaiPassSubscriptionUrl}
			/>
		);
	}

	if (state.step === "model_picker") {
		return (
			<OnboardingModelPickerScreen
				activeProviderName={state.activeProviderName}
				compact={compact}
				contentWidth={contentWidth}
				modelList={state.modelList}
				modelsLoading={state.modelsLoading}
				mouse={mouse}
				onModelItemSelect={state.handleModelItemSelect}
			/>
		);
	}

	if (state.step === "custom_model_id") {
		return (
			<OnboardingCustomModelIdScreen
				activeProviderName={state.activeProviderName}
				compact={compact}
				contentWidth={contentWidth}
				error={state.customModelError}
				mouse={mouse}
				onInput={state.handleCustomModelIdInput}
				onSubmit={state.saveCustomModelId}
				title={state.customModelTitle}
				value={state.customModelId}
			/>
		);
	}

	if (state.step === "thinking_level") {
		return (
			<OnboardingThinkingLevelScreen
				compact={compact}
				contentWidth={contentWidth}
				mouse={mouse}
				selectedModelName={state.selectedModelName}
				thinkingSelected={state.thinkingSelected}
			/>
		);
	}

	return (
		<OnboardingMainMenuScreen
			contentWidth={contentWidth}
			menuOptions={state.menuOptions}
			menuSelected={state.menuSelected}
			mouse={mouse}
			onSelect={state.handleMenuSelect}
		/>
	);
}
