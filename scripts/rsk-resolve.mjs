#!/usr/bin/env node
/** rsk-resolve.mjs — patch the beacon to record every _0xfb09(0xNN) decode,
 *  then evaluate it in a headless context so we get the exact strings used. */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

let src = readFileSync('/tmp/opencode/rsk/beacon.js','utf-8');

// Replace the decoder so it records then returns. The decoder text:
//   _0xfb09=function(_0xfb0992,_0x26bcfe){_0xfb0992=_0xfb0992-0xa2;var _0x59fa23=_0x343beb[_0xfb0992];return _0x59fa23;}
src = src.replace(
  /_0xfb09=function\(_0xfb0992,_0x26bcfe\)\{_0xfb0992=_0xfb0992-0xa2;var _0x59fa23=_0x343beb\[_0xfb0992\];return _0x59fa23;\}/,
  `_0xfb09=function(_0xfb0992,_0x26bcfe){_0xfb0992=_0xfb0992-0xa2;var _0x59fa23=_0x343beb[_0xfb0992];try{globalThis.__rskStrings=(globalThis.__rskStrings||[]);globalThis.__rskStrings.push(['0x'+_0xfb0992.toString(16), _0x59fa23]);}catch(_){}return _0x59fa23;}`
);

const ctx = { window: {}, document: { createElement: ()=>({ setAttribute(){}, style:{}, appendChild(){}, addEventListener(){}, getContext: ()=>null, attachEvent(){}, parentNode:{ insertBefore(){} } }), addEventListener(){}, attachEvent(){}, getElementsByTagName: ()=>[ { parentNode:{ insertBefore(){} } } ], location: { protocol:'https:', hostname:'www.boohooman.com' }, cookie:'' }, navigator: { userAgent:'Mozilla/5.0', language:'en-US', platform:'Linux', appName:'', appVersion:'', vendor:'', plugins: [], cookieEnabled:true }, screen: { width:1366, height:900, availWidth:1366, availHeight:900, colorDepth:24 }, localStorage: { getItem:()=>null, setItem(){}, removeItem(){} }, sessionStorage: { getItem:()=>null, setItem(){}, removeItem(){} }, JSON, Math, Date, Array, Object, String, parseInt, parseFloat, isNaN, RegExp, encodeURIComponent, decodeURIComponent, btoa, atob, setTimeout, clearTimeout, setInterval, clearInterval, console, TextEncoder, Uint8Array, Uint32Array, ArrayBuffer, DataView, Blob, XMLHttpRequest: class{}, fetch: async()=>({ok:false}), crypto:{ getRandomValues:(a)=>{for(let i=0;i<a.length;i++)a[i]=0;return a;} } };
// interrupt boot loop: after strings recorded, throw to stop execution
src = src.replace('var _0x525deb=_0xfb09;', 'var _0x525deb=_0xfb09;');
src = src.replace(/try\{globalThis\.__rskStrings[\s\S]*?\}catch\(_\)\{\}/, 'try{globalThis.__rskStrings=(globalThis.__rskStrings||[]);globalThis.__rskStrings.push([\'0x\'+_0xfb0992.toString(16), _0x59fa23]);if(globalThis.__rskStrings.length>4000)throw new Error("enough");}catch(_){}');
vm.createContext(ctx);
try {
  vm.runInContext(src, ctx, { timeout: 20000 });
} catch (e) {
  console.log('eval stop:', String(e).slice(0,120));
}
const strs = ctx.__rskStrings || [];
console.log('decoded strings recorded:', strs.length);
const map = {};
for (const [hex, val] of strs) map[hex] = val;
// resolve the source
const resolved = src
  .replace(/var _0x525deb=_0xfb09;/g, '')
  .replace(/_0xfb09\(0x([0-9a-f]+)\)/g, (_, h) => JSON.stringify(map['0x'+h] ?? '?'))
  .replace(/_0x525deb\(0x([0-9a-f]+)\)/g, (_, h) => JSON.stringify(map['0x'+h] ?? '?'))
  // strip the decoder patch remnants
  .replace(/try\{globalThis\.__rskStrings[\s\S]*?\}catch\(_\)\{\}/g, '');
writeFileSync('/tmp/opencode/rsk/beacon-resolved.js', resolved);
console.log('resolved written:', resolved.length, 'bytes');
