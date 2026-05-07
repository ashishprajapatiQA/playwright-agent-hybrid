// lib/gemini-provider.js
// Wraps Google Gemini in a unified interface

import { GoogleGenAI, mcpToTool } from "@google/genai";

const DEFAULT_MODEL = "gemini-2.5-flash";

export class GeminiProvider {
  constructor(model) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not set. Get one at https://aistudio.google.com/apikey");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.model = model || DEFAULT_MODEL;
    this.name = `Gemini (${this.model})`;
  }

  async run({ systemPrompt, userGoal, mcpClient, maxIterations, onToolCall }) {
    const chat = this.ai.chats.create({
      model: this.model,
      config: {
        systemInstruction: systemPrompt,
        tools: [mcpToTool(mcpClient)],
        automaticFunctionCalling: {
          maximumRemoteCalls: maxIterations,
        },
      },
    });

    const response = await chat.sendMessage({ message: userGoal });

    // Report tool calls for visibility
    const history = chat.getHistory();
    for (const turn of history) {
      if (turn.parts) {
        for (const part of turn.parts) {
          if (part.functionCall && onToolCall) {
            onToolCall(part.functionCall.name);
          }
        }
      }
    }

    return {
      text: response.text,
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
    };
  }
}
