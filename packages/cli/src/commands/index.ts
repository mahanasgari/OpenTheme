/** Every command, by name. */
import type { Command } from "../run.js";
import { css } from "./css.js";
import { report } from "./report.js";
import { resolveCommand } from "./resolve.js";
import { validate } from "./validate.js";

export const COMMANDS: Readonly<Record<string, Command>> = {
  css,
  report,
  resolve: resolveCommand,
  validate,
};
