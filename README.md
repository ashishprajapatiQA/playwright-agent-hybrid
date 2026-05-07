# Hybrid Playwright Agent (Gemini + Claude)

A unified AI agent that generates Playwright tests using **either Gemini or Claude** — switch with a single flag.

**The big idea:** Use cheap Gemini for everyday tests, switch to smart Claude for complex flows, or tap 100+ models via OpenRouter. Generate ONCE → run FOREVER for free.

---

## ✨ Why Hybrid?

| Provider | Best for | Cost |
|----------|----------|------|
| 🟢 Gemini Flash | Daily test generation, simple flows | **Free tier** or ~₹0.50/test |
| 🟢 Gemini Pro | Moderate complexity | ~₹2-5/test |
| 🟠 OpenRouter Llama | Free alternative to Gemini | **Free tier** available |
| 🟠 OpenRouter DeepSeek | Smart reasoning, low cost | ~₹1-3/test |
| 🟣 Claude Haiku | Reliable cheap option | ~₹2-4/test |
| 🟣 Claude Sonnet | Complex multi-step flows | ~₹10-25/test |
| 🟣 Claude Opus | Mission-critical, hardest scenarios | ~₹30-100/test |

You keep all API keys → pick the right tool per job.

---

## 🚀 Quick Start

### 1. Install
```bash
npm install
npx playwright install chromium
npm install -g @playwright/mcp
```

### 2. Set API key(s) — at least ONE
```bash
# Gemini (recommended for cheap default)
export GEMINI_API_KEY="AIza..."        # https://aistudio.google.com/apikey

# OpenRouter (100+ models, some free)
export OPENROUTER_API_KEY="sk-or-..."  # https://openrouter.ai/keys

# Claude (recommended for complex flows)
export ANTHROPIC_API_KEY="sk-ant..."   # https://console.anthropic.com
```

Or just edit your `.env` file. Set one or more — the agent auto-picks the cheapest available by default.

### 3. Generate a test
```bash
node agent.js "Go to example.com and verify the heading" --name "first-test"
```

### 4. Run it free forever
```bash
npx playwright test
```

---

## 🎛️ Switching Models

### Use a preset
```bash
# ── Gemini (requires GEMINI_API_KEY) ──────────────────────────────────────────
node agent.js "Go to www.google.com and verify the heading" --model gemini-flash --name "first"
node agent.js "Go to www.google.com and verify the heading" --model gemini-pro   --name "first"
node agent.js "Go to www.google.com and verify the heading" --model cheap        --name "first"  # same as gemini-flash
node agent.js "Go to www.google.com and verify the heading" --model fast         --name "first"  # same as gemini-flash

# ── OpenRouter (requires OPENROUTER_API_KEY) ──────────────────────────────────
node agent.js "Go to www.google.com and verify the heading" --model openrouter-llama    --name "first"  # Llama 3.3 70B
node agent.js "Go to www.google.com and verify the heading" --model openrouter-deepseek --name "first"  # DeepSeek Chat
node agent.js "Go to www.google.com and verify the heading" --model openrouter-gemma    --name "first"  # Gemma 3 27B (free)
node agent.js "Go to www.google.com and verify the heading" --model free                --name "first"  # Llama 3.3 70B free tier

# ── Claude (requires ANTHROPIC_API_KEY) ───────────────────────────────────────
node agent.js "Go to www.google.com and verify the heading" --model claude-haiku  --name "first"
node agent.js "Go to www.google.com and verify the heading" --model claude-sonnet --name "first"
node agent.js "Go to www.google.com and verify the heading" --model claude-opus   --name "first"
node agent.js "Go to www.google.com and verify the heading" --model smart         --name "first"  # same as claude-sonnet
node agent.js "Go to www.google.com and verify the heading" --model best          --name "first"  # same as claude-opus
```

### Auto mode (smart selection)
```bash
node agent.js "Multi-step checkout with validation" --auto --name "checkout"
```

The `--auto` flag inspects your goal:
- Long or multi-step goals → smart model (Claude Sonnet / Gemini Pro)
- Short, simple goals → cheap model (Gemini Flash / Claude Haiku)

### Use a raw model name
```bash
# Gemini — starts with "gemini"
node agent.js "..." --model gemini-2.5-pro
node agent.js "..." --model gemini-2.5-flash

# Claude — starts with "claude"
node agent.js "..." --model claude-sonnet-4-6

# OpenRouter — any model name containing "/" (org/model format)
node agent.js "..." --model "meta-llama/llama-3.3-70b-instruct"
node agent.js "..." --model "deepseek/deepseek-chat"
node agent.js "..." --model "mistralai/mistral-7b-instruct:free"
node agent.js "..." --model "openai/gpt-4o-mini"
```

