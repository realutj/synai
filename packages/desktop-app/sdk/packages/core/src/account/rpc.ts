import type {
	SynAIAccountActionRequest,
	ProviderActionRequest,
} from "@synai/shared";
import type {
	SynAIAccountBalance,
	SynAIAccountOrganization,
	SynAIAccountOrganizationBalance,
	SynAIAccountOrganizationUsageTransaction,
	SynAIAccountPaymentTransaction,
	SynAIAccountUsageTransaction,
	SynAIAccountUser,
	FeaturebaseTokenResponse,
} from "./types";

export interface SynAIAccountOperations {
	fetchMe(): Promise<SynAIAccountUser>;
	fetchBalance(userId?: string): Promise<SynAIAccountBalance>;
	fetchUsageTransactions(
		userId?: string,
	): Promise<SynAIAccountUsageTransaction[]>;
	fetchPaymentTransactions(
		userId?: string,
	): Promise<SynAIAccountPaymentTransaction[]>;
	fetchUserOrganizations(): Promise<SynAIAccountOrganization[]>;
	fetchOrganizationBalance(
		organizationId: string,
	): Promise<SynAIAccountOrganizationBalance>;
	fetchOrganizationUsageTransactions(input: {
		organizationId: string;
		memberId?: string;
	}): Promise<SynAIAccountOrganizationUsageTransaction[]>;
	switchAccount(organizationId?: string | null): Promise<void>;
	fetchFeaturebaseToken?(): Promise<FeaturebaseTokenResponse | undefined>;
}

export function isSynAIAccountActionRequest(
	request: ProviderActionRequest,
): request is SynAIAccountActionRequest {
	return request.action === "synaiAccount";
}

export async function executeSynAIAccountAction(
	request: SynAIAccountActionRequest,
	service: SynAIAccountOperations,
): Promise<unknown> {
	switch (request.operation) {
		case "fetchMe":
			return service.fetchMe();
		case "fetchBalance":
			return service.fetchBalance(request.userId);
		case "fetchUsageTransactions":
			return service.fetchUsageTransactions(request.userId);
		case "fetchPaymentTransactions":
			return service.fetchPaymentTransactions(request.userId);
		case "fetchUserOrganizations":
			return service.fetchUserOrganizations();
		case "fetchOrganizationBalance":
			return service.fetchOrganizationBalance(request.organizationId);
		case "fetchOrganizationUsageTransactions":
			return service.fetchOrganizationUsageTransactions({
				organizationId: request.organizationId,
				memberId: request.memberId,
			});
		case "switchAccount":
			await service.switchAccount(request.organizationId);
			return { updated: true };
		case "fetchFeaturebaseToken":
			return service.fetchFeaturebaseToken?.();
		default: {
			const exhaustive: never = request;
			throw new Error(
				`Unsupported SynAI account operation: ${String(exhaustive)}`,
			);
		}
	}
}

export interface ProviderActionExecutor {
	runProviderAction(request: ProviderActionRequest): Promise<{
		result: unknown;
	}>;
}

export class RpcSynAIAccountService implements SynAIAccountOperations {
	private readonly executor: ProviderActionExecutor;

	constructor(executor: ProviderActionExecutor) {
		this.executor = executor;
	}

	public async fetchMe(): Promise<SynAIAccountUser> {
		return this.request<SynAIAccountUser>({
			action: "synaiAccount",
			operation: "fetchMe",
		});
	}

	public async fetchBalance(userId?: string): Promise<SynAIAccountBalance> {
		return this.request<SynAIAccountBalance>({
			action: "synaiAccount",
			operation: "fetchBalance",
			...(userId?.trim() ? { userId: userId.trim() } : {}),
		});
	}

	public async fetchUsageTransactions(
		userId?: string,
	): Promise<SynAIAccountUsageTransaction[]> {
		return this.request<SynAIAccountUsageTransaction[]>({
			action: "synaiAccount",
			operation: "fetchUsageTransactions",
			...(userId?.trim() ? { userId: userId.trim() } : {}),
		});
	}

	public async fetchPaymentTransactions(
		userId?: string,
	): Promise<SynAIAccountPaymentTransaction[]> {
		return this.request<SynAIAccountPaymentTransaction[]>({
			action: "synaiAccount",
			operation: "fetchPaymentTransactions",
			...(userId?.trim() ? { userId: userId.trim() } : {}),
		});
	}

	public async fetchUserOrganizations(): Promise<SynAIAccountOrganization[]> {
		return this.request<SynAIAccountOrganization[]>({
			action: "synaiAccount",
			operation: "fetchUserOrganizations",
		});
	}

	public async fetchOrganizationBalance(
		organizationId: string,
	): Promise<SynAIAccountOrganizationBalance> {
		const orgId = organizationId.trim();
		if (!orgId) {
			throw new Error("organizationId is required");
		}
		return this.request<SynAIAccountOrganizationBalance>({
			action: "synaiAccount",
			operation: "fetchOrganizationBalance",
			organizationId: orgId,
		});
	}

	public async fetchOrganizationUsageTransactions(input: {
		organizationId: string;
		memberId?: string;
	}): Promise<SynAIAccountOrganizationUsageTransaction[]> {
		const orgId = input.organizationId.trim();
		if (!orgId) {
			throw new Error("organizationId is required");
		}
		return this.request<SynAIAccountOrganizationUsageTransaction[]>({
			action: "synaiAccount",
			operation: "fetchOrganizationUsageTransactions",
			organizationId: orgId,
			...(input.memberId?.trim() ? { memberId: input.memberId.trim() } : {}),
		});
	}

	public async switchAccount(organizationId?: string | null): Promise<void> {
		await this.request<{ updated: boolean }>({
			action: "synaiAccount",
			operation: "switchAccount",
			organizationId: organizationId?.trim() || null,
		});
	}

	public async fetchFeaturebaseToken(): Promise<
		FeaturebaseTokenResponse | undefined
	> {
		return this.request<FeaturebaseTokenResponse | undefined>({
			action: "synaiAccount",
			operation: "fetchFeaturebaseToken",
		});
	}

	private async request<T>(request: SynAIAccountActionRequest): Promise<T> {
		const response = await this.executor.runProviderAction(request);
		return response.result as T;
	}
}
