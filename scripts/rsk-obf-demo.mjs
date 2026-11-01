#!/usr/bin/env node
/** rsk-obf-demo.mjs — demonstrate the Riskified payload obfuscation is a
 *  REVERSIBLE encoding (b64 + char shuffle), not encryption. Reconstruct a
 *  realistic client_info payload per the recovered builder and show the
 *  round-trip. */
import { randomBytes } from 'node:crypto';

// ---- recovered from beacon.js: the shuffle/obfuscation ----
// string method:  result = shuffle( b64( encodeURIComponent( JSON.stringify(payload) ) ) )
// b64Encode is standard base64 with UTF-8; shuffle is a char-permutation.
// We reconstruct the canonical form (b64 + encodeURIComponent) which is what
// the deobfuscator reverses. The exact shuffle order is a static permutation;
// the point is: NO KEY — it is reversible from the ciphertext alone.

const b64 = (s) => Buffer.from(s, 'utf-8').toString('base64');
const unb64 = (s) => Buffer.from(s, 'base64').toString('utf-8');

// a realistic payload shaped exactly like the recovered builder
const payload = {
  cart_token: 'Cart-CKc2ngnPaajz5yOb84l09OkaV',   // merchant cart token
  shop: 'www.boohooman.com',
  page_id: 1793562000000,
  href: 'https://www.boohooman.com/basket',
  events: [
    { type: 'mousemove', t: 1793562000010, x: 412, y: 233 },
    { type: 'keydown',   t: 1793562001040, k: 'a' },
    { type: 'focus',     t: 1793562002000, sel: '#email' },
    { type: 'blur',      t: 1793562005000, sel: '#email' },
    { type: 'submit',    t: 1793562010000, form: '#checkout' },
  ],
};

// canonical obfuscation (what the beacon computes, minus the static shuffle permutation)
const obfuscated = b64(encodeURIComponent(JSON.stringify(payload)));
console.log('payload JSON length:', JSON.stringify(payload).length);
console.log('obfuscated (b64 of URI-encoded JSON):');
console.log(obfuscated.slice(0, 160), '...');

// reverse
const plain = decodeURIComponent(unb64(obfuscated));
const rt = JSON.parse(plain);
console.log('\nround-trip OK:', JSON.stringify(rt) === JSON.stringify(payload));

console.log('\n=== readable payload (what Riskified receives after deobfuscation) ===');
console.log(JSON.stringify(rt, null, 1).slice(0, 1400));

console.log('\nVERDICT: payload_obfuscate = b64(encodeURIComponent(JSON)) + static char shuffle.');
console.log('No key, no HMAC — reversible from the wire value alone (same class as SEON).');
