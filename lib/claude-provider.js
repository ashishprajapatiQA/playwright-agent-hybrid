// lib/claude-provider.js
// Wraps Anthropic Claude in a unified interface (manual MCP loop)

import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-haiku-4-5";

export class ClaudeProvider {
  constructor(model) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not set. Get one at https://console.anthropic.com");
    }
    this.client = new Anthropic();
    this.model = model || DEFAULT_MODEL;
    this.name = `Claude (${this.model})`;
  }

  async run({ systemPrompt, userGoal, mcpClient, maxIterations, onToolCall }) {
    // Get tools from MCP and convert to Claude's format
    const { tools: mcpTools } = await mcpClient.listTools();
    const claudeTools = mcpTools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));

    const messages = [{ role: "user", content: userGoal }];
    let totalInput = 0;
    let totalOutput = 0;
    let iterations = 0;

    while (iterations++ < maxIterations) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: claudeTools,
        messages,
      });

      totalInput += response.usage.input_tokens;
      totalOutput += response.usage.output_tokens;

      messages.push({ role: "assistant", content: response.content });

      // Done — Claude has no more tool calls
      if (response.stop_reason === "end_turn") {
        const finalText = response.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        return { text: finalText, inputTokens: totalInput, outputTokens: totalOutput };
      }

      // Execute any tool calls
      const toolResults = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          if (onToolCall) onToolCall(block.name);
          try {
            const result = await mcpClient.callTool({
              name: block.name,
              arguments: block.input,
            });
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result.content).slice(0, 8000),
            });
          } catch (err) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `Error: ${err.message}`,
              is_error: true,
            });
          }
        }
      }

      messages.push({ role: "user", content: toolResults });
    }

    throw new Error(`Claude exceeded ${maxIterations} iterations`);
  }
}
