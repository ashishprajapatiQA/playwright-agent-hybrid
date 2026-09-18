import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { parseArgs, extractAndSaveTest, showHelp } from "../../agent.js";

const OUTPUT_DIR = path.resolve("tests/generated");
const createdFiles = [];

test.afterEach(() => {
  for (const file of createdFiles.splice(0)) {
    fs.rmSync(file, { force: true });
  }
});

test.describe("parseArgs", () => {
  test("parses flags and joins the remaining words into a goal", () => {
    const opts = parseArgs([
      "node", "agent.js",
      "go", "to", "example.com",
      "--name", "my-test",
      "--model", "smart",
    ]);
    expect(opts).toEqual({
      goal: "go to example.com",
      name: "my-test",
      model: "smart",
      auto: false,
    });
  });

  test("recognizes --auto and --help", () => {
    const opts = parseArgs(["node", "agent.js", "--auto", "--help"]);
    expect(opts.auto).toBe(true);
    expect(opts.help).toBe(true);
    expect(opts.goal).toBe("");
  });
});

test.describe("extractAndSaveTest", () => {
  test("saves the code block and notes file to tests/generated", () => {
    const output = [
      "Here is the test:",
      "```javascript",
      "import { test, expect } from '@playwright/test';",
      "```",
      "## Notes",
      "This is flaky on slow networks.",
    ].join("\n");

    const savedPath = extractAndSaveTest(output, "Uzera Unit Fixture!!");
    createdFiles.push(savedPath, savedPath.replace(".spec.js", ".notes.md"));

    expect(savedPath).toBe(path.join("tests/generated", "uzera-unit-fixture.spec.js"));
    expect(fs.readFileSync(savedPath, "utf8")).toBe(
      "import { test, expect } from '@playwright/test';"
    );
    expect(fs.readFileSync(savedPath.replace(".spec.js", ".notes.md"), "utf8")).toBe(
      "This is flaky on slow networks."
    );
  });

  test("falls back to a debug dump when no code block is found", () => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const before = new Set(fs.readdirSync(OUTPUT_DIR));

    const result = extractAndSaveTest("no code block here", "ignored");
    expect(result).toBeNull();

    const newFiles = fs.readdirSync(OUTPUT_DIR).filter((f) => !before.has(f));
    expect(newFiles.length).toBe(1);
    expect(newFiles[0]).toMatch(/^debug-\d+\.txt$/);
    createdFiles.push(path.join(OUTPUT_DIR, newFiles[0]));
  });
});

test.describe("showHelp", () => {
  test("prints usage information", () => {
    const logs = [];
    const original = console.log;
    console.log = (msg) => logs.push(msg);
    try {
      showHelp();
    } finally {
      console.log = original;
    }
    expect(logs.join("\n")).toContain("Hybrid Playwright Agent");
  });
});
