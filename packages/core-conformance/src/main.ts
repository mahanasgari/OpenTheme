#!/usr/bin/env node
/**
 * NDJSON protocol 1 harness for @opentheme/core
 * (specs/002-core-runtime/contracts/conformance-harness.md).
 * It maps requests to Core's public API only; it never executes fixture content.
 */
import { createInterface } from "node:readline";
import { handlers } from "./kinds/index.js";

const KINDS = [
  "validate",
  "validate-host",
  "resolve",
  "canonicalize",
  "flatten",
  "export-check",
  "compare-versions",
  "migrate",
  "kernel",
  "validate-preferences",
  "accessibility-report",
] as const;

function write(obj: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

function serve(): void {
  const rl = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg: { type?: string; id?: string; kind?: string; input?: unknown };
    try {
      msg = JSON.parse(trimmed) as typeof msg;
    } catch {
      return;
    }
    if (msg.type === "hello") {
      write({
        type: "hello",
        implementation: "@opentheme/core",
        version: "0.1.0-draft.0",
        supports: KINDS.filter((k) => handlers[k] !== undefined),
      });
      return;
    }
    if (msg.type === "bye") {
      rl.close();
      return;
    }
    if (msg.type !== "request") return;
    const id = String(msg.id ?? "");
    const handler = msg.kind ? handlers[msg.kind as (typeof KINDS)[number]] : undefined;
    if (!handler) {
      write({ type: "response", id, unsupported: true });
      return;
    }
    try {
      write({ type: "response", id, result: handler(msg.input) });
    } catch (err) {
      write({ type: "response", id, error: (err as Error).message });
    }
  });
  rl.on("close", () => process.exit(0));
}

if (process.argv[2] === "serve-conformance") {
  serve();
} else {
  process.stderr.write("usage: ot-core serve-conformance\n");
  process.exit(3);
}
