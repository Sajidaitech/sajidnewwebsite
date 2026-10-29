# SAJIDMK — Cloudflare R2 integration (first release)

This is a modified copy of the uploaded static website. Design, CSS, layout, hero, navigation and effects remain intact.

## Connected
- CV: https://assets.sajidmk.com/pdf%20file/SajidMehmood%20CV.pdf
- Selected certificates and experience documents mapped to the uploaded public R2 objects
- Azure certificate and some verified images moved to the R2 custom domain; local image fallback is retained
- Cloudflare Pages /api/download streams allowlisted documents with a download disposition
- Cloudflare Pages /api/contact returns region-aware contact details from server-side environment secrets; public JS no longer includes encoded email and phone
- Removed old duplicate index/script/styles from /assets/ so they cannot be served as outdated content

## Deployment
1. Keep your original live site as a backup; publish this ZIP to a **test branch/Pages preview** first.
2. Cloudflare Pages project connects to your GitHub repository. Framework preset=None; build command blank; build output directory=.` (repository root).
3. Put all contents of this ZIP into the root of that repository (index.html, script.js, styles.css, _worker.js, _routes.json, assets/...).
4. Set production environment secrets in Pages > Settings > Variables and Secrets:
   CONTACT_EMAIL, CONTACT_PHONE, INSTAGRAM_URL, APPROVED_COUNTRIES=QA,AE,SA,US,GB,DE,BH,CA,AU,OM,KW,FR
5. Test /api/contact from approved and unapproved regions (server enforces the restriction). Test the CV view and download, certificate viewer, galleries and mobile layout. On localhost, /api/contact will be unavailable without a compatible Pages dev server and contact will fail closed.
6. For R2 files: PDFs/images load from assets.sajidmk.com; keep this custom domain Active. The app will not work correctly on GitHub Pages without a Pages Functions/Workers runtime, especially the download endpoint and region-aware contact API.
7. After confirming the Pages preview, publish to www.sajidmk.com. Preserve DNS records for email.

## IMPORTANT — PRIVACY
Your screenshots show an academic transcript and some experience letters uploaded to the PUBLIC R2 bucket. Anyone with the object URL can retrieve them. Move private records to a separate private bucket and remove public copies if you do not want them exposed. This ZIP deliberately does NOT publish transcript links.

## Scope
- This is a first-stage R2 integration, **not a finished admin CMS**.
- Some Drive links are intentionally retained where exact matching files were not unambiguously identifiable.
- Don't delete your locally hosted original images until all R2 versions have been checked.
- This package is not deployed and has not been tested against your live Cloudflare account.
