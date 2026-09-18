import { test, expect } from "@playwright/test";
import { ClaudeProvider } from "../../lib/claude-provider.js";

async function withKey(fn) {
  const saved = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = saved;
  }
}

test("throws without an API key", () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    expect(() => new ClaudeProvider()).toThrow(/ANTHROPIC_API_KEY not set/);
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

test("defaults to claude-haiku-4-5 when no model is given", async () => {
  await withKey(() => {
    const provider = new ClaudeProvider();
    expect(provider.model).toBe("claude-haiku-4-5");
    expect(provider.name).toBe("Claude (claude-haiku-4-5)");
  });
});

test("run() returns text and token totals on a plain text reply", async () => {
  await withKey(async () => {
    const provider = new ClaudeProvider("claude-sonnet-4-6");
    provider.client.messages.create = async () => ({
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
      content: [{ type: "text", text: "done" }],
    });

    const result = await provider.run({
      systemPrompt: "sys",
      userGoal: "goal",
      mcpClient: { listTools: async () => ({ tools: [] }) },
      maxIterations: 5,
    });

    expect(result).toEqual({ text: "done", inputTokens: 10, outputTokens: 5 });
  });
});

test("run() executes a tool call before finishing", async () => {
  await withKey(async () => {
    const provider = new ClaudeProvider();
    let call = 0;
    provider.client.messages.create = async () => {
      call++;
      if (call === 1) {
        return {
          stop_reason: "tool_use",
          usage: { input_tokens: 1, output_tokens: 1 },
          content: [{ type: "tool_use", id: "t1", name: "browser_click", input: {} }],
        };
      }
      return {
        stop_reason: "end_turn",
        usage: { input_tokens: 2, output_tokens: 2 },
        content: [{ type: "text", text: "finished" }],
      };
    };

    const calledTools = [];
    const mcpClient = {
      listTools: async () => ({ tools: [] }),
      callTool: async ({ name }) => {
        calledTools.push(name);
        return { content: "ok" };
      },
    };

    const result = await provider.run({
      systemPrompt: "sys",
      userGoal: "goal",
      mcpClient,
      maxIterations: 5,
      onToolCall: (name) => calledTools.push(`callback:${name}`),
    });

    expect(calledTools).toEqual(["callback:browser_click", "browser_click"]);
    expect(result.text).toBe("finished");
    expect(result.inputTokens).toBe(3);
    expect(result.outputTokens).toBe(3);
  });
});

test("run() throws after exceeding maxIterations", async () => {
  await withKey(async () => {
    const provider = new ClaudeProvider();
    provider.client.messages.create = async () => ({
      stop_reason: "tool_use",
      usage: { input_tokens: 1, output_tokens: 1 },
      content: [{ type: "tool_use", id: "t1", name: "noop", input: {} }],
    });

    const mcpClient = {
      listTools: async () => ({ tools: [] }),
      callTool: async () => ({ content: "ok" }),
    };

    await expect(
      provider.run({ systemPrompt: "sys", userGoal: "goal", mcpClient, maxIterations: 2 })
    ).rejects.toThrow(/exceeded 2 iterations/);
  });
});
