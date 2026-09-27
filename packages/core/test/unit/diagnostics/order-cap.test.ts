/** Chapter 13 ordering and cap (FR-C084): 200 findings, then OT-LIM-099. */
import { describe, expect, it } from "vitest";
import { createCore } from "../../../src/index.js";
import { AURORA, read } from "../../helpers.js";

function manyFindings(): string {
  const doc = JSON.parse(read(AURORA)) as Record<string, unknown>;
  const bad: Record<string, unknown> = {};
  for (let i = 0; i < 260; i += 1) bad[`t${String(i).padStart(3, "0")}`] = { $type: "color", $value: "not a color" };
  doc.tokens = { ...(doc.tokens as object), extra: bad };
  return JSON.stringify(doc);
}

const order = (a: { location: { document: string; pointer: string }; code: string }, b: typeof a) =>
  a.location.pointer < b.location.pointer ? -1 : a.location.pointer > b.location.pointer ? 1 : a.code < b.code ? -1 : a.code > b.code ? 1 : 0;

describe("diagnostic order and cap", () => {
  it("returns exactly 200 findings in order, then OT-LIM-099, identically on repeat", () => {
    const run = () => createCore().registry.admit({ kind: "theme", bytes: manyFindings(), trust: "trusted" }).diagnostics;
    const d = run();
    expect(d).toHaveLength(201);
    expect(d[200]?.code).toBe("OT-LIM-099");
    expect(d.filter((x) => x.code === "OT-LIM-099")).toHaveLength(1);
    const head = d.slice(0, 200).filter((x) => x.location.document === "theme");
    expect([...head].sort(order)).toEqual(head);
    expect(JSON.stringify(run())).toBe(JSON.stringify(d));
  });
});
