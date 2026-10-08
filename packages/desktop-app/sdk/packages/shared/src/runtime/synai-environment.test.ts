import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	SYNAI_ENVIRONMENT_ENV,
	SYNAI_ENVIRONMENT_OVERRIDE_ENV,
	SYNAI_ENVIRONMENTS,
	DEFAULT_SYNAI_ENVIRONMENT,
	getSynAIEnvironmentConfig,
	resolveSynAIEnvironment,
} from "./synai-environment";

const ENV_KEYS = [
	SYNAI_ENVIRONMENT_ENV,
	SYNAI_ENVIRONMENT_OVERRIDE_ENV,
	"SYNAI_API_BASE_URL",
] as const;

const originalEnvValues = Object.fromEntries(
	ENV_KEYS.map((key) => [key, process.env[key]]),
);

beforeEach(() => {
	vi.unstubAllGlobals();
	for (const key of ENV_KEYS) {
		delete process.env[key];
	}
});

afterEach(() => {
	vi.unstubAllGlobals();
	for (const key of ENV_KEYS) {
		const value = originalEnvValues[key];
		if (typeof value === "string") {
			process.env[key] = value;
		} else {
			delete process.env[key];
		}
	}
});

describe("resolveSynAIEnvironment", () => {
	it("defaults to production when no env var is set", () => {
		expect(resolveSynAIEnvironment()).toBe(DEFAULT_SYNAI_ENVIRONMENT);
	});

	it("reads SYNAI_ENVIRONMENT from process.env", () => {
		process.env[SYNAI_ENVIRONMENT_ENV] = "staging";
		expect(resolveSynAIEnvironment()).toBe("staging");

		process.env[SYNAI_ENVIRONMENT_ENV] = "local";
		expect(resolveSynAIEnvironment()).toBe("local");
	});

	it("prefers SYNAI_ENVIRONMENT_OVERRIDE over SYNAI_ENVIRONMENT", () => {
		process.env[SYNAI_ENVIRONMENT_OVERRIDE_ENV] = "local";
		process.env[SYNAI_ENVIRONMENT_ENV] = "staging";

		expect(resolveSynAIEnvironment()).toBe("local");
	});

	it("normalizes case and surrounding whitespace", () => {
		process.env[SYNAI_ENVIRONMENT_ENV] = "  STAGING  ";

		expect(resolveSynAIEnvironment()).toBe("staging");
	});

	it("ignores unknown values and falls through to the next source", () => {
		process.env[SYNAI_ENVIRONMENT_OVERRIDE_ENV] = "qa";
		process.env[SYNAI_ENVIRONMENT_ENV] = "staging";
		expect(resolveSynAIEnvironment()).toBe("staging");

		delete process.env[SYNAI_ENVIRONMENT_OVERRIDE_ENV];
		process.env[SYNAI_ENVIRONMENT_ENV] = "qa";
		expect(resolveSynAIEnvironment()).toBe(DEFAULT_SYNAI_ENVIRONMENT);
	});

	it("defaults to production when process is unavailable", () => {
		vi.stubGlobal("process", undefined);

		expect(resolveSynAIEnvironment()).toBe(DEFAULT_SYNAI_ENVIRONMENT);
	});
});

describe("getSynAIEnvironmentConfig", () => {
	it("returns the config for an explicit environment", () => {
		expect(getSynAIEnvironmentConfig("staging")).toBe(
			SYNAI_ENVIRONMENTS.staging,
		);
		expect(getSynAIEnvironmentConfig("local")).toBe(SYNAI_ENVIRONMENTS.local);
		expect(getSynAIEnvironmentConfig("production")).toBe(
			SYNAI_ENVIRONMENTS.production,
		);
	});

	it("falls back to production by default", () => {
		expect(getSynAIEnvironmentConfig()).toBe(SYNAI_ENVIRONMENTS.production);
	});

	it("uses the resolved process.env environment when no explicit environment is provided", () => {
		process.env[SYNAI_ENVIRONMENT_ENV] = "staging";

		expect(getSynAIEnvironmentConfig()).toBe(SYNAI_ENVIRONMENTS.staging);
	});

	it("applies SYNAI_API_BASE_URL without mutating the catalog config", () => {
		process.env.SYNAI_API_BASE_URL = "http://127.0.0.1:3000";

		expect(getSynAIEnvironmentConfig("local")).toEqual({
			...SYNAI_ENVIRONMENTS.local,
			apiBaseUrl: "http://127.0.0.1:3000",
			mcpBaseUrl: "http://127.0.0.1:3000/v1/mcp",
		});
		expect(SYNAI_ENVIRONMENTS.local.apiBaseUrl).toBe("http://localhost:7777");
	});

	it("defaults to production when process is unavailable", () => {
		vi.stubGlobal("process", undefined);

		expect(getSynAIEnvironmentConfig()).toBe(SYNAI_ENVIRONMENTS.production);
	});
});

describe("SYNAI_ENVIRONMENTS catalog", () => {
	it("exposes an environment field that matches its key", () => {
		for (const [key, config] of Object.entries(SYNAI_ENVIRONMENTS)) {
			expect(config.environment).toBe(key);
		}
	});

	it("populates appBaseUrl, apiBaseUrl, and mcpBaseUrl for every environment", () => {
		for (const config of Object.values(SYNAI_ENVIRONMENTS)) {
			expect(config.appBaseUrl).toMatch(/^https?:\/\//);
			expect(config.apiBaseUrl).toMatch(/^https?:\/\//);
			expect(config.mcpBaseUrl).toMatch(/^https?:\/\//);
		}
	});
});
