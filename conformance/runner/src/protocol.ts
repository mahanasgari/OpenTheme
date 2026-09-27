/**
 * Spawn an implementation adapter and exchange NDJSON protocol messages.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

const REQUEST_TIMEOUT_MS = 10_000;

export type ProtocolClient = {
  supports: string[];
  implementation: string;
  version: string;
  request: (
    id: string,
    kind: string,
    input: unknown,
  ) => Promise<{ result?: unknown; unsupported?: boolean; error?: string }>;
  close: () => Promise<void>;
};

function parseCommand(command: string): { cmd: string; args: string[] } {
  // Simple split on spaces; quote support not required for default ot-ref path.
  const parts = command.trim().split(/\s+/);
  return { cmd: parts[0]!, args: parts.slice(1) };
}

export async function connectImpl(command: string): Promise<ProtocolClient> {
  const { cmd, args } = parseCommand(command);
  const child: ChildProcessWithoutNullStreams = spawn(cmd, args, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const pending = new Map<
    string,
    {
      resolve: (v: {
        result?: unknown;
        unsupported?: boolean;
        error?: string;
      }) => void;
      reject: (e: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();

  let helloResolve!: (v: {
    supports: string[];
    implementation: string;
    version: string;
  }) => void;
  let helloReject!: (e: Error) => void;
  const helloPromise = new Promise<{
    supports: string[];
    implementation: string;
    version: string;
  }>((resolve, reject) => {
    helloResolve = resolve;
    helloReject = reject;
  });

  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return;
    }
    if (msg.type === "hello") {
      helloResolve({
        supports: (msg.supports as string[]) ?? [],
        implementation: String(msg.implementation ?? ""),
        version: String(msg.version ?? ""),
      });
      return;
    }
    if (msg.type === "response") {
      const id = String(msg.id ?? "");
      const waiter = pending.get(id);
      if (!waiter) return;
      clearTimeout(waiter.timer);
      pending.delete(id);
      if (msg.unsupported === true) {
        waiter.resolve({ unsupported: true });
      } else {
        waiter.resolve({ result: msg.result });
      }
    }
  });

  child.stderr.on("data", () => {
    /* swallow impl stderr; available via --verbose later */
  });

  child.on("error", (err) => {
    helloReject(err);
    for (const [, w] of pending) {
      clearTimeout(w.timer);
      w.reject(err);
    }
    pending.clear();
  });

  child.stdin.write(
    JSON.stringify({ type: "hello", protocol: "1", spec: "1.0" }) + "\n",
  );

  const helloTimer = setTimeout(() => {
    helloReject(new Error("hello handshake timeout"));
  }, REQUEST_TIMEOUT_MS);

  let hello: {
    supports: string[];
    implementation: string;
    version: string;
  };
  try {
    hello = await helloPromise;
  } finally {
    clearTimeout(helloTimer);
  }

  return {
    supports: hello.supports,
    implementation: hello.implementation,
    version: hello.version,
    request(id, kind, input) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`request timeout: ${id}`));
        }, REQUEST_TIMEOUT_MS);
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(
          JSON.stringify({ type: "request", id, kind, input }) + "\n",
        );
      });
    },
    async close() {
      child.stdin.write(JSON.stringify({ type: "bye" }) + "\n");
      child.stdin.end();
      await new Promise<void>((resolve) => {
        child.on("close", () => resolve());
        setTimeout(() => {
          child.kill();
          resolve();
        }, 2000);
      });
      rl.close();
    },
  };
}
