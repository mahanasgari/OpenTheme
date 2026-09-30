/** Every command, by name. */
import type { Command } from "../run.js";
import { resolveCommand } from "./resolve.js";
import { validate } from "./validate.js";

export const COMMANDS: Readonly<Record<string, Command>> = {
  resolve: resolveCommand,
  validate,
};
