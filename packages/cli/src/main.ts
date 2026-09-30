#!/usr/bin/env node
/** The `opentheme` binary. */
import process from "node:process";
import { COMMANDS } from "./commands/index.js";
import { nodeIo } from "./io.js";
import { run } from "./run.js";

process.exitCode = await run(process.argv.slice(2), nodeIo(), COMMANDS);
