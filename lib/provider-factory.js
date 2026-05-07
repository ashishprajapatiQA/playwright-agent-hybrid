// lib/provider-factory.js
// Picks the right AI provider based on flags or auto-detection

import { GeminiProvider } from "./gemini-provider.js";
import { ClaudeProvider } from "./claude-provider.js";
import { OpenRouterProvider } from "./openrouter-provider.js";

// Provider presets — short names map to (provider, model) combos
const PRESETS = {
  // Gemini presets (cheap, free tier available)
  "gemini-flash": { provider: "gemini", model: "gemini-2.5-flash" },
  "gemini-pro":   { provider: "gemini", model: "gemini-2.5-pro" },

  // Claude presets (smarter, paid)
  "claude-haiku": { provider: "claude", model: "claude-haiku-4-5" },
  "claude-sonnet":{ provider: "claude", model: "claude-sonnet-4-6" },
  "claude-opus":  { provider: "claude", model: "claude-opus-4-7" },

  // OpenRouter presets (100+ models, some with free tier)
  "openrouter-llama":    { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct" },
  "openrouter-deepseek": { provider: "openrouter", model: "deepseek/deepseek-chat" },
  "openrouter-gemma":    { provider: "openrouter", model: "google/gemma-3-27b-it:free" },

  // Aliases for common workflows
  "cheap":   { provider: "gemini", model: "gemini-2.5-flash" },   // free/cheapest
  "fast":    { provider: "gemini", model: "gemini-2.5-flash" },   // same as cheap
  "free":    { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free" }, // OpenRouter free tier
  "smart":   { provider: "claude", model: "claude-sonnet-4-6" },  // good balance
  "best":    { provider: "claude", model: "claude-opus-4-7" },    // most reliable
};

export function listPresets() {
  return Object.keys(PRESETS);
}

function makeProvider(provider, model) {
  if (provider === "gemini") return new GeminiProvider(model);
  if (provider === "claude") return new ClaudeProvider(model);
  if (provider === "openrouter") return new OpenRouterProvider(model);
  throw new Error(`Unknown provider: ${provider}`);
}

export function createProvider(presetOrModel) {
  // If user passed a preset name, resolve it
  if (PRESETS[presetOrModel]) {
    const { provider, model } = PRESETS[presetOrModel];
    return makeProvider(provider, model);
  }

  // If user passed a raw model name, infer provider from it
  if (presetOrModel) {
    if (presetOrModel.startsWith("gemini")) return new GeminiProvider(presetOrModel);
    if (presetOrModel.startsWith("claude")) return new ClaudeProvider(presetOrModel);
    // OpenRouter models always contain a "/" (e.g. "meta-llama/llama-3.3-70b-instruct")
    if (presetOrModel.includes("/")) return new OpenRouterProvider(presetOrModel);
    throw new Error(`Unknown model/preset: ${presetOrModel}`);
  }

  // Auto-detect: prefer Gemini if its key is set (cheaper), else OpenRouter, else Claude
  if (process.env.GEMINI_API_KEY) return new GeminiProvider();
  if (process.env.OPENROUTER_API_KEY) return new OpenRouterProvider();
  if (process.env.ANTHROPIC_API_KEY) return new ClaudeProvider();

  throw new Error(
    "No API key found. Set GEMINI_API_KEY, OPENROUTER_API_KEY, or ANTHROPIC_API_KEY.\n" +
    "  Gemini: https://aistudio.google.com/apikey (free tier available)\n" +
    "  OpenRouter: https://openrouter.ai/keys (100+ models, some free)\n" +
    "  Claude: https://console.anthropic.com"
  );
}

// Smart provider for "auto" mode — picks based on goal complexity
export function createAutoProvider(goal) {
  // Heuristic: long/complex goals → smarter model, simple ones → cheap
  const isComplex = 
    goal.length > 200 ||
    /multi[- ]?step|complex|verify.*and.*then|then.*then/i.test(goal) ||
    (goal.match(/\b(then|after|next|finally)\b/gi) || []).length >= 2;

  if (isComplex) {
    console.log("🧠 Complex goal detected — using smart model");
    if (process.env.ANTHROPIC_API_KEY) return new ClaudeProvider("claude-sonnet-4-6");
    if (process.env.GEMINI_API_KEY) return new GeminiProvider("gemini-2.5-pro");
  }

  console.log("⚡ Simple goal — using cheap model");
  if (process.env.GEMINI_API_KEY) return new GeminiProvider("gemini-2.5-flash");
  if (process.env.ANTHROPIC_API_KEY) return new ClaudeProvider("claude-haiku-4-5");

  throw new Error("No API key found. Set GEMINI_API_KEY, OPENROUTER_API_KEY, or ANTHROPIC_API_KEY.");
}
