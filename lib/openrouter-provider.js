// lib/openrouter-provider.js
// Wraps OpenRouter (OpenAI-compatible) in a unified interface (manual MCP loop)

import OpenAI from "openai";

const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct";

export class OpenRouterProvider {
  constructor(model) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY not set. Get one at https://openrouter.ai/keys");
    }
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    this.model = model || DEFAULT_MODEL;
    this.name = `OpenRouter (${this.model})`;
  }

  async run({ systemPrompt, userGoal, mcpClient, maxIterations, onToolCall }) {
    // Get tools from MCP and convert to OpenAI function-calling format
    const { tools: mcpTools } = await mcpClient.listTools();
    const openaiTools = mcpTools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userGoal },
    ];
    let totalInput = 0;
    let totalOutput = 0;
    let iterations = 0;

    while (iterations++ < maxIterations) {
      const response = await this.client.chat.completions.create({
        model: this.model,
        tools: openaiTools,
        messages,
      });

      totalInput += response.usage?.prompt_tokens ?? 0;
      totalOutput += response.usage?.completion_tokens ?? 0;

      const message = response.choices[0].message;
      messages.push(message);

      // Done — no more tool calls
      if (response.choices[0].finish_reason === "stop" || !message.tool_calls?.length) {
        return { text: message.content ?? "", inputTokens: totalInput, outputTokens: totalOutput };
      }

      // Execute tool calls and collect results
      for (const toolCall of message.tool_calls) {
        if (onToolCall) onToolCall(toolCall.function.name);
        let resultContent;
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await mcpClient.callTool({ name: toolCall.function.name, arguments: args });
          resultContent = JSON.stringify(result.content).slice(0, 8000);
        } catch (err) {
          resultContent = `Error: ${err.message}`;
        }
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: resultContent,
        });
      }
    }

    throw new Error(`OpenRouter exceeded ${maxIterations} iterations`);
  }
}
