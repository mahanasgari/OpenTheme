/** Token path grammar (chapter 03, FR-019). */

const SEGMENT = /^[a-z][a-z0-9-]*$/;
const MAX_SEGMENT = 64;
const MAX_TOTAL = 256;

export function isValidSegment(segment: string): boolean {
  return segment.length <= MAX_SEGMENT && SEGMENT.test(segment);
}

export function isValidPath(path: string): boolean {
  if (path.length === 0 || path.length > MAX_TOTAL) return false;
  const parts = path.split(".");
  return parts.every(isValidSegment);
}

/** Parse `{path}` alias syntax. Returns null if not an alias string. */
export function parseAlias(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^\{([^{}]+)\}$/.exec(value);
  if (!m) return null;
  return m[1] ?? null;
}

/** Host-qualified path: `hostId/path` or plain `path`. */
export function splitQualifiedPath(path: string): {
  hostId: string | null;
  tokenPath: string;
} {
  const slash = path.indexOf("/");
  if (slash <= 0) return { hostId: null, tokenPath: path };
  return {
    hostId: path.slice(0, slash),
    tokenPath: path.slice(slash + 1),
  };
}

export function joinPath(parts: string[]): string {
  return parts.join(".");
}
