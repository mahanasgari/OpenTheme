/** The contract's value grammar (contracts/css-output.md "Values"), one expression per shape. */
import { GENERIC_FAMILIES, SYSTEM_COLORS } from "../src/generated/registry.js";

const NUM = String.raw`-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]\d+)?`;
const COLOR = String.raw`(?:rgb\(\d{1,3} \d{1,3} \d{1,3}(?: / ${NUM})?\)|${Object.values(SYSTEM_COLORS).join("|")})`;
const DIM = String.raw`${NUM}(?:px|ms)`;
const STROKE = "(?:solid|dashed|dotted)";
const FAMILY = String.raw`(?:"[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}"|${[...GENERIC_FAMILIES].join("|")})`;

export const VALUE_GRAMMAR: Readonly<Record<string, RegExp>> = {
  color: new RegExp(`^${COLOR}$`),
  dimension: new RegExp(`^${DIM}$`),
  number: new RegExp(`^${NUM}$`),
  families: new RegExp(`^${FAMILY}(?:, ${FAMILY})*$`),
  cubicBezier: new RegExp(`^cubic-bezier\\(${NUM}, ${NUM}, ${NUM}, ${NUM}\\)$`),
  stroke: new RegExp(`^${STROKE}$`),
  border: new RegExp(`^${DIM} ${STROKE} ${COLOR}$`),
  shadow: new RegExp(`^${DIM} ${DIM} ${DIM} ${DIM} ${COLOR}$`),
};

export const matchesGrammar = (value: string): boolean => Object.values(VALUE_GRAMMAR).some((re) => re.test(value));
