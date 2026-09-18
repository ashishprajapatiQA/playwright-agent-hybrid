import { test, expect } from "@playwright/test";
import { listPresets, createProvider, createAutoProvider } from "../../lib/provider-factory.js";

const ENV_KEYS = ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"];

function withEnv(overrides, fn) {
  const saved = {};
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, overrides);
  try {
    return fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test.describe("listPresets", () => {
  test("returns all known preset names", () => {
    const presets = listPresets();
    expect(presets).toContain("gemini-flash");
    expect(presets).toContain("claude-opus");
    expect(presets).toContain("openrouter-llama");
    expect(presets).toContain("cheap");
    expect(presets).toContain("smart");
    expect(presets).toContain("best");
  });
});

test.describe("createProvider", () => {
  test("resolves a known preset to the right provider and model", () => {
    withEnv({ ANTHROPIC_API_KEY: "test-key" }, () => {
      const provider = createProvider("claude-opus");
      expect(provider.model).toBe("claude-opus-4-7");
      expect(provider.name).toContain("Claude");
    });
  });

  test("infers a Gemini provider from a raw model name", () => {
    withEnv({ GEMINI_API_KEY: "test-key" }, () => {
      const provider = createProvider("gemini-1.5-flash");
      expect(provider.model).toBe("gemini-1.5-flash");
      expect(provider.name).toContain("Gemini");
    });
  });

  test("infers an OpenRouter provider from a model containing a slash", () => {
    withEnv({ OPENROUTER_API_KEY: "test-key" }, () => {
      const provider = createProvider("mistralai/mixtral-8x7b");
      expect(provider.model).toBe("mistralai/mixtral-8x7b");
      expect(provider.name).toContain("OpenRouter");
    });
  });

  test("throws for an unrecognized model/preset name", () => {
    withEnv({}, () => {
      expect(() => createProvider("not-a-real-model")).toThrow(/Unknown model\/preset/);
    });
  });

  test("throws when no API key is available and nothing is specified", () => {
    withEnv({}, () => {
      expect(() => createProvider()).toThrow(/No API key found/);
    });
  });

  test("auto-detects Gemini when only GEMINI_API_KEY is set", () => {
    withEnv({ GEMINI_API_KEY: "test-key" }, () => {
      const provider = createProvider();
      expect(provider.name).toContain("Gemini");
    });
  });
});

test.describe("createAutoProvider", () => {
  test("picks a smart model for a complex, multi-step goal", () => {
    withEnv({ ANTHROPIC_API_KEY: "test-key" }, () => {
      const provider = createAutoProvider(
        "First log in, then navigate to settings, then verify the profile, then log out"
      );
      expect(provider.model).toBe("claude-sonnet-4-6");
    });
  });

  test("picks a cheap model for a simple goal", () => {
    withEnv({ GEMINI_API_KEY: "test-key" }, () => {
      const provider = createAutoProvider("Go to example.com and check the title");
      expect(provider.model).toBe("gemini-2.5-flash");
    });
  });

  test("throws when no API key is available", () => {
    withEnv({}, () => {
      expect(() => createAutoProvider("simple goal")).toThrow(/No API key found/);
    });
  });
});
