import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runHostCoverage } from "../src/checks/host-coverage.js";
import { connectImpl, type ProtocolClient } from "../src/protocol.js";
import { runAccentSweep } from "../src/sweeps/accents.js";
import { inProcessImpl, protocolImpl } from "../src/sweeps/impl.js";
import { runOfficialThemeSweep } from "../src/sweeps/official.js";
import { runSeedSweep } from "../src/sweeps/seeds.js";

const here = dirname(fileURLToPath(import.meta.url));
const refChecker = resolve(here, "../../../tools/reference-checker/dist/cli/main.js");

describe("sweeps over the runner protocol (prerequisite P2)", () => {
  let client: ProtocolClient;

  beforeAll(async () => {
    client = await connectImpl(`node ${refChecker} serve-conformance`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("gives the same seed-sweep outcome in-process and over the protocol", async () => {
    const a = await runSeedSweep(inProcessImpl(), { limit: 40 });
    const b = await runSeedSweep(protocolImpl(client), { limit: 40 });
    expect(b).toEqual(a);
    expect(a.resolutions).toBeGreaterThan(0);
    expect(a.failures).toEqual([]);
  });

  it("gives the same accent-sweep outcome in-process and over the protocol", async () => {
    const a = await runAccentSweep(inProcessImpl(), { limit: 5 });
    const b = await runAccentSweep(protocolImpl(client), { limit: 5 });
    expect(b).toEqual(a);
    expect(a.failures).toEqual([]);
  });

  it("gives the same official-theme and host-coverage outcomes", async () => {
    expect(await runOfficialThemeSweep(protocolImpl(client))).toEqual(
      await runOfficialThemeSweep(inProcessImpl()),
    );
    expect(await runHostCoverage(protocolImpl(client))).toEqual(
      await runHostCoverage(inProcessImpl()),
    );
  });
}, 120_000);
