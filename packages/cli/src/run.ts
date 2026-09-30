/**
 * Command dispatch (contracts/cli.md): global options, help, version, and exit statuses
 * (research LR6): 0 success, 1 invalid or failed check, 2 usage error, 3 input or output failure.
 */
import { SPEC_VERSION } from "./generated/minimal-theme.js";
import { clean } from "./format.js";
import { InputOutputError, type Io, UsageError } from "./io.js";

export const TOOL_VERSION = "0.1.0-draft.0";

export type Command = (argv: readonly string[], io: Io) => number | Promise<number>;

const HELP = `Usage: opentheme <command> [options] [files]

Commands:
  validate <file...>   Validate themes and host declarations
  resolve <theme>      Resolve a theme for a context
  report <theme>       Accessibility conformance report
  css <theme>          CSS custom properties from the Web adapter
  preview <theme>      A self-contained HTML preview of every mode
  init <file>          Create a new minimal theme
  export <theme>       W3C Design Tokens files, one per mode
  import <tokens>      A theme from a W3C Design Tokens file

Run "opentheme <command> --help" for a command's options.
Exit statuses: 0 success, 1 invalid or failed check, 2 usage error, 3 input or output failure.
`;

export async function run(argv: readonly string[], io: Io, commands: Readonly<Record<string, Command>>): Promise<number> {
  const [name, ...rest] = argv;
  try {
    if (name === undefined || name === "--help" || name === "-h" || name === "help") {
      io.stdout(HELP);
      return name === undefined ? 2 : 0;
    }
    if (name === "--version" || name === "-v") {
      io.stdout(`opentheme ${TOOL_VERSION} (Theme Specification ${SPEC_VERSION})\n`);
      return 0;
    }
    const command = commands[name];
    if (!command) throw new UsageError(`unknown command "${name}"; run "opentheme --help"`);
    return await command(rest, io);
  } catch (e) {
    if (e instanceof UsageError) {
      io.stderr(`opentheme: ${clean(e.message)}\n`);
      return 2;
    }
    if (e instanceof InputOutputError) {
      io.stderr(`opentheme: ${clean(e.message)}\n`);
      return 3;
    }
    throw e;
  }
}
