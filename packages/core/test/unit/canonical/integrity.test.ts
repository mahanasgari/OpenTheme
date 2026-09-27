/** SHA-256 standard vectors and canonical integrity of the conformance fixtures. */
import { describe, expect, it } from "vitest";
import { computeIntegrity } from "../../../src/canonical/integrity.js";
import { sha256, utf8Encode } from "../../../src/canonical/sha256.js";
import { fixtures } from "../../fixtures.js";

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

describe("sha256", () => {
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"],
    ["a".repeat(1_000_000), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"],
  ])("vector %#", (input, digest) => {
    expect(hex(sha256(utf8Encode(input)))).toBe(digest);
  });
});

describe("canonical fixtures", () => {
  const cases = fixtures("canonical").filter((f) => f.kind === "canonicalize");
  it("has fixtures", () => expect(cases.length).toBeGreaterThan(0));
  it.each(cases.map((f) => [f.id, f] as const))("%s", (_id, f) => {
    const expected = f.expect as unknown as { canonical?: string; integrity?: string };
    const got = computeIntegrity(f.input.theme as Record<string, unknown>);
    if (expected.canonical !== undefined) expect(got.canonical).toBe(expected.canonical);
    if (expected.integrity !== undefined) expect(got.integrity).toBe(expected.integrity);
  });
});

describe("utf8Encode", () => {
  it("matches the platform encoder on every plane", () => {
    const text = "aé€\u{1F600}\u0000߿ࠀ￿\u{10FFFF}";
    expect([...utf8Encode(text)]).toEqual([...Buffer.from(text, "utf8")]);
  });
});

import { canonicalForm, canonicalFormSlow } from "../../../src/canonical/integrity.js";
import { read, AURORA, GRAPHITE } from "../../helpers.js";

describe("canonical form fast path", () => {
  const docs: unknown[] = [JSON.parse(read(AURORA)), JSON.parse(read(GRAPHITE))];
  for (const f of fixtures("valid", "invalid", "malicious", "canonical", "resolution")) {
    for (const v of [f.input.theme, ...(((f.input.themes as { document: unknown }[] | undefined) ?? []).map((t) => t.document))]) {
      if (v && typeof v === "object" && !Array.isArray(v)) docs.push(v);
    }
  }
  docs.push({
    z: 1, a: { hex: "#FF0000" }, c: { colorSpace: "srgb", components: [1, { x: 2, a: 1 }, 0], alpha: 1 },
    $extensions: { "b.x": { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex: "#000000" }, "a.y": [{ z: 1, a: 2 }] },
    s: " \ud800 é", n: [-0, 1e21, 5e-7, 0.1 + 0.2], integrity: "x",
  });
  it("equals the member-by-member writer on every document", () => {
    expect(docs.length).toBeGreaterThan(100);
    for (const d of docs) expect(canonicalForm(d as Record<string, unknown>)).toBe(canonicalFormSlow(d as Record<string, unknown>));
  });
  it("rejects non-finite numbers like JCS", () => {
    expect(() => canonicalForm({ a: Number.NaN })).toThrow(/non-finite/);
  });
});
