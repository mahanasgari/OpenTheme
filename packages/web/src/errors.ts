/** Adapter errors (contracts/public-api.md "Errors"). Core's errors pass through unchanged. */
export type WebErrorKind = "scope-conflict" | "invalid-argument";

export class OpenThemeWebError extends Error {
  readonly kind: WebErrorKind;
  readonly operation: string;

  constructor(kind: WebErrorKind, operation: string, message: string) {
    super(`${kind}: ${message}`);
    this.name = "OpenThemeWebError";
    this.kind = kind;
    this.operation = operation;
  }
}

export const SCOPE_ID = /^[a-z][a-z0-9-]*$/;
/** CSP nonces are base64 or base64url. */
export const NONCE = /^[A-Za-z0-9+/_=-]+$/;
