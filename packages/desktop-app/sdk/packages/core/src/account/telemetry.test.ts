import { describe, expect, it, vi } from "vitest";
import {
	persistSynAIAccountTelemetryIdentity,
	resolveSynAIAccountTelemetryIdentity,
} from "./telemetry";
import type { SynAIAccountUser } from "./types";

function createUser(
	overrides: Partial<SynAIAccountUser> = {},
): SynAIAccountUser {
	return {
		id: "user-1",
		email: "user@example.com",
		displayName: "User",
		photoUrl: "",
		createdAt: "",
		updatedAt: "",
		organizations: [],
		...overrides,
	};
}

describe("SynAI account telemetry identity", () => {
	it("resolves the active organization", () => {
		const identity = resolveSynAIAccountTelemetryIdentity(
			createUser({
				organizations: [
					{
						active: true,
						memberId: "member-1",
						name: "Acme",
						organizationId: "org-1",
						roles: ["member"],
					},
				],
			}),
		);

		expect(identity).toEqual({
			id: "user-1",
			email: "user@example.com",
			provider: "synai",
			organizationId: "org-1",
			organizationName: "Acme",
			memberId: "member-1",
		});
	});

	it("persists organization context for detached runtimes", () => {
		const saveProviderSettings = vi.fn();
		const manager = {
			getProviderSettings: vi.fn(() => ({
				provider: "synai" as const,
				auth: { accountId: "user-1", accessToken: "secret" },
			})),
			saveProviderSettings,
		};
		const identity = resolveSynAIAccountTelemetryIdentity(
			createUser({
				organizations: [
					{
						active: true,
						memberId: "member-1",
						name: "Acme",
						organizationId: "org-1",
						roles: ["member"],
					},
				],
			}),
		);

		expect(persistSynAIAccountTelemetryIdentity(manager, identity)).toBe(true);
		expect(saveProviderSettings).toHaveBeenCalledWith(
			{
				provider: "synai",
				auth: {
					accountId: "user-1",
					accessToken: "secret",
					organizationId: "org-1",
					organizationName: "Acme",
					memberId: "member-1",
				},
			},
			{ setLastUsed: false },
		);
	});

	it("replaces stale persisted account identity after an account switch", () => {
		const saveProviderSettings = vi.fn();
		const manager = {
			getProviderSettings: vi.fn(() => ({
				provider: "synai" as const,
				auth: { accountId: "old-user", accessToken: "secret" },
			})),
			saveProviderSettings,
		};

		persistSynAIAccountTelemetryIdentity(manager, {
			id: "new-user",
			provider: "synai",
		});

		expect(saveProviderSettings).toHaveBeenCalledWith(
			expect.objectContaining({
				auth: expect.objectContaining({ accountId: "new-user" }),
			}),
			{ setLastUsed: false },
		);
	});
});
