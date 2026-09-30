/** Every command, by name. */
import type { Command } from "../run.js";
import { css } from "./css.js";
import { init } from "./init.js";
import { preview } from "./preview.js";
import { report } from "./report.js";
import { resolveCommand } from "./resolve.js";
import { validate } from "./validate.js";

export const COMMANDS: Readonly<Record<string, Command>> = {
  css,
  init,
  preview,
  report,
  resolve: resolveCommand,
  validate,
};
