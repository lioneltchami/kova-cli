import { describe, expect, it } from "vitest";
import {
	generateBashCompletion,
	generateFishCompletion,
	generateZshCompletion,
	getCommandRegistry,
} from "../src/lib/completions.js";

describe("getCommandRegistry", () => {
	it("returns an array of 10 commands", () => {
		const registry = getCommandRegistry();
		expect(registry).toHaveLength(10);
	});

	it("each command has a name property", () => {
		const registry = getCommandRegistry();
		for (const cmd of registry) {
			expect(cmd).toHaveProperty("name");
			expect(typeof cmd.name).toBe("string");
		}
	});

	it("each command has a description property", () => {
		const registry = getCommandRegistry();
		for (const cmd of registry) {
			expect(cmd).toHaveProperty("description");
			expect(typeof cmd.description).toBe("string");
		}
	});

	it("each command has an options array", () => {
		const registry = getCommandRegistry();
		for (const cmd of registry) {
			expect(cmd).toHaveProperty("options");
			expect(Array.isArray(cmd.options)).toBe(true);
		}
	});

	const expectedCommands = [
		"init",
		"plan",
		"run",
		"build",
		"team-build",
		"status",
		"config",
		"update",
		"completions",
	];

	for (const cmdName of expectedCommands) {
		it(`includes the "${cmdName}" command`, () => {
			const registry = getCommandRegistry();
			const names = registry.map((c) => c.name);
			expect(names).toContain(cmdName);
		});
	}
});

describe("generateBashCompletion", () => {
	it("contains the _kova_completions function name", () => {
		expect(generateBashCompletion()).toContain("_kova_completions");
	});

	it("contains the complete -F directive", () => {
		expect(generateBashCompletion()).toContain("complete -F");
	});

	it("contains COMPREPLY", () => {
		expect(generateBashCompletion()).toContain("COMPREPLY");
	});

	const expectedCommands = [
		"init",
		"plan",
		"run",
		"build",
		"team-build",
		"status",
		"config",
		"update",
		"completions",
	];

	for (const cmdName of expectedCommands) {
		it(`contains command name "${cmdName}"`, () => {
			expect(generateBashCompletion()).toContain(cmdName);
		});
	}

	it("contains --resume flag", () => {
		expect(generateBashCompletion()).toContain("--resume");
	});
});

describe("generateZshCompletion", () => {
	it("contains #compdef kova at the top", () => {
		expect(generateZshCompletion()).toContain("#compdef kova");
	});

	it("contains _describe for command listing", () => {
		expect(generateZshCompletion()).toContain("_describe");
	});

	it("contains _arguments", () => {
		expect(generateZshCompletion()).toContain("_arguments");
	});

	const expectedCommands = [
		"init",
		"plan",
		"run",
		"build",
		"team-build",
		"status",
		"config",
		"update",
		"completions",
	];

	for (const cmdName of expectedCommands) {
		it(`contains command name "${cmdName}"`, () => {
			expect(generateZshCompletion()).toContain(cmdName);
		});
	}
});

describe("generateFishCompletion", () => {
	it("contains complete -c kova", () => {
		expect(generateFishCompletion()).toContain("complete -c kova");
	});

	it("contains __fish_use_subcommand", () => {
		expect(generateFishCompletion()).toContain("__fish_use_subcommand");
	});

	const expectedCommands = [
		"init",
		"plan",
		"run",
		"build",
		"team-build",
		"status",
		"config",
		"update",
		"completions",
	];

	for (const cmdName of expectedCommands) {
		it(`contains command name "${cmdName}"`, () => {
			expect(generateFishCompletion()).toContain(cmdName);
		});
	}

	it("contains template name 'feature'", () => {
		expect(generateFishCompletion()).toContain("feature");
	});

	it("contains template name 'bugfix'", () => {
		expect(generateFishCompletion()).toContain("bugfix");
	});

	it("contains template name 'refactor'", () => {
		expect(generateFishCompletion()).toContain("refactor");
	});
});
