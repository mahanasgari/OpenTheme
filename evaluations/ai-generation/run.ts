#!/usr/bin/env node
/**
 * SC-008 AI generation evaluation runner (manual; not CI).
 * Provider-agnostic: runs a user-supplied command once per attempt with the prompt on stdin.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

function parseArgs(argv: string[]): {
  command: string;
  attempts: number;
  label: string;
} {
  let command = "";
  let attempts = 10;
  let label = "default";
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--command") command = argv[++i] ?? "";
    else if (a === "--attempts") attempts = Number(argv[++i] ?? "10");
    else if (a === "--label") label = argv[++i] ?? "default";
  }
  if (!command) {
    process.stderr.write(
      "Usage: run.ts --command <cli> [--attempts N] [--label name]\n",
    );
    process.exit(3);
  }
  return { command, attempts, label };
}

function buildPrompt(): string {
  const llms = readFileSync(join(repoRoot, "specification/llms.txt"), "utf8");
  return [
    "Generate one valid OpenTheme 1.0 theme document as a single JSON object.",
    "Use only the specification materials below. Output JSON only.",
    "",
    llms,
  ].join("\n");
}

function validateTheme(bytes: string): {
  valid: boolean;
  diagnostics: unknown[];
} {
  const otRef = join(
    repoRoot,
    "tools/reference-checker/dist/cli/main.js",
  );
  const tmp = join(here, "results", `_attempt.json`);
  writeFileSync(tmp, bytes);
  const r = spawnSync("node", [otRef, "validate", tmp, "--json"], {
    encoding: "utf8",
  });
  try {
    const out = JSON.parse(r.stdout || "{}") as {
      validity?: string;
      diagnostics?: unknown[];
    };
    return {
      valid: out.validity === "valid",
      diagnostics: out.diagnostics ?? [],
    };
  } catch {
    return { valid: false, diagnostics: [{ error: r.stderr || r.stdout }] };
  }
}

function runCommand(command: string, prompt: string): string {
  const r = spawnSync(command, {
    input: prompt,
    encoding: "utf8",
    shell: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(`command failed: ${r.stderr || r.stdout}`);
  }
  return (r.stdout || "").trim();
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in output");
  return text.slice(start, end + 1);
}

function main(): void {
  const { command, attempts, label } = parseArgs(process.argv.slice(2));
  const outDir = join(here, "results", label);
  mkdirSync(outDir, { recursive: true });
  const prompt = buildPrompt();
  let firstOk = 0;
  let afterOk = 0;

  for (let i = 0; i < attempts; i += 1) {
    const record: Record<string, unknown> = { attempt: i + 1 };
    try {
      const raw = runCommand(command, prompt);
      const json = extractJson(raw);
      const first = validateTheme(json);
      record.first = first;
      if (first.valid) {
        firstOk += 1;
        afterOk += 1;
      } else {
        const correction = [
          "Fix this OpenTheme theme using only these diagnostics.",
          "Return the full corrected JSON document.",
          "",
          JSON.stringify(first.diagnostics, null, 2),
          "",
          "Document:",
          json,
        ].join("\n");
        const fixedRaw = runCommand(command, correction);
        const fixed = extractJson(fixedRaw);
        const second = validateTheme(fixed);
        record.second = second;
        if (second.valid) afterOk += 1;
      }
    } catch (err) {
      record.error = (err as Error).message;
    }
    writeFileSync(
      join(outDir, `attempt-${String(i + 1).padStart(3, "0")}.json`),
      JSON.stringify(record, null, 2) + "\n",
    );
    process.stderr.write(
      `attempt ${i + 1}/${attempts}: first=${Boolean((record.first as { valid?: boolean })?.valid)} after=${Boolean((record.second as { valid?: boolean })?.valid ?? (record.first as { valid?: boolean })?.valid)}\n`,
    );
  }

  const summary = {
    label,
    attempts,
    firstAttemptValid: firstOk,
    afterCorrectionValid: afterOk,
    firstRate: firstOk / attempts,
    afterRate: afterOk / attempts,
  };
  writeFileSync(
    join(outDir, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

main();
