import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type TransformId = string;

export interface ArgDomain {
  min?: number;
  max?: number;
  opaque?: boolean;
  minItems?: number;
  maxItems?: number;
}

export interface TransformArg {
  name: string;
  type: string;
  domain?: ArgDomain;
  optional: boolean;
}

export interface TransformDef {
  id: TransformId;
  description: string;
  outputType: string;
  effortCost: number;
  arguments: TransformArg[];
}

interface RegistryFile {
  transformations: TransformDef[];
}

let cached: Map<string, TransformDef> | undefined;

function registryPath(): string {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specification/registry/1.0/transformations.json",
  );
}

export function loadTransformRegistry(): Map<string, TransformDef> {
  if (cached) return cached;
  const data = JSON.parse(readFileSync(registryPath(), "utf8")) as RegistryFile;
  cached = new Map(data.transformations.map((t) => [t.id, t]));
  return cached;
}

export function getTransform(id: string): TransformDef | undefined {
  return loadTransformRegistry().get(id);
}

export function transformEffort(id: string): number {
  const t = getTransform(id);
  if (!t) throw new Error(`unknown transform: ${id}`);
  return t.effortCost;
}
