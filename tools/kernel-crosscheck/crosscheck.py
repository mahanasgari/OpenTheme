#!/usr/bin/env python3
"""Bit-exact cross-check of kernel golden vectors against the Python kernels."""

from __future__ import annotations

import json
import random
import struct
import subprocess
import sys
from pathlib import Path

from kernels import KERNELS, apply_kernel, to_hex64

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "conformance" / "fixtures" / "kernels"


def main() -> int:
    if not FIXTURES.is_dir():
        print("kernels:crosscheck: no fixtures directory", file=sys.stderr)
        return 1
    files = sorted(FIXTURES.glob("*.json"))
    if not files:
        print("kernels:crosscheck: no fixture files", file=sys.stderr)
        return 1

    mismatches = 0
    total = 0
    for path in files:
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("kind") != "kernel":
            print(f"skip {path.name}: kind != kernel")
            continue
        vectors = data["expect"]["vectors"]
        for fn, in_hex, out_hex in vectors:
            total += 1
            x_bits = int(in_hex, 16)
            # Reconstruct float from bits
            import struct

            x = struct.unpack(">d", struct.pack(">Q", x_bits))[0]
            y = apply_kernel(fn, x)
            got = to_hex64(y)
            want = out_hex.upper()
            if got != want:
                mismatches += 1
                if mismatches <= 20:
                    print(
                        f"MISMATCH {path.name} {fn}({in_hex}): got {got} want {want}",
                        file=sys.stderr,
                    )

    if mismatches:
        print(
            f"kernels:crosscheck: FAILED {mismatches}/{total} mismatches",
            file=sys.stderr,
        )
        return 1
    print(f"kernels:crosscheck: OK ({total} vectors across {len(files)} files)")
    return 0


CORE = ROOT / "packages" / "core" / "dist" / "internal-conformance.js"
# Domains of the kernels (inputs outside them are not meaningful to compare).
DOMAINS = {
    "cbrt": (-1e300, 1e300),
    "log2": (1e-300, 1e300),
    "exp2": (-1070.0, 1023.0),
    "srgb-decode": (0.0, 1.0),
    "srgb-encode": (0.0, 1.0),
    "sin": (-1e6, 1e6),
    "cos": (-1e6, 1e6),
}


def bits(x: float) -> str:
    return "%016X" % struct.unpack(">Q", struct.pack(">d", x))[0]


def core_inputs(per_kernel: int) -> list[tuple[str, str]]:
    """Golden-vector inputs plus seeded random inputs across each kernel's domain."""
    rng = random.Random(20260926)
    out: list[tuple[str, str]] = []
    for path in sorted(FIXTURES.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("kind") == "kernel":
            out.extend((fn, in_hex.upper()) for fn, in_hex, _ in data["expect"]["vectors"])
    for fn, (lo, hi) in DOMAINS.items():
        for i in range(per_kernel):
            if i % 2 == 0:
                x = rng.uniform(lo, hi)
            else:  # log-uniform magnitudes reach extreme exponents
                x = 2.0 ** rng.uniform(-60, 60) * (1 if lo >= 0 else rng.choice((-1, 1)))
                x = min(max(x, lo), hi)
            out.append((fn, bits(x)))
    return out


def check_core(per_kernel: int = 5000) -> int:
    """Core's kernels (packages/core) must equal the Python kernels bit for bit (task T118)."""
    if not CORE.is_file():
        print("kernels:crosscheck: build packages/core first (pnpm build)", file=sys.stderr)
        return 1
    inputs = core_inputs(per_kernel)
    script = (
        "import('" + CORE.as_uri() + "').then(({ KERNELS, fromHex64, toHex64 }) => {"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "const out=JSON.parse(d).map(([f,h])=>toHex64(KERNELS[f](fromHex64(h))));"
        "process.stdout.write(JSON.stringify(out));});});"
    )
    run = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        input=json.dumps(inputs), capture_output=True, text=True, check=False,
    )
    if run.returncode != 0:
        print(run.stderr, file=sys.stderr)
        return 1
    core = json.loads(run.stdout)
    mismatches = 0
    for (fn, in_hex), got in zip(inputs, core):
        x = struct.unpack(">d", struct.pack(">Q", int(in_hex, 16)))[0]
        want = to_hex64(apply_kernel(fn, x))
        if got.upper() != want:
            mismatches += 1
            if mismatches <= 20:
                print(f"CORE MISMATCH {fn}({in_hex}): core {got} python {want}", file=sys.stderr)
    if mismatches:
        print(f"kernels:crosscheck: core FAILED {mismatches}/{len(inputs)}", file=sys.stderr)
        return 1
    print(f"kernels:crosscheck: core OK ({len(inputs)} inputs across {len(KERNELS)} kernels)")
    return 0


if __name__ == "__main__":
    status = main()
    if status == 0 and "--no-core" not in sys.argv:
        status = check_core()
    raise SystemExit(status)
