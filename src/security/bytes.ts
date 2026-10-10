/**
 * Byte/encoding helpers. Pure JS on purpose: Hermes has no reliable
 * TextDecoder, and keeping these free of native modules makes them unit
 * testable.
 */

const HEX_CHARS = '0123456789abcdef';
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64_CHARS.length; i++) table[B64_CHARS.charCodeAt(i)] = i;
  return table;
})();

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += HEX_CHARS[bytes[i] >> 4] + HEX_CHARS[bytes[i] & 15];
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) {
    throw new Error('Invalid hex string');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

export function utf8Encode(str: string): Uint8Array {
  // Every UTF-16 code unit becomes at most 3 bytes (a surrogate pair, two
  // units, becomes 4), so this buffer is always large enough.
  const buf = new Uint8Array(str.length * 3);
  let p = 0;
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) {
      buf[p++] = c;
      continue;
    }
    if (c < 0x800) {
      buf[p++] = 0xc0 | (c >> 6);
      buf[p++] = 0x80 | (c & 63);
      continue;
    }
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        const cp = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00);
        i++;
        buf[p++] = 0xf0 | (cp >> 18);
        buf[p++] = 0x80 | ((cp >> 12) & 63);
        buf[p++] = 0x80 | ((cp >> 6) & 63);
        buf[p++] = 0x80 | (cp & 63);
        continue;
      }
    }
    if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd; // lone surrogate
    buf[p++] = 0xe0 | (c >> 12);
    buf[p++] = 0x80 | ((c >> 6) & 63);
    buf[p++] = 0x80 | (c & 63);
  }
  return buf.slice(0, p);
}

export function utf8Decode(bytes: Uint8Array): string {
  const units: number[] = [];
  let out = '';
  const flush = () => {
    out += String.fromCharCode.apply(null, units);
    units.length = 0;
  };
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    let cp = 0xfffd;
    let need = 0;
    if (b < 0x80) {
      cp = b;
    } else if (b >= 0xc2 && b < 0xe0) {
      need = 1;
      cp = b & 0x1f;
    } else if (b >= 0xe0 && b < 0xf0) {
      need = 2;
      cp = b & 0x0f;
    } else if (b >= 0xf0 && b < 0xf5) {
      need = 3;
      cp = b & 0x07;
    }
    i++;
    if (need > 0) {
      let ok = i + need <= bytes.length;
      for (let k = 0; ok && k < need; k++) {
        const cont = bytes[i + k];
        if ((cont & 0xc0) !== 0x80) ok = false;
        else cp = (cp << 6) | (cont & 0x3f);
      }
      if (ok) {
        i += need;
        const tooSmall = (need === 2 && cp < 0x800) || (need === 3 && cp < 0x10000);
        if (tooSmall || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) cp = 0xfffd;
      } else {
        cp = 0xfffd;
      }
    }
    if (cp > 0xffff) {
      cp -= 0x10000;
      units.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      units.push(cp);
    }
    if (units.length >= 8192) flush();
  }
  flush();
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64_CHARS[n >> 18] + B64_CHARS[(n >> 12) & 63] + B64_CHARS[(n >> 6) & 63] + B64_CHARS[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += B64_CHARS[n >> 18] + B64_CHARS[(n >> 12) & 63] + '==';
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64_CHARS[n >> 18] + B64_CHARS[(n >> 12) & 63] + B64_CHARS[(n >> 6) & 63] + '=';
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[\s=]/g, '');
  if (clean.length % 4 === 1) throw new Error('Invalid base64 string');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => {
      if (i + k >= clean.length) return 0;
      const code = clean.charCodeAt(i + k);
      const val = code < 128 ? B64_LOOKUP[code] : -1;
      if (val < 0) throw new Error('Invalid base64 string');
      return val;
    });
    const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
    out[p++] = n >> 16;
    if (i + 2 < clean.length) out[p++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[p++] = n & 255;
  }
  return out.slice(0, p);
}

/** Overwrite a buffer holding secret material. Best effort under a GC. */
export function wipeBytes(bytes: Uint8Array | null | undefined): void {
  if (bytes) bytes.fill(0);
}
