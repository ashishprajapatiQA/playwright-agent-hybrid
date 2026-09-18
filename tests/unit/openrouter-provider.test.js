import { test, expect } from "@playwright/test";
import { OpenRouterProvider } from "../../lib/openrouter-provider.js";

async function withKey(fn) {
  const saved = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = saved;
  }
}

const fakeMcpClient = {
  listTools: async () => ({ tools: [] }),
  callTool: async () => ({ content: "ok" }),
};

test("throws without an API key", () => {
  const saved = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    expect(() => new OpenRouterProvider()).toThrow(/OPENROUTER_API_KEY not set/);
  } finally {
    if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
  }
});

test("defaults to the llama model when none is given", async () => {
  await withKey(() => {
    const provider = new OpenRouterProvider();
    expect(provider.model).toBe("meta-llama/llama-3.3-70b-instruct");
    expect(provider.name).toBe("OpenRouter (meta-llama/llama-3.3-70b-instruct)");
  });
});

test("run() returns content on a stop finish reason", async () => {
  await withKey(async () => {
    const provider = new OpenRouterProvider("deepseek/deepseek-chat");
    provider.client.chat.completions.create = async () => ({
      usage: { prompt_tokens: 4, completion_tokens: 6 },
      choices: [{ finish_reason: "stop", message: { role: "assistant", content: "hello" } }],
    });

    const result = await provider.run({
      systemPrompt: "sys",
      userGoal: "goal",
      mcpClient: fakeMcpClient,
      maxIterations: 5,
    });

    expect(result).toEqual({ text: "hello", inputTokens: 4, outputTokens: 6 });
  });
});

test("run() executes tool calls before finishing", async () => {
  await withKey(async () => {
    const provider = new OpenRouterProvider();
    let call = 0;
    provider.client.chat.completions.create = async () => {
      call++;
      if (call === 1) {
        return {
          usage: { prompt_tokens: 1, completion_tokens: 1 },
          choices: [{
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{ id: "c1", function: { name: "browser_click", arguments: "{}" } }],
            },
          }],
        };
      }
      return {
        usage: { prompt_tokens: 2, completion_tokens: 2 },
        choices: [{ finish_reason: "stop", message: { role: "assistant", content: "done" } }],
      };
    };

    const calledTools = [];
    const result = await provider.run({
      systemPrompt: "sys",
      userGoal: "goal",
      mcpClient: {
        listTools: async () => ({ tools: [] }),
        callTool: async ({ name }) => {
          calledTools.push(name);
          return { content: "ok" };
        },
      },
      maxIterations: 5,
      onToolCall: (name) => calledTools.push(`callback:${name}`),
    });

    expect(calledTools).toEqual(["callback:browser_click", "browser_click"]);
    expect(result.text).toBe("done");
    expect(result.inputTokens).toBe(3);
    expect(result.outputTokens).toBe(3);
  });
});

test("run() throws after exceeding maxIterations", async () => {
  await withKey(async () => {
    const provider = new OpenRouterProvider();
    provider.client.chat.completions.create = async () => ({
      usage: { prompt_tokens: 1, completion_tokens: 1 },
      choices: [{
        finish_reason: "tool_calls",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "c1", function: { name: "noop", arguments: "{}" } }],
        },
      }],
    });

    await expect(
      provider.run({ systemPrompt: "sys", userGoal: "goal", mcpClient: fakeMcpClient, maxIterations: 2 })
    ).rejects.toThrow(/exceeded 2 iterations/);
  });
});
