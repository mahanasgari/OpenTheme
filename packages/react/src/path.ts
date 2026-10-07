/**
 * Path rule for useThemeValue (T005): a token path, or `<contract>.<part>.<property>[.<state>]`.
 * The same rule as `opentheme resolve --path`, but unknown paths give undefined instead of an error.
 */
type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

export function pickValue(resolved: unknown, path: string): unknown {
  if (!isRecord(resolved)) return undefined;
  const tokens = isRecord(resolved.tokens) ? resolved.tokens : {};
  if (Object.hasOwn(tokens, path)) return tokens[path];
  const slash = path.indexOf("/");
  if (slash <= 0) return undefined;
  const components = isRecord(resolved.components) ? resolved.components : {};
  const [local, ...segments] = path.slice(slash + 1).split(".");
  const key = `${path.slice(0, slash)}/${local}`;
  let node: unknown = Object.hasOwn(components, key) ? components[key] : undefined;
  for (const seg of segments) node = isRecord(node) && Object.hasOwn(node, seg) ? node[seg] : undefined;
  return segments.length > 0 ? node : undefined;
}
