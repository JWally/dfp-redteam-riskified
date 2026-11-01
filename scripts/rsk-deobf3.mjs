#!/usr/bin/env node
/** rsk-deobf3.mjs — resolve Riskified beacon strings by running the real
 *  array + rotation + decoder in a VM, then substituting into the source. */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync('/tmp/opencode/rsk/beacon.js','utf-8');

// 1. base array literal
const arrMatch = src.match(/=\[((?:'[^']*'|"[^"]*")(?:,(?:'[^']*'|"[^"]*")){100,})\]/);
let strings = [];
const re = /'([^']*)'|"([^"]*)"/g; let m;
while ((m = re.exec(arrMatch[1]))) strings.push(m[1] !== undefined ? m[1] : m[2]);
console.log('base array:', strings.length);

// 2. Find the array var name (_0x343beb or similar) and its rotation IIFE.
// The structure is: var _0x343beb=[...] ; rotation: (function(_0x..,_0x..){...}(_0x343beb, 0xNN))
const varMatch = src.match(/var (_0x[0-9a-f]+)=\[/);
const arrVar = varMatch[1];
console.log('array var:', arrVar);

// The rotation IIFE is right after the array: (function(a,b){...}(arrVar,0xNN));
// It reassigns arrVar inside. Extract it by balanced parens.
const arrEnd = arrMatch.index + arrMatch[0].length;
let k = arrEnd;
while (k < src.length && /\s/.test(src[k])) k++;
// expect "(function(..."
const rotStart = k;
let depth = 0; let opened = false;
for (; k < src.length; k++) {
  const c = src[k];
  if (c === '(') { depth++; opened = true; }
  else if (c === ')') { depth--; if (opened && depth === 0) { k++; break; } }
}
const rotIIFE = src.slice(rotStart, k);
console.log('rotation IIFE head:', rotIIFE.slice(0,120));

// 3. Run: define base array, run rotation IIFE (reassigns), define decoder.
const sandboxSrc = `
var ${arrVar} = ${JSON.stringify(strings)};
${rotIIFE}
var _0xfb09=function(_0xfb0992,_0x26bcfe){_0xfb0992=_0xfb0992-0xa2;var _0x59fa23=${arrVar}[_0xfb0992];return _0x59fa23;}
globalThis.__dec=function(h){return _0xfb09(h);};
`;
const ctx = {};
vm.createContext(ctx);
try { vm.runInContext(sandboxSrc, ctx); }
catch (e) { console.error('sandbox error:', e.message); process.exit(1); }
const dec = ctx.__dec;

// sanity: decode a few
console.log('sample decoded:', dec(0x123), '|', dec(0x221));

// 4. resolve whole source
const resolved = src
  .replace(/var _0x525deb=_0xfb09;/g, '')
  .replace(/_0xfb09\(0x([0-9a-f]+)\)/g, (_, h) => JSON.stringify(dec('0x'+h)))
  .replace(new RegExp(`var ${arrVar}=\\[[\\s\\S]*?\\];`, 'g'), `// string table (resolved inline)`)
  .replace(rotIIFE, '// rotation applied');

writeFileSync('/tmp/opencode/rsk/beacon-resolved.js', resolved);
console.log('resolved written:', resolved.length, 'bytes');

// 5. dump key funcs
for (const key of ['sendRequestPOST','postRequest','payload_obfuscate','obfuscate','fireEvent']) {
  const i = resolved.indexOf(key);
  if (i >= 0) {
    console.log(`\n===== ${key} @${i} =====`);
    console.log(resolved.slice(i-300, i+1100));
  }
}
