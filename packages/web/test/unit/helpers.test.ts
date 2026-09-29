/** Host input helpers (T023). */
import { afterEach, describe, expect, it } from "vitest";
import { sizeClassForWidth, textScaleFromRoot } from "../../src/index.js";

afterEach(() => document.documentElement.removeAttribute("style"));

describe("sizeClassForWidth", () => {
  it.each([
    [0, "compact"],
    [599, "compact"],
    [599.5, "compact"],
    [600, "medium"],
    [1023, "medium"],
    [1024, "expanded"],
    [4000, "expanded"],
  ])("%d px is %s", (w, c) => expect(sizeClassForWidth(w)).toBe(c));
});

describe("textScaleFromRoot", () => {
  it("is the root font size over 16", () => {
    document.documentElement.style.fontSize = "20px";
    expect(textScaleFromRoot(document)).toBe(1.25);
  });
  it("is 1 when unavailable", () => {
    const detached = document.implementation.createHTMLDocument("x");
    Object.defineProperty(detached, "defaultView", { value: null });
    expect(textScaleFromRoot(detached)).toBe(1);
  });
});
