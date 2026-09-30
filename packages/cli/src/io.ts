/**
 * Input and output (research LR5, LR6): injected streams so commands run in process in tests,
 * file reading and writing with typed failures (exit status 3), and the color rule.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

export interface Io {
  stdout(text: string): void;
  stderr(text: string): void;
  readonly isTerminal: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
}

/** A missing or unreadable input, a write failure, or a refused overwrite (exit status 3). */
export class InputOutputError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "InputOutputError";
    this.path = path;
  }
}

/** Invalid command-line usage (exit status 2). */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export function readInput(path: string): Uint8Array {
  try {
    return readFileSync(path);
  } catch (e) {
    const code = (e as { code?: string }).code;
    throw new InputOutputError(path, code === "ENOENT" ? "no such file" : code === "EISDIR" ? "is a directory" : "cannot be read");
  }
}

export function writeOutput(path: string, text: string, force: boolean): void {
  if (!force && existsSync(path)) throw new InputOutputError(path, "already exists (use --force to overwrite)");
  try {
    writeFileSync(path, text);
  } catch {
    throw new InputOutputError(path, "cannot be written");
  }
}

/** Color only on a terminal, and never with NO_COLOR or --no-color. */
export function useColor(io: Io, noColor: boolean): boolean {
  return io.isTerminal && !noColor && (io.env.NO_COLOR === undefined || io.env.NO_COLOR === "");
}

export function nodeIo(): Io {
  return {
    stdout: (t) => void process.stdout.write(t),
    stderr: (t) => void process.stderr.write(t),
    isTerminal: process.stdout.isTTY === true,
    env: process.env,
  };
}
