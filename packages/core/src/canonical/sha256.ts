/**
 * SHA-256 (FIPS 180-4) and standard base64, pure and synchronous (research CR5).
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** UTF-8 encode a JS string (lone surrogates are not expected: inputs are validated I-JSON). */
export function utf8Encode(s: string): Uint8Array {
  // At most 3 bytes per UTF-16 code unit (a surrogate pair is 2 units for 4 bytes).
  const out = new Uint8Array(s.length * 3);
  let j = 0;
  for (let i = 0; i < s.length; i += 1) {
    let cp = s.charCodeAt(i);
    if (cp < 0x80) {
      out[j++] = cp;
      continue;
    }
    if (cp >= 0xd800 && cp <= 0xdbff) {
      cp = 0x10000 + ((cp - 0xd800) << 10) + (s.charCodeAt(i + 1) - 0xdc00);
      i += 1;
    }
    if (cp < 0x800) {
      out[j++] = 0xc0 | (cp >> 6);
      out[j++] = 0x80 | (cp & 0x3f);
    } else if (cp < 0x10000) {
      out[j++] = 0xe0 | (cp >> 12);
      out[j++] = 0x80 | ((cp >> 6) & 0x3f);
      out[j++] = 0x80 | (cp & 0x3f);
    } else {
      out[j++] = 0xf0 | (cp >> 18);
      out[j++] = 0x80 | ((cp >> 12) & 0x3f);
      out[j++] = 0x80 | ((cp >> 6) & 0x3f);
      out[j++] = 0x80 | (cp & 0x3f);
    }
  }
  return out.subarray(0, j);
}

/** A streaming SHA-256 (FIPS 180-4): bytes go into a 64-byte block, compressed when full. */
class Sha256 {
  readonly #h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  readonly #w = new Uint32Array(64);
  readonly #block = new Uint8Array(64);
  #used = 0;
  #length = 0;

  byte(v: number): void {
    this.#block[this.#used++] = v;
    this.#length += 1;
    if (this.#used === 64) this.#compress();
  }

  digest(): Uint8Array {
    const bitLength = this.#length * 8;
    this.byte(0x80);
    while (this.#used !== 56) this.byte(0);
    const hi = Math.floor(bitLength / 0x100000000);
    const lo = bitLength >>> 0;
    for (const word of [hi, lo]) for (let k = 24; k >= 0; k -= 8) this.byte((word >>> k) & 0xff);
    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i += 1) {
      const v = this.#h[i]!;
      out[i * 4] = v >>> 24;
      out[i * 4 + 1] = (v >>> 16) & 0xff;
      out[i * 4 + 2] = (v >>> 8) & 0xff;
      out[i * 4 + 3] = v & 0xff;
    }
    return out;
  }

  #compress(): void {
    const w = this.#w;
    const blk = this.#block;
    const h = this.#h;
    const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
    for (let t = 0; t < 16; t += 1) {
      const o = t * 4;
      w[t] = ((blk[o]! << 24) | (blk[o + 1]! << 16) | (blk[o + 2]! << 8) | blk[o + 3]!) >>> 0;
    }
    for (let t = 16; t < 64; t += 1) {
      const x = w[t - 15]!;
      const y = w[t - 2]!;
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) >>> 0;
    }
    let a = h[0]!;
    let b = h[1]!;
    let c = h[2]!;
    let d = h[3]!;
    let e = h[4]!;
    let f = h[5]!;
    let g = h[6]!;
    let hh = h[7]!;
    for (let t = 0; t < 64; t += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + K[t]! + w[t]!) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0;
    h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0;
    h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0;
    h[5] = (h[5]! + f) >>> 0;
    h[6] = (h[6]! + g) >>> 0;
    h[7] = (h[7]! + hh) >>> 0;
    this.#used = 0;
  }
}

export function sha256(data: Uint8Array): Uint8Array {
  const hash = new Sha256();
  for (let i = 0; i < data.length; i += 1) hash.byte(data[i]!);
  return hash.digest();
}

/**
 * SHA-256 of a string's UTF-8 encoding, encoded on the fly (no intermediate byte buffer). Equal
 * to `sha256(utf8Encode(s))` (tested); lone surrogates are not expected (validated I-JSON).
 */
export function sha256Utf8(s: string): Uint8Array {
  const hash = new Sha256();
  for (let i = 0; i < s.length; i += 1) {
    let cp = s.charCodeAt(i);
    if (cp < 0x80) {
      hash.byte(cp);
      continue;
    }
    if (cp >= 0xd800 && cp <= 0xdbff) {
      cp = 0x10000 + ((cp - 0xd800) << 10) + (s.charCodeAt(i + 1) - 0xdc00);
      i += 1;
    }
    if (cp < 0x800) {
      hash.byte(0xc0 | (cp >> 6));
      hash.byte(0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      hash.byte(0xe0 | (cp >> 12));
      hash.byte(0x80 | ((cp >> 6) & 0x3f));
      hash.byte(0x80 | (cp & 0x3f));
    } else {
      hash.byte(0xf0 | (cp >> 18));
      hash.byte(0x80 | ((cp >> 12) & 0x3f));
      hash.byte(0x80 | ((cp >> 6) & 0x3f));
      hash.byte(0x80 | (cp & 0x3f));
    }
  }
  return hash.digest();
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : B64[b2 & 63];
  }
  return out;
}
