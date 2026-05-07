// agent.js — Hybrid Playwright Agent (Gemini + Claude)
// Generates Playwright tests using your preferred AI provider

import 'dotenv/config';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "fs";
import path from "path";
import { createProvider, createAutoProvider, listPresets } from "./lib/provider-factory.js";

// ─────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────
const MAX_ITERATIONS = parseInt(process.env.MAX_ITERATIONS || "30");
const OUTPUT_DIR = "tests/generated";

// ─────────────────────────────────────────────────────────
// SYSTEM PROMPT (shared across providers)
// ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a browser automation agent that generates Playwright tests.

Your job has TWO phases:

PHASE 1 — EXECUTE:
Use the browser tools to perform the user's scenario step by step.
- Prefer browser_snapshot over screenshots (saves tokens)
- Use stable selectors when interacting (data-testid > role > label > text)
- Verify each step succeeded before moving on

PHASE 2 — GENERATE TEST FILE:
Once the scenario completes successfully, output a complete Playwright 
test file that reproduces it. The file MUST:

1. Be wrapped in a single \`\`\`javascript code block
2. Use @playwright/test (import { test, expect })
3. Use the most stable selectors available, in this priority:
   - page.getByTestId('...')        ← best
   - page.getByRole('button', { name: '...' })
   - page.getByLabel('...')
   - page.getByText('...')
   - page.locator('css')             ← last resort
4. Include proper expect() assertions for each verification
5. Use await for every action
6. Have a descriptive test name
7. Be standalone and runnable

After the code block, add a brief "## Notes" section with assumptions or flaky areas.`;

// ─────────────────────────────────────────────────────────
// MCP CONNECTION (provider-agnostic)
// ─────────────────────────────────────────────────────────
async function connectMCP() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["@playwright/mcp@latest", "--headless"],
  });

  const client = new Client(
    { name: "hybrid-test-agent", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log(`🔌 Connected to Playwright MCP\n`);
  return client;
}

// ─────────────────────────────────────────────────────────
// EXTRACT & SAVE GENERATED TEST
// ─────────────────────────────────────────────────────────
function extractAndSaveTest(agentOutput, testName) {
  const codeMatch = agentOutput.match(/```(?:javascript|js|typescript|ts)\n([\s\S]+?)```/);

  if (!codeMatch) {
    console.error("⚠️  No code block found. Saving raw output for debug.");
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const debugPath = path.join(OUTPUT_DIR, `debug-${Date.now()}.txt`);
    fs.writeFileSync(debugPath, agentOutput);
    console.error(`Debug saved to: ${debugPath}`);
    return null;
  }

  const code = codeMatch[1].trim();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const safeName = testName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  const filename = path.join(OUTPUT_DIR, `${safeName}.spec.js`);
  fs.writeFileSync(filename, code);

  const notesMatch = agentOutput.match(/## Notes\s*\n([\s\S]+?)$/);
  if (notesMatch) {
    fs.writeFileSync(filename.replace(".spec.js", ".notes.md"), notesMatch[1].trim());
  }

  return filename;
}

// ─────────────────────────────────────────────────────────
// HELP TEXT
// ─────────────────────────────────────────────────────────
function showHelp() {
  console.log(`
🤖 Hybrid Playwright Agent — Gemini + Claude

USAGE:
  node agent.js "<scenario>" [options]

OPTIONS:
  --name <name>          Name for the generated test file
  --model <preset>       Choose AI model (see presets below)
  --auto                 Auto-pick model based on goal complexity

PRESETS (--model):
  Gemini (cheap, free tier):
    gemini-flash         Fast, cheap, default
    gemini-pro           Smarter Gemini

  Claude (smart, paid):
    claude-haiku         Cheapest Claude
    claude-sonnet        Balanced Claude
    claude-opus          Most capable Claude

  Aliases:
    cheap / fast         → gemini-flash
    smart                → claude-sonnet
    best                 → claude-opus

EXAMPLES:
  # Default (uses Gemini if GEMINI_API_KEY set, else Claude)
  node agent.js "Go to example.com and verify heading" --name "basic"

  # Use a specific preset
  node agent.js "Complex flow..." --model smart --name "complex"
  node agent.js "Quick test..." --model cheap --name "quick"

  # Auto-pick based on complexity
  node agent.js "Multi-step checkout flow..." --auto --name "checkout"

  # Use a raw model name
  node agent.js "..." --model gemini-2.5-pro --name "test"

ENVIRONMENT:
  GEMINI_API_KEY         For Gemini (https://aistudio.google.com/apikey)
  ANTHROPIC_API_KEY      For Claude (https://console.anthropic.com)
  MAX_ITERATIONS         Tool call limit (default: 30)

WORKFLOW:
  1. Generate a test:    node agent.js "..." --name "x"
  2. Run it free forever: npx playwright test
`);
}

// ─────────────────────────────────────────────────────────
// CLI ARG PARSING
// ─────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { goal: [], name: null, model: null, auto: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--name") {
      opts.name = args[++i];
    } else if (arg === "--model") {
      opts.model = args[++i];
    } else if (arg === "--auto") {
      opts.auto = true;
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else {
      opts.goal.push(arg);
    }
  }

  opts.goal = opts.goal.join(" ");
  return opts;
}

// ─────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv);

  if (opts.help || !opts.goal) {
    showHelp();
    process.exit(opts.help ? 0 : 1);
  }

  // Pick provider
  let provider;
  try {
    if (opts.auto) {
      provider = createAutoProvider(opts.goal);
    } else {
      provider = createProvider(opts.model);
    }
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  const testName = opts.name || `test-${Date.now()}`;

  console.log(`🎯 Goal: ${opts.goal}`);
  console.log(`📝 Test name: ${testName}`);
  console.log(`🤖 Provider: ${provider.name}\n`);

  const mcpClient = await connectMCP();

  try {
    const result = await provider.run({
      systemPrompt: SYSTEM_PROMPT,
      userGoal: opts.goal,
      mcpClient,
      maxIterations: MAX_ITERATIONS,
      onToolCall: (name) => console.log(`🔧 ${name}`),
    });

    console.log(`\n📊 Tokens: ${result.inputTokens} in / ${result.outputTokens} out`);

    const savedPath = extractAndSaveTest(result.text, testName);

    if (savedPath) {
      console.log(`\n✅ Test saved to: ${savedPath}`);
      console.log(`\n▶️  Run it (FREE forever):`);
      console.log(`   npx playwright test ${savedPath}`);
    }
  } catch (err) {
    console.error("\n❌ Agent failed:", err.message);
    process.exit(1);
  } finally {
    await mcpClient.close();
  }

  process.exit(0);
}

main();