### npm script shortcuts
```bash
npm run agent:cheap -- "Go to wikipedia.org" --name "wiki"
npm run agent:smart -- "Complex e-commerce flow" --name "ecom"
npm run agent:auto  -- "Some scenario..." --name "auto"
```

---

## 📂 Project Structure

```
playwright-agent-hybrid/
├── agent.js                     ← Main CLI entry point
├── lib/
│   ├── gemini-provider.js       ← Gemini wrapper
│   ├── claude-provider.js       ← Claude wrapper
│   ├── openrouter-provider.js   ← OpenRouter wrapper (100+ models)
│   └── provider-factory.js      ← Picks provider from CLI flags
├── package.json
├── playwright.config.js
├── .env.example
├── .gitignore
├── README.md
├── tests/generated/             ← All generated tests live here
│   └── example.spec.js
└── .github/workflows/
    └── tests.yml                ← CI runs free (no API keys needed)
```

---

## 🧠 Hybrid Strategy in Practice

A real workflow for a project with daily testing needs:

| Scenario | Provider | Why |
|----------|----------|-----|
| New simple test | `--model cheap` (Gemini Flash) | Free tier, fast |
| Simple test, no Gemini key | `--model free` (OpenRouter Llama) | Free tier alternative |
| Complex form/flow | `--model smart` (Claude Sonnet) | Better at multi-step reasoning |
| Complex test, low budget | `--model openrouter-deepseek` | Smart reasoning, cheap |
| Production-critical login | `--model best` (Claude Opus) | Highest reliability |
| Bulk regenerate after UI redesign | `--auto` | Lets agent pick per-test |
| Daily CI runs | None — plain Playwright | $0 forever |

**Rule of thumb:** generate with the cheapest model that produces a passing test. Only escalate to a smarter model if the cheap one fails or generates flaky selectors.

---

## 🔁 Daily Workflow

```bash
# Monday: write 5 simple tests with Gemini (essentially free)
node agent.js "Test #1..." --model cheap --name "test1"
node agent.js "Test #2..." --model cheap --name "test2"
# ...

# Tuesday: one tricky flow needs Claude
node agent.js "Complex multi-page checkout..." --model smart --name "checkout"

# Wednesday onward: just run them, no AI cost
npx playwright test
```

---

## 🤖 CI/CD (GitHub Actions)

Push to GitHub → tests run on every PR/push automatically.
**No API keys needed in CI** — generated tests are plain Playwright.

The included `.github/workflows/tests.yml` handles everything.

If you want CI to also regenerate broken tests automatically, add this step:
```yaml
- name: Regenerate failed tests
  if: failure()
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: |
    # Custom logic to detect failed test and re-run agent
    node scripts/heal.js
```

---

## 💡 Tips

**Be specific in your goal.** Vague goals → flaky tests:
- ❌ "Test the login"
- ✅ "Go to /login, fill #email with test@test.com, fill #password with pass123, click 'Sign In', verify URL changes to /dashboard"

**Check the generated test before committing.** The agent gets selectors right ~90% of the time. Tweak them if needed.

**Keep generated tests in git.** They're real code — review, edit, version them like any test.

**Use auto mode when in doubt.** `--auto` is a good default if you don't know whether your goal is simple or complex.

**Watch the browser while debugging.** Edit `agent.js` line ~52 and remove `--headless` from the MCP args.

---

## 🆘 Troubleshooting

| Problem | Fix |
|---------|-----|
| `GEMINI_API_KEY not set` | Export it, or use `--model free` / `--model claude-...` instead |
| `ANTHROPIC_API_KEY not set` | Export it, or use Gemini / OpenRouter preset |
| `OPENROUTER_API_KEY not set` | Export it, or get a free key at https://openrouter.ai/keys |
| Agent loops forever | Lower `MAX_ITERATIONS` env var or simplify goal |
| Generated test is flaky | Regenerate with `--model smart` for better selectors |
| Test passes locally, fails in CI | Add explicit `await page.waitForLoadState()` calls |
| `Cannot find module @playwright/mcp` | `npm install -g @playwright/mcp` |

---

## 📊 Cost Comparison (per test generation)

For a real-world login flow test (~10 tool calls):

| Model | Approx Cost | Time |
|-------|-------------|------|
| Gemini Flash | Free or ₹0.30 | 10-15s |
| Gemini Pro | ₹2-4 | 15-20s |
| OpenRouter Llama 3.3 70B | Free tier available | 10-20s |
| OpenRouter DeepSeek Chat | ₹1-2 | 10-20s |
| OpenRouter GPT-4o Mini | ₹1-3 | 10-15s |
| Claude Haiku | ₹2-3 | 10-15s |
| Claude Sonnet | ₹10-15 | 15-25s |
| Claude Opus | ₹40-80 | 20-30s |

Generate once → run 1000+ times in CI for **₹0**.

---

## 📜 License

MIT
# playwright-agent-hybrid
