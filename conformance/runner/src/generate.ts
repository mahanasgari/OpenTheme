/**
 * Deterministic input.generate expanders (contracts/conformance.md).
 */
export type GenerateSpec = {
  generator: string;
  params?: Record<string, unknown>;
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function setAtPointer(
  doc: Record<string, unknown>,
  pointer: string,
  value: unknown,
): void {
  const parts = pointer
    .split("/")
    .filter(Boolean)
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur: Record<string, unknown> = doc;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]!;
    const next = cur[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

export function expandGenerate(spec: GenerateSpec): Record<string, unknown> {
  const params = spec.params ?? {};
  switch (spec.generator) {
    case "pad-bytes": {
      const base = clone(params.base as Record<string, unknown>);
      const bytes = Number(params.bytes);
      const ext = (base.$extensions as Record<string, unknown>) ?? {};
      let pad = "";
      base.$extensions = { ...ext, "org.opentheme.pad": pad };
      let text = JSON.stringify(base);
      while (Buffer.byteLength(text, "utf8") < bytes) {
        const need = bytes - Buffer.byteLength(text, "utf8");
        pad += "x".repeat(Math.max(1, need));
        base.$extensions = { ...ext, "org.opentheme.pad": pad };
        text = JSON.stringify(base);
      }
      while (Buffer.byteLength(JSON.stringify(base), "utf8") > bytes && pad.length > 0) {
        pad = pad.slice(0, -1);
        base.$extensions = { ...ext, "org.opentheme.pad": pad };
      }
      return base;
    }
    case "nest-depth": {
      const depth = Number(params.depth);
      let nested: unknown = true;
      for (let i = 0; i < depth; i += 1) nested = { n: nested };
      return {
        opentheme: "1.0",
        id: "uid.abcdefghijklmnopqrstuv2345",
        version: "1.0.0",
        name: "Nest",
        provenance: { origin: "user-created" },
        compatibility: { catalog: "1.0" },
        colorSchemes: { supported: ["light"], default: "light" },
        seeds: {
          light: {
            background: { colorSpace: "srgb", components: [1, 1, 1] },
            foreground: { colorSpace: "srgb", components: [0, 0, 0] },
            accent: { colorSpace: "srgb", components: [0.2, 0.4, 0.8] },
          },
          fontFamily: ["sans-serif"],
        },
        $extensions: { nest: nested },
      };
    }
    case "token-count": {
      const base = clone(params.base as Record<string, unknown>);
      const count = Number(params.count);
      const tokens: Record<string, unknown> = {
        ...(base.tokens as Record<string, unknown> | undefined),
        primitive: { $type: "number" },
      };
      const prim = tokens.primitive as Record<string, unknown>;
      for (let i = 0; i < count; i += 1) {
        prim[`n${i}`] = { $value: i };
      }
      base.tokens = tokens;
      return base;
    }
    case "reference-chain": {
      const base = clone(params.base as Record<string, unknown>);
      const length = Number(params.length);
      const tokens: Record<string, unknown> = {
        chain: { $type: "color" },
      };
      const chain = tokens.chain as Record<string, unknown>;
      chain.anchor = {
        $value: { colorSpace: "srgb", components: [0.2, 0.2, 0.2] },
      };
      for (let i = 0; i < length; i += 1) {
        const next =
          i === length - 1 ? "{chain.anchor}" : `{chain.t${i + 1}}`;
        chain[`t${i}`] = { $value: next };
      }
      base.tokens = tokens;
      return base;
    }
    case "derivation-depth": {
      const base = clone(params.base as Record<string, unknown>);
      const depth = Number(params.depth);
      const group: Record<string, unknown> = {
        $type: "color",
        t0: {
          $value: {
            colorSpace: "srgb",
            components: [0.2, 0.2, 0.2],
          },
        },
      };
      for (let i = 1; i <= depth; i += 1) {
        group[`t${i}`] = {
          $derive: {
            op: "color.lightness",
            args: { color: `{chain.t${i - 1}}`, delta: 0 },
          },
        };
      }
      base.tokens = { chain: group };
      return base;
    }
    case "repeat-member": {
      const base = clone(params.base as Record<string, unknown>);
      const pointer = String(params.pointer);
      const count = Number(params.count);
      const template = params.template;
      const map: Record<string, unknown> = {};
      for (let i = 0; i < count; i += 1) {
        map[`item${i}`] = clone(template);
      }
      setAtPointer(base, pointer, map);
      return base;
    }
    case "overlay-count": {
      const base = clone(params.base as Record<string, unknown>);
      const count = Number(params.count);
      base.colorSchemes = {
        supported: ["light", "dark"],
        default: "light",
      };
      const seeds = base.seeds as Record<string, unknown>;
      if (seeds && !seeds.dark) {
        seeds.dark = clone(seeds.light);
      }
      const dims = {
        contrast: ["standard", "high"],
        colorScheme: ["light", "dark"],
        density: ["compact", "standard", "comfortable"],
        sizeClass: ["compact", "medium", "expanded"],
        motion: ["standard", "reduced"],
      };
      const combos: Record<string, string>[] = [];
      for (const contrast of dims.contrast) {
        for (const colorScheme of dims.colorScheme) {
          for (const density of dims.density) {
            for (const sizeClass of dims.sizeClass) {
              for (const motion of dims.motion) {
                combos.push({
                  contrast,
                  colorScheme,
                  density,
                  sizeClass,
                  motion,
                });
              }
            }
          }
        }
      }
      base.contexts = combos.slice(0, count).map((when) => ({
        when,
        tokens: {},
      }));
      return base;
    }
    case "customization-points-count": {
      const base = clone(params.base as Record<string, unknown>);
      const count = Number(params.count);
      const points = [];
      for (let i = 0; i < count; i += 1) {
        points.push({
          id: `p${i}`,
          type: "number",
          target: ["radius.factor"],
          constraints: { range: { min: 0, max: 1, step: 0.1 } },
          default: 0,
        });
      }
      base.customization = { points };
      return base;
    }
    case "long-path": {
      const base = clone(params.base as Record<string, unknown>);
      const pathLength = Number(params.pathLength);
      const segLen = 64;
      const parts: string[] = [];
      let len = 0;
      let i = 0;
      while (len < pathLength) {
        const seg = `a${String(i).padStart(2, "0")}${"b".repeat(segLen - 3)}`;
        parts.push(seg);
        len = parts.join(".").length;
        i += 1;
      }
      let cur: Record<string, unknown> = {};
      const root = cur;
      for (let j = 0; j < parts.length - 1; j += 1) {
        const next: Record<string, unknown> = {};
        cur[parts[j]!] = next;
        cur = next;
      }
      cur[parts[parts.length - 1]!] = {
        $type: "number",
        $value: 1,
      };
      base.tokens = root;
      return base;
    }
    case "long-segment": {
      const base = clone(params.base as Record<string, unknown>);
      const segmentLength = Number(params.segmentLength);
      const seg = `a${"b".repeat(segmentLength - 1)}`;
      base.tokens = {
        [seg]: { $type: "number", $value: 1 },
      };
      return base;
    }
    default:
      throw new Error(`unknown generator: ${spec.generator}`);
  }
}
