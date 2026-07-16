# Uzera MCP Test Suite — Build Recipe (reusable across repos)

This captures the exact steps/instructions used to generate the uzera MCP regression suite in
the `playwright-agent-hybrid` repo (it lives in `tests/uzera/`). Paste §2–§3 into Claude Code
in any repo where you want the same thing; §4–§6 are the target shape and build order so the
result matches; §7–§9 are the artifacts and gotchas to carry over.

---

## 1. Goal (one line)

A **deterministic, repeatable daily regression suite for every uzera MCP tool**, runnable with
a single prompt, that emits a bug report (repro + expected vs actual) on failure — built into
the repo so it's never rewritten.

---

## 2. Step 0 — enumerate the tools first

Before building anything, ask:

> **give me all uzera tools list**

Cover **every** tool the server exposes, not a subset. In this repo that was **15 tools**:
`symbol, outline, search, refs, read, find_files, list_dir, lsp, index_project, edit,
judge_rules, report_violation, usage_report, login, logout`.

---

## 3. The core brief (paste this)

> I want to test all of the uzera mcp tools mentioned above against this repository on a
> **daily, recurring basis**. To do this, I'd like you to:
>
> 1. **Generate a reusable test case file** — a set of test cases I can run repeatedly each
>    day, rather than rewriting them every time.
> 2. **Add the supporting code to the repo** — whatever test/verification code is needed so
>    these test cases can actually run against this codebase.
> 3. **Enable single-prompt execution** — set things up so I can trigger the full test run
>    with just one prompt.
> 4. **Produce a bug report** — if any test fails, give me a report listing each bug with the
>    reproduction steps and the actual vs. expected results.
>
> How would you approach setting this up?

### Follow-up instructions that shaped the result

- **Manual-QA verification prompt:** "I just want a prompt to paste in Claude Code that
  verifies all tools **manually, by me as QA** — the same things `npm run uzera:test` does,"
  so I can confirm the automated and manual paths agree.
- **Explain coverage:** for each tool, state **which fixture file it hits and how it's
  asserted**, in a replayable "prompting" form.
- **HTML export:** export the result/QA prompts to a self-contained **HTML** file committed to
  the repo.

---

## 4. Deliverables — what "done" looks like

Match this structure in a new repo:

```
tests/uzera/
  cases.json              # reusable test specs (data, not code) — one case per tool + negatives
  run-uzera-tests.js      # single entry point
  lib/mcp-client.js       # spawns `/usr/local/uzera/uzera mcp`, normalizes results + auth detection
  lib/sandbox.js          # copies fixtures → throwaway tmp dir + git init + cleanup
  lib/assertions.js       # assertion DSL
  lib/report.js           # writes latest.md + timestamped archive + results.json
  fixtures/               # minimal code that exercises every tool
    calculator.js  usage.js  notes.txt  sub/deep.js
  reports/                # output (gitignore archives)
  manual-qa-prompts.html  # the human-QA prompt set, exported to HTML (covers the follow-ups)
.claude/commands/uzera-test.md   # the single-prompt trigger (/uzera-test)
package.json scripts:  "uzera:test", "uzera:auth-test"
scripts/uzera-auth-and-test.sh           # optional: login → Claude session
scripts/com.uzera.uzera-test.plist       # optional: daily launchd run
```

---

## 5. Design decisions to carry over

- **No LLM in the test path** — drive the uzera stdio server directly from a Node MCP client
  (`@modelcontextprotocol/sdk`), so runs are deterministic and repeatable.
- **Throwaway sandbox** in `os.tmpdir()` each run (git-init'd) — the only mutating tool
  (`edit`) never touches the real repo.
- **Fixtures are minimal but cover every tool:** a class + a separate call site
  (symbol/outline/refs), a unique marker token e.g. `UZTEST_SEARCH_TOKEN` (search), a small
  text file (edit find/replace), a nested file (find_files / recursive list_dir), and some
  dead code (lsp dead-code check).
- **Cases live in `cases.json`** (data). Add/edit cases there — never rewrite the runner.
- **Assertion DSL** keeps cases declarative: `notError`, `expectError`, `outputContains`,
  `isJson`, `jsonPathEquals`, `arrayLengthAtLeast`, etc.
- **login/logout are real cases.** `logout` is `runLast:true` (sorted to the end so it can't
  blank the token mid-run) and signs you out; `UZERA_TEST_SKIP_LOGOUT=1` skips it for cron.
- **Auth gating:** if not logged in, report a single **BLOCKED** state — not N false bugs.
- **Exit codes:** `0` pass · `1` failures · `2` blocked · `3` fatal.

---

## 6. Build order

1. Enumerate the server's tools (§2).
2. Scaffold `tests/uzera/fixtures/` so each tool has something to act on (§5).
3. `lib/mcp-client.js` — spawn the stdio server, normalize results, detect auth-blocked.
4. `lib/sandbox.js` — copy fixtures → tmp, `git init`, cleanup in `finally`.
5. `lib/assertions.js` — the DSL.
6. `cases.json` — one case per tool + negative cases; mark `logout` `runLast:true`.
7. `run-uzera-tests.js` — load cases → make sandbox → connect → **preflight `list_dir`**
   (auth check) → `index_project` → run cases sequentially → write reports → set exit code.
8. `lib/report.js` — `latest.md` + timestamped `.md` + `results.json`; HTML export.
9. `package.json` scripts + the `/uzera-test` command (+ optional `uzera-auth-and-test.sh`).
10. `manual-qa-prompts.html` — the human-QA prompt set mirroring each automated check.
11. (Optional) daily launchd plist / scheduled routine.

---

## 7. Single-prompt trigger — `.claude/commands/uzera-test.md`

```markdown
---
description: Run the uzera MCP tool regression suite and summarize any bugs
allowed-tools: Bash(npm run uzera:test), Read
---
Run the uzera MCP tool regression suite end to end:

1. Run `npm run uzera:test`.
2. Read `tests/uzera/reports/latest.md`.
3. Summarize the outcome: total / passed / failed / skipped / blocked.
   - If the run is **BLOCKED** (e.g. "authentication required"), tell me to run `uzera login`
     (or call the `mcp__uzera__login` tool) and re-run — do not treat it as 15 real bugs.
   - For each **bug**, give the tool, the reproduction command, and expected vs actual.
   - If everything passed, say so in one line. All 15 tools run when authenticated; `logout`
     runs last and signs you out (re-login after), and is skipped when `UZERA_TEST_SKIP_LOGOUT=1`.
```

---

## 8. Manual-QA verification (the follow-up ask)

Deliver a copy-paste prompt set (exported to `tests/uzera/manual-qa-prompts.html`) that walks a
human QA through each tool using the uzera MCP tools directly, asserting the same things the
automated run does — so a person can confirm both paths agree. For every tool it should state:
the fixture file it targets, the exact tool call, and the expected result.

---

## 9. Auth gotchas (so a fresh run isn't derailed)

- **BLOCKED = auth, not bugs.** Run `uzera login` (or `mcp__uzera__login`) and re-run.
- **`/mcp` reconnect (or any MCP restart) drops the session** → next run is BLOCKED even if you
  logged in earlier. Re-login after a reconnect, then re-run.
- **Tokens have lapsed within ~2h** in practice — if a passing suite goes BLOCKED, re-login.
- The uzera hooks gate native Read/Write to `mcp__uzera__*`; when MCP is auth-blocked the
  auth-free `uzera-cli` runs the same engine without cloud login.
