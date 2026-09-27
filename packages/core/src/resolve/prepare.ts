/**
 * Prepared themes (FR-C071, FR-C072; tasks T055, T064, T086): per-Core, bounded reuse of the
 * expensive, pure results for frozen documents — validation (flattened chain, parsed derivations,
 * dependency checks) and per-mode evaluations. Keys cover every input: the document, the host
 * declaration, and, for an inheriting theme, the ordered bases with their trust. A re-resolution
 * after a context change reuses them and reruns only the resolution stages. Capacity 0 disables it.
 */
import { Lru } from "./cache.js";

const objectIds = new WeakMap<object, number>();
let nextObjectId = 0;

/** A stable number for an object's identity (keys only; nothing is retained). */
export function objectId(o: object): number {
  let id = objectIds.get(o);
  if (id === undefined) {
    id = nextObjectId += 1;
    objectIds.set(o, id);
  }
  return id;
}

/** Modes per prepared theme: two color schemes × two contrast levels. */
const MODES_PER_THEME = 4;

export class Prepared {
  readonly validations: Lru<unknown>;
  readonly modes: Lru<unknown>;

  constructor(preparedThemes: number) {
    this.validations = new Lru(preparedThemes);
    this.modes = new Lru(preparedThemes * MODES_PER_THEME);
  }

  /** `null` when an input is not frozen: only immutable inputs can be reused safely. */
  static key(
    doc: Readonly<Record<string, unknown>>,
    host: Readonly<Record<string, unknown>> | null,
    bases?: readonly { readonly trust: string; readonly document: Readonly<Record<string, unknown>> }[],
  ): string | null {
    if (!Object.isFrozen(doc) || (host && !Object.isFrozen(host))) return null;
    let key = `${objectId(doc)}|${host ? objectId(host) : "-"}`;
    if (doc.extends !== undefined) {
      for (const b of bases ?? []) {
        if (!Object.isFrozen(b.document)) return null;
        key += `|${b.trust[0]}${objectId(b.document)}`;
      }
    }
    return key;
  }
}
