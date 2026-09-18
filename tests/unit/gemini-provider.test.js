import { test, expect } from "@playwright/test";
import { GeminiProvider } from "../../lib/gemini-provider.js";

async function withKey(fn) {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = saved;
  }
}

const fakeMcpClient = { listTools: async () => ({ tools: [] }) };

test("throws without an API key", () => {
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    expect(() => new GeminiProvider()).toThrow(/GEMINI_API_KEY not set/);
  } finally {
    if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
  }
});

test("defaults to gemini-2.5-flash when no model is given", async () => {
  await withKey(() => {
    const provider = new GeminiProvider();
    expect(provider.model).toBe("gemini-2.5-flash");
    expect(provider.name).toBe("Gemini (gemini-2.5-flash)");
  });
});

test("run() returns text, usage, and reports tool calls", async () => {
  await withKey(async () => {
    const provider = new GeminiProvider("gemini-2.5-pro");
    const toolCalls = [];

    provider.ai.chats.create = () => ({
      sendMessage: async () => ({
        text: "the answer",
        usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 },
      }),
      getHistory: () => [
        { parts: [{ functionCall: { name: "browser_click" } }] },
        { parts: [{ text: "ok" }] },
      ],
    });

    const result = await provider.run({
      systemPrompt: "sys",
      userGoal: "goal",
      mcpClient: fakeMcpClient,
      maxIterations: 5,
      onToolCall: (name) => toolCalls.push(name),
    });

    expect(result).toEqual({ text: "the answer", inputTokens: 7, outputTokens: 3 });
    expect(toolCalls).toEqual(["browser_click"]);
  });
});

test("run() defaults token counts to 0 when usage metadata is missing", async () => {
  await withKey(async () => {
    const provider = new GeminiProvider();
    provider.ai.chats.create = () => ({
      sendMessage: async () => ({ text: "hi" }),
      getHistory: () => [],
    });

    const result = await provider.run({
      systemPrompt: "sys",
      userGoal: "goal",
      mcpClient: fakeMcpClient,
      maxIterations: 5,
    });

    expect(result).toEqual({ text: "hi", inputTokens: 0, outputTokens: 0 });
  });
});
