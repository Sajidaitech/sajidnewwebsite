# sajidmk.com — Contact visibility (Stage 3: frontend integration)

> **Note:** no previous README or project ZIP was provided for this stage — only
> `index.html`, `script.js`, `styles.css`, `_worker.js` and `_routes.json`. This README was
> written from those files. If you have an older README with other sections (deployment
> notes, analytics, etc.), merge this section into it rather than replacing it.

## What it does

The page calls the same-origin endpoint `GET /api/contact`, served by `_worker.js`
(Cloudflare Pages advanced mode; `_routes.json` sends only `/api/*` through the worker).

| Visitor | Visible contact links |
|---|---|
| Approved country (human browser) | Email, Phone (`tel:`), WhatsApp, Instagram, LinkedIn |
| Any other country, unknown location, Tor, bots | Instagram + LinkedIn |
| API fails / times out (8 s) / returns bad data | LinkedIn, plus Instagram only if `INSTAGRAM_FALLBACK` is set (see below) |

Email, phone and WhatsApp never appear in `index.html`, `script.js` or `styles.css`.
They exist only in Cloudflare environment variables and are returned by the API to approved visitors.
LinkedIn is a public link and is always in the HTML.

## Changed files

| File | Change |
|---|---|
| `index.html` | Added Call (`data-contact="phone"`) icon links to the side rail and contact pills (hidden by default, same classes as the email icons). Marked the large "Message me on Instagram" button `data-contact-only="social"`. |
| `script.js` | Rewrote the `[JS-17b]` contact block (validation, phone, Instagram in both modes, timeout, fallback). Added a "Call" action to the Ctrl/⌘+K console. |
| `_worker.js` | Full response now also includes `instagram` (one line + one comment). Needed so approved visitors get Instagram from the same source. |

Unchanged: `styles.css`, `_routes.json`. No new CSS was needed (existing classes and the global `[hidden]{display:none!important}` rule are reused).

## Behaviour details

- **No duplicates:** each link type has fixed placeholders in the HTML that are only un-hidden and given an `href`. Nothing is inserted into the DOM. In full view the large Instagram button stays hidden (Instagram remains available in the rail and pills); in social view it is the primary button.
- **Validation:** Instagram must be `https://` on `instagram.com`; WhatsApp must be `https://wa.me/…`; email must be a simple valid address; phone is reduced to `+` and digits (6–15). Anything invalid is simply not shown.
- **Failure:** non-200, network error, timeout and non-JSON responses (e.g. a static host with no worker) all fall back to the social view.
- The QR code / vCard, command console and all other modules wait on the same single API answer.

## Configure

1. Cloudflare Pages project → Settings → Variables and Secrets (Production and Preview):
   `CONTACT_EMAIL`, `CONTACT_PHONE` (international format, e.g. `+974XXXXXXXX`), `INSTAGRAM_URL`
   (`https://www.instagram.com/yourhandle/`), optional `APPROVED_COUNTRIES` (comma-separated ISO codes).
2. Deploy the five files at the project root (`_worker.js` and `_routes.json` must be in the deployed output root).
3. Optional: in `script.js`, set `INSTAGRAM_FALLBACK` (inside `contactVisibility`) to your public Instagram URL so the Instagram button still appears when the API is down. It is empty by default.

## Test

**Locally** (needs Node; not tested in this delivery):
```
echo "CONTACT_EMAIL=test@example.test" >  .dev.vars
echo "CONTACT_PHONE=+97400000000"      >> .dev.vars
echo "INSTAGRAM_URL=https://www.instagram.com/test/" >> .dev.vars
echo "DEV_COUNTRY=QA"                  >> .dev.vars
npx wrangler pages dev .
```
Open the printed localhost URL. With `DEV_COUNTRY=QA` you should see email, call, WhatsApp, Instagram and LinkedIn icons; change it to `IN` and restart: Instagram + LinkedIn only (large Instagram button visible). `DEV_COUNTRY` is ignored on the live domain.

**Live site:**
- DevTools → Network → `/api/contact`: check `mode` and fields. Then View Source / search the Sources tab for your email and phone — they should not be present in any file.
- From an approved country (or a VPN exit there): all five links. From a non-approved country: Instagram + LinkedIn only.
- Block `/api/contact` in DevTools (Request blocking) and reload: social fallback, no layout gaps.
- `curl -A "Mozilla/5.0" https://www.sajidmk.com/api/contact` — plain `curl` is deliberately treated as a bot by the worker and always gets the social answer.
- Check the contact section and side rail at mobile width.

## Known considerations

- **QR code privacy:** the existing QR card builds a vCard in the browser and sends it inside the URL to `api.qrserver.com` / `quickchart.io` to render the image. For approved visitors that vCard includes your email and phone, so those third-party services receive them. This was left unchanged (not part of this stage); generating the QR locally would avoid it.
- The bot filter is best-effort; a determined scraper using a browser User-Agent from an approved country can still read the API.
- Country comes from Cloudflare's IP geolocation; VPN users are treated by their exit location.

## What was verified in this delivery

- `script.js` passes `node --check`.
- The worker logic was run in Node with mocked requests and dummy values: approved country → full; other/unknown/`XX`/`T1`/bot User-Agent/missing config → social.
- The real extracted frontend contact block was run against a stubbed DOM for: approved, social, HTTP 500, network error, non-JSON body, `javascript:` Instagram URL, look-alike Instagram host, invalid email, invalid phone/WhatsApp.
- Text scan of all five final files: no email addresses or phone numbers (only the `you@example.com` form placeholder).

**Not tested:** real Cloudflare deployment or geolocation, browser rendering, visual/mobile layout, the QR image providers, analytics/feedback/visitor-counter code paths (not modified).
