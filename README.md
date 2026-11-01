# dfp-redteam-riskified — Riskified Beacon (Web)

Riskified's client-side fraud sensor ("Beacon for Web"). Full details in
`RISKIFIED_ASSESSMENT_2026_11_01.md`.

---

## What we observed (the shipped payload)

**Captured the real Beacon** (`https://beacon.riskified.com?shop=<domain>`,
61,808 B) and fully deobfuscated its `_0x` string table (3,329 strings). The
Beacon collects:

```
{ cart_token, shop, page_id, href, events[] }
```

and ships it to `c.riskified.com/v2/client_infos` (XHR POST,
`{"client_info": <obfuscated>}`), with image fallback to `img.riskified.com`
and error pings to `c.riskified.com/e.gif`. The events queue flushes every
**3 seconds** (mouse/key/focus/blur/form events feed it).

**The "obfuscation" is a reversible encoding, not encryption:**

```
payload_obfuscate = b64( encodeURIComponent( JSON.stringify(payload) ) )  +  static char shuffle
```

**No key, no HMAC** — the payload is recoverable from the wire value alone
(same class as SEON's custom cipher). The vendor's fraud *verdict* is server-side.

## The harness

`scripts/rsk-obf-demo.mjs` — rebuilds a realistic payload per the recovered
builder and proves the obfuscation round-trips exactly:

```bash
node scripts/rsk-obf-demo.mjs
```

### Recorded run — obfuscation is reversible (2026-11-01)

```
payload JSON length: 405
obfuscated (b64 of URI-encoded JSON):
JTdCJTIyY2FydF90b2tlbiUyMiUzQSUyMkNhcnQtQ0tjMm5nblBhYWp6NXlPYjg0bDA5T2thViUyMiUyQyUyMnNob3AlMjIlM0ElMjJ3d3cuYm9vaG9vbWFuLmNvbSUyMiUyQyUyMnBhZ2VfaWQlMjIlM0ExNzkz ...

round-trip OK: true

=== readable payload (what Riskified receives after deobfuscation) ===
{
 "cart_token": "Cart-CKc2ngnPaajz5yOb84l09OkaV",
 "shop": "www.boohooman.com",
 "page_id": 1793562000000,
 "href": "https://www.boohooman.com/basket",
 "events": [ { "type": "mousemove", ... }, { "type": "keydown", ... },
             { "type": "focus", ... }, { "type": "blur", ... }, { "type": "submit", ... } ]
}

VERDICT: payload_obfuscate = b64(encodeURIComponent(JSON)) + static char shuffle.
No key, no HMAC — reversible from the wire value alone (same class as SEON).
```

**Proof:** the shipped beacon code contains no key material — only a base64 +
permutation — so the payload it sends is readable and tamperable at the client
boundary. `scripts/rsk-resolve.mjs` is the deobfuscator (recovers all 3,329
strings from the live sensor).

## Status

- 🟢 Read payload: full payload format + obfuscation recovered from the shipped beacon
- 🟢 Tamper with payload: any event/cart_token/shop field editable before send (no integrity)
- 🟡 Mint token: payload is client-constructed (forgeable), but a live beacon POST wasn't captured to prove server acceptance; verdict is server-side

## Files

- `scripts/rsk-obf-demo.mjs` — payload builder + obfuscation round-trip proof
- `scripts/rsk-resolve.mjs`, `rsk-deobf3.mjs` — the deobfuscator (3,329 strings)
- `artifacts/beacon.riskified.com-beacon.js` — the real captured sensor
- `artifacts/beacon-resolved.js` — fully deobfuscated copy
- writeup: `RISKIFIED_ASSESSMENT_2026_11_01.md`
