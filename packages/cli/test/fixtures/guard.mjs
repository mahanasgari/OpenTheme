// Preloaded into the binary under test. It records every import or require of a network, process,
// or code-evaluation module made by JavaScript code (Node's own internal loads are not imports).
import { registerHooks } from "node:module";

const FORBIDDEN = new Set(["net", "http", "https", "http2", "tls", "dns", "dgram", "child_process", "cluster", "worker_threads", "vm", "inspector"]);
const seen = [];
registerHooks({
  resolve(specifier, context, next) {
    if (FORBIDDEN.has(specifier.replace(/^node:/, "").split("/")[0])) seen.push(`${specifier} from ${context.parentURL}`);
    return next(specifier, context);
  },
});
process.on("exit", () => {
  if (seen.length > 0) process.stderr.write(`GUARD: ${seen.join(", ")}\n`);
});
