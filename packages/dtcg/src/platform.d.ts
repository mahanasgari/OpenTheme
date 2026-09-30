/**
 * The three platform APIs this package uses, present in every ES2022 runtime it supports (Node.js,
 * browsers); declared here because the package compiles against the plain ES2022 library.
 */
declare class TextEncoder {
  encode(input: string): Uint8Array;
}
declare class TextDecoder {
  constructor(label?: string, options?: { fatal?: boolean });
  decode(input: Uint8Array): string;
}
declare var crypto: { getRandomValues<T extends Uint8Array>(array: T): T };
