import { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes, utf8Decode, utf8Encode } from '../bytes';

const samples = [
  '',
  'plain ascii',
  'Ünïcödé café',
  'नमस्ते दुनिया',
  '密码管理器',
  'emoji 🔐🗝️ and 👩🏽‍💻',
  'quotes " \' \\ and newlines\n\t',
  JSON.stringify({ title: 'GitHub', password: 'k7#Rm2!vQp9$Lx', notes: 'ñ' }),
];

describe('utf8', () => {
  it.each(samples)('round-trips %j', (text) => {
    const bytes = utf8Encode(text);
    expect(Array.from(bytes)).toEqual(Array.from(Buffer.from(text, 'utf8')));
    expect(utf8Decode(bytes)).toBe(text);
  });

  it('replaces a lone surrogate like TextEncoder does', () => {
    const lone = 'a\ud800b';
    expect(Array.from(utf8Encode(lone))).toEqual(Array.from(Buffer.from(lone, 'utf8')));
  });

  it('decodes invalid sequences to U+FFFD instead of throwing', () => {
    expect(utf8Decode(new Uint8Array([0x61, 0xff, 0x62]))).toBe('a�b');
    expect(utf8Decode(new Uint8Array([0xe2, 0x82]))).toBe('��');
  });

  it('handles large inputs', () => {
    const big = 'x€'.repeat(50_000);
    expect(utf8Decode(utf8Encode(big))).toBe(big);
  });
});

describe('base64', () => {
  it.each([0, 1, 2, 3, 4, 5, 31, 32, 33, 1000])('matches Node for %i random bytes', (n) => {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256);
    const b64 = bytesToBase64(bytes);
    expect(b64).toBe(Buffer.from(bytes).toString('base64'));
    expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(bytes));
  });

  it('rejects garbage', () => {
    expect(() => base64ToBytes('abc$')).toThrow();
    expect(() => base64ToBytes('a')).toThrow();
  });
});

describe('hex', () => {
  it('round-trips', () => {
    const bytes = Uint8Array.from([0, 1, 15, 16, 127, 128, 255]);
    expect(bytesToHex(bytes)).toBe('00010f107f80ff');
    expect(Array.from(hexToBytes('00010f107f80ff'))).toEqual(Array.from(bytes));
    expect(Array.from(hexToBytes('ABCDEF'))).toEqual([0xab, 0xcd, 0xef]);
  });

  it('rejects odd length and non-hex', () => {
    expect(() => hexToBytes('abc')).toThrow();
    expect(() => hexToBytes('zz')).toThrow();
  });
});
