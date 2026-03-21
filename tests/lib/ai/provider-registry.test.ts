import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
	createProviderRegistry: vi.fn().mockReturnValue({ languageModel: vi.fn() }),
}));

vi.mock("@ai-sdk/anthropic", () => ({
	createAnthropic: vi.fn().mockReturnValue({}),
}));

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: vi.fn().mockReturnValue({}),
}));

vi.mock("@ai-sdk/google", () => ({
	createGoogleGenerativeAI: vi.fn().mockReturnValue({}),
}));

vi.mock("@openrouter/ai-sdk-provider", () => ({
	createOpenRouter: vi.fn().mockReturnValue({}),
}));

import { createProviderRegistry } from "ai";
import { createKovaRegistry } from "../../../src/lib/ai/provider-registry.js";

describe("createKovaRegistry", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns null when no credentials are provided", async () => {
		const result = await createKovaRegistry({});
		expect(result).toBeNull();
		expect(createProviderRegistry).not.toHaveBeenCalled();
	});

	it("returns null for empty credential values", async () => {
		const result = await createKovaRegistry({
			anthropic: undefined,
			openai: undefined,
		});
		expect(result).toBeNull();
	});

	it("creates registry with anthropic credentials", async () => {
		const result = await createKovaRegistry({ anthropic: "sk-ant-test" });
		expect(result).not.toBeNull();
		expect(createProviderRegistry).toHaveBeenCalledTimes(1);
		const call = vi.mocked(createProviderRegistry).mock.calls[0]![0] as Record<
			string,
			unknown
		>;
		expect(call).toHaveProperty("anthropic");
	});

	it("creates registry with openai credentials", async () => {
		const result = await createKovaRegistry({ openai: "sk-openai-test" });
		expect(result).not.toBeNull();
		expect(createProviderRegistry).toHaveBeenCalledTimes(1);
	});

	it("creates registry with google credentials", async () => {
		const result = await createKovaRegistry({ google: "AIza-test" });
		expect(result).not.toBeNull();
	});

	it("creates registry with openrouter credentials", async () => {
		const result = await createKovaRegistry({
			openrouter: "sk-or-test",
		});
		expect(result).not.toBeNull();
	});

	it("creates registry with multiple providers", async () => {
		const result = await createKovaRegistry({
			anthropic: "sk-ant-test",
			openai: "sk-openai-test",
			google: "AIza-test",
		});
		expect(result).not.toBeNull();
		expect(createProviderRegistry).toHaveBeenCalledTimes(1);
		const call = vi.mocked(createProviderRegistry).mock.calls[0]![0] as Record<
			string,
			unknown
		>;
		expect(Object.keys(call)).toHaveLength(3);
	});
});
