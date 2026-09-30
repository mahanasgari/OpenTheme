/**
 * Name conversion for imported tokens (research IR5; finding D3). Imported tokens live under the
 * `primitive` group, so every converted segment is a later segment (`[a-z0-9][a-z0-9-]*`, chapter
 * 03): lowercase, characters outside `[a-z0-9-]` become `-`, runs of `-` collapse, and leading and
 * trailing `-` are removed. An empty or over-long result is not a name.
 */
const MAX_SEGMENT = 64;

export function convertSegment(segment: string): string | null {
  const s = segment
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s.length === 0 || s.length > MAX_SEGMENT ? null : s;
}

export function convertPath(segments: readonly string[]): string | null {
  const out: string[] = [];
  for (const s of segments) {
    const c = convertSegment(s);
    if (c === null) return null;
    out.push(c);
  }
  return out.join(".");
}
