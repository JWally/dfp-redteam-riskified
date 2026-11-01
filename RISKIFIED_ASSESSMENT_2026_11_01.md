# Riskified Beacon — client assessment (2026-11-01)

**Subject:** Riskified's client-side "Beacon for Web" — the fraud-decision
sensor merchants embed across their sites.
**Method:** captured the real beacon (`https://beacon.riskified.com?shop=<domain>`)
from a live deployment (boohooman.com), full deobfuscation of the `_0x` string
table (3,329 decoded strings), reconstruction of the shipping + obfuscation
mechanism. Read-only; no account, no forwarded telemetry.

> **TL;DR** Riskified's Beacon is a classic **client-sent behavioral sensor**:
> it collects a `{cart_token, shop, page_id, href, events}` payload and ships it
> to `/v2/client_infos` on `c.riskified.com`. The payload "obfuscation"
> (`payload_obfuscate`) is **`b64(encodeURIComponent(JSON)) + a static char
> shuffle` — no key, no HMAC** — reversible from the wire value alone. Same
> design class as SEON's custom cipher: it hides the payload from casual
> inspection, not from a determined RE. The real decision logic is server-side.

---

## 1. How the Beacon loads (the ship path)

```
<script src="https://beacon.riskified.com?shop=<merchant domain>"></script>
```

- Single sensor file, served on request for any `shop` (the merchant's shop
  domain identifies the Riskified account, same as the `X-RISKIFIED-SHOP-DOMAIN`
  API header).
- Recommended coverage: homepage → product → cart → login → **checkout**.
- Sends via XHR POST to `c.riskified.com/v2/client_infos`
  (`{client_info: <obfuscated>}`) with an image fallback to
  `img.riskified.com` and error pings to `c.riskified.com/e.gif`.

## 2. The payload (recovered from the builder)

```js
// RISKX['buildClientInfo']() shape:
{
  cart_token: 'Cart-<...>',      // from RISKX.getCartId()
  shop:        '<merchant domain>',
  page_id:     <ts>,
  href:        shorten(trimHash(location.href)),
  events:      [ {type, t, x, y, k, sel, ...} ]   // queued behavioral events
}
```

- **eventsQueue** is flushed every **3 seconds** (`setInterval(_, 0xbb8)`) and
  on page events (focus/blur/keydown/mousemove/pan/mouseup/form submit).
- The payload is what Riskified uses to decide order legitimacy — sent by the
  client, before/alongside the merchant's order API call.

## 3. The "obfuscation" (fully recovered, fully reversible)

```js
// RISKX_SHUFFLE["string"](payload):
//   step 1: encodeURIComponent( JSON.stringify(payload) )
//   step 2: b64Encode(step1)      // standard base64
//   step 3: RISKX_SHUFFLE.obfuscate(step2)   // static char-permutation shuffle
```

- **No key, no secret, no HMAC.** The shuffle is a static permutation — a
  deobfuscator recovers the plaintext from the wire value alone.
- The wire body is `{"client_info": "<obfuscated>"}` (Content-Type
  application/json; charset=utf-8).

**Proof (script):** `scripts/rsk-obf-demo.mjs` reconstructs a realistic
payload per the recovered builder and shows the exact round-trip
(`obfuscate → deobfuscate → identical JSON`).

## 4. What this means (honest)

- **Readable / tamperable at the client boundary.** Any event, cart_token,
  shop, page_id, or behavioral signal can be read or modified before the
  beacon sends it — the encoding provides no integrity.
- **Client-mintable:** the payload is client-constructed; nothing binds it to
  a server-issued secret. (Whether Riskified's server-side model *acts* on a
  forged beacon is the vendor's decision layer — not assessed here.)
- **Server-decided:** the fraud *verdict* (approve/decline/review) is
  server-side. The Beacon is a **carrier**, not a proof — same honest position
  as every client-sensor in this project.

## 5. Boundary / caveats

- Captured the real beacon + recovered the full mechanism **statically**.
  We did NOT capture a live beacon POST to `c.riskified.com` (the beacon
  requires a full merchant page context with real interactions to fire its
  event flush; our synthetic harness booted the beacon but its event queue
  never populated). The payload shape + obfuscation are recovered directly
  from the shipped code, which is unambiguous.
- No account, no auth, no telemetry forwarded; `boohooman.com`'s public beacon
  is the only asset touched.

## 6. Artifacts

| File | What |
|---|---|
| `artifacts/beacon.riskified.com-beacon.js` | the real 61,808-B sensor (captured) |
| `artifacts/beacon-resolved.js` | full deobfuscation (3,329 strings resolved) |
| `scripts/rsk-resolve.mjs`, `rsk-deobf3.mjs` | the deobfuscator |
| `scripts/rsk-obf-demo.mjs` | payload builder + obfuscation round-trip proof |

## 7. Summary line

> *"Riskified's Beacon for Web is a client-sent behavioral sensor: it collects
> `{cart_token, shop, page_id, href, events}` and ships it to
> `c.riskified.com/v2/client_infos`. The 'obfuscation' is
> `b64(encodeURIComponent(JSON)) + a static char shuffle` — no key, no HMAC,
> reversible from the wire alone. The payload is readable and tamperable at
> the client boundary (same class as SEON); the fraud verdict is server-side."*
