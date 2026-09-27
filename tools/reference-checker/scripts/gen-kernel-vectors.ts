/**
 * Generate conformance/fixtures/kernels/*.json golden vectors from the
 * normative TypeScript kernels.
 *
 * Run: pnpm --filter @opentheme/reference-checker gen:kernels
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyKernel,
  fromBits,
  fromHex64,
  toHex64,
  type KernelName,
} from "../src/kernels/index.js";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../conformance/fixtures/kernels",
);

const RULES: Record<KernelName, string> = {
  cbrt: "R-KRN-001",
  log2: "R-KRN-002",
  exp2: "R-KRN-003",
  "srgb-decode": "R-KRN-004",
  "srgb-encode": "R-KRN-005",
  sin: "R-KRN-006",
  cos: "R-KRN-007",
};

function specials(): number[] {
  return [
    0,
    -0,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NaN,
    Number.MIN_VALUE,
    Number.MAX_VALUE,
    fromHex64("0000000000000001"),
    fromHex64("000FFFFFFFFFFFFF"),
    fromHex64("0010000000000000"),
    fromHex64("3C30000000000000"),
    fromHex64("3C2FFFFFFFFFFFFF"),
    1,
    -1,
    8,
    -8,
    0.5,
    2,
  ];
}

function spaced(min: number, max: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = n === 1 ? 0 : i / (n - 1);
    out.push(min + (max - min) * t);
  }
  return out;
}

/** Build values near 2^e for e in [minExp, maxExp]. Generator may use `**`. */
function logSpaced(minExp: number, maxExp: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const e = minExp + ((maxExp - minExp) * i) / Math.max(1, n - 1);
    const exp = Math.round(e);
    const frac = 1 + ((i * 37) % 97) / 97;
    out.push(frac * 2 ** exp);
  }
  return out;
}

function unique(values: number[]): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  for (const v of values) {
    const h = toHex64(v);
    if (seen.has(h)) continue;
    seen.add(h);
    out.push(v);
  }
  return out;
}

function inputsFor(name: KernelName): number[] {
  switch (name) {
    case "cbrt":
      return unique([
        ...specials(),
        ...spaced(-1000, 1000, 400),
        ...logSpaced(-200, 200, 400),
        ...spaced(1, 8, 200),
      ]);
    case "log2":
      return unique([
        0,
        -0,
        -1,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.MIN_VALUE,
        ...spaced(Number.MIN_VALUE, 1, 200),
        ...spaced(1, 2, 200),
        ...logSpaced(-100, 100, 400),
        ...spaced(0.5, 1.5, 200),
      ]);
    case "exp2":
      return unique([
        ...specials(),
        ...spaced(-1100, 1100, 400),
        ...spaced(-0.5, 0.5, 300),
        ...spaced(-20, 20, 300),
        -1075,
        -1074,
        1023,
        1024,
      ]);
    case "srgb-decode":
      return unique([
        ...spaced(0, 1, 800),
        0.04045,
        0.040449999,
        0.040450001,
        ...spaced(-0.1, 1.1, 200),
      ]);
    case "srgb-encode":
      return unique([
        ...spaced(0, 1, 800),
        0.0031308,
        0.003130799,
        0.003130801,
        ...spaced(-0.1, 1.1, 200),
      ]);
    case "sin":
    case "cos":
      return unique([
        ...specials().filter((x) => Number.isFinite(x)),
        ...spaced(-720, 720, 600),
        ...spaced(0, 360, 360),
        45,
        90,
        135,
        180,
        225,
        270,
        315,
        360,
        -45,
        44.999,
        45.001,
      ]);
    default:
      return [];
  }
}

function ensureCount(name: KernelName, values: number[]): number[] {
  const out = [...values];
  let i = 0;
  while (out.length < 1000) {
    const t = (i * 2654435761) >>> 0;
    if (name === "log2") {
      const bits = (BigInt(t) << 20n) & 0x7fffffffffffffffn;
      const v = fromBits(bits === 0n ? 1n : bits);
      out.push(v > 0 ? v : Number.MIN_VALUE);
    } else {
      out.push(fromBits(BigInt(t) << 20n | 0x3ff0000000000000n) - 1.5);
    }
    i += 1;
  }
  return unique(out);
}

mkdirSync(OUT, { recursive: true });

for (const name of Object.keys(RULES) as KernelName[]) {
  const inputs = ensureCount(name, inputsFor(name));
  const vectors: [string, string, string][] = inputs.map((x) => {
    const y = applyKernel(name, x);
    return [name, toHex64(x), toHex64(y)];
  });
  const fixture = {
    kind: "kernel",
    rules: [RULES[name]],
    description: `Golden vectors for the ${name} numeric kernel.`,
    input: { function: name },
    expect: { vectors },
  };
  const path = join(OUT, `${name}.json`);
  writeFileSync(path, `${JSON.stringify(fixture)}\n`, "utf8");
  console.log(`wrote ${path} (${vectors.length} vectors)`);
}
