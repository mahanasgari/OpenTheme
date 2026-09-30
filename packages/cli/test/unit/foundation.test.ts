/** Options, formatting, and I/O rules (T010). */
import { describe, expect, it } from "vitest";
import { contextOptions, inputOptions, parse } from "../../src/args.js";
import { counts, toJson } from "../../src/format.js";
import { type Io, UsageError, useColor, writeOutput } from "../../src/io.js";
import { tempDir } from "../helpers.js";

describe("options", () => {
  it("defaults the context as documented", () => {
    expect(contextOptions({})).toEqual({
      platform: { colorScheme: "light", contrast: "standard", forcedColors: false, reducedMotion: false, textScale: 1 },
      environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
    });
  });
  it.each([
    [{ scheme: "blue" }],
    [{ contrast: "more" }],
    [{ size: "huge" }],
    [{ dir: "up" }],
    [{ "text-scale": "0" }],
    [{ "text-scale": "abc" }],
    [{ locale: "not a tag" }],
  ])("rejects %j", (v) => expect(() => contextOptions(v)).toThrow(UsageError));
  it("trust defaults to untrusted user-created", () => {
    expect(inputOptions({})).toMatchObject({ trusted: false, source: "user-created", bases: [], relaxedGate: false });
    expect(() => inputOptions({ source: "official" })).toThrow(UsageError);
  });
  it("unknown options are usage errors", () => {
    expect(() => parse(["--nope"], {})).toThrow(UsageError);
  });
});

describe("formatting", () => {
  it("writes sorted keys and a trailing newline", () => {
    expect(toJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      '{\n  "a": {\n    "c": [\n      3,\n      {\n        "e": 5,\n        "f": 4\n      }\n    ],\n    "d": 2\n  },\n  "b": 1\n}\n',
    );
  });
  it("counts by severity", () => {
    const d = (severity: string) => ({ severity }) as never;
    expect(counts([d("error"), d("error"), d("warning")])).toBe("2 errors, 1 warning");
    expect(counts([])).toBe("");
  });
});

describe("io", () => {
  const io = (isTerminal: boolean, env: Record<string, string> = {}): Io => ({ stdout: () => {}, stderr: () => {}, isTerminal, env });
  it("colors only on a terminal without NO_COLOR or --no-color", () => {
    expect(useColor(io(true), false)).toBe(true);
    expect(useColor(io(false), false)).toBe(false);
    expect(useColor(io(true), true)).toBe(false);
    expect(useColor(io(true, { NO_COLOR: "1" }), false)).toBe(false);
  });
  it("refuses to overwrite without force", () => {
    const t = tempDir();
    const path = t.file("x.txt", "old");
    expect(() => writeOutput(path, "new", false)).toThrow(/already exists/);
    writeOutput(path, "new", true);
    t.remove();
  });
});
