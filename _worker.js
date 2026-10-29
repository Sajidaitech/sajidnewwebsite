/**
 * _worker.js — Cloudflare Pages (advanced mode) for sajidmk.com
 *
 * Decides, on the SERVER, whether a visitor may see Sajid's email and phone.
 *   • Visitor in an approved country  -> full contact details (+ Instagram)
 *   • Anyone else (or unknown/Tor/bot) -> Instagram link only
 *
 * The private details live in Cloudflare environment variables, never in
 * index.html, script.js or this file, so they are not in the page source
 * for visitors outside the approved countries.
 *
 * Environment variables (Pages project > Settings > Variables and Secrets):
 *   CONTACT_EMAIL       required   e.g. you@example.com
 *   CONTACT_PHONE       required   international format, e.g. +974XXXXXXXX
 *   INSTAGRAM_URL       required   e.g. https://www.instagram.com/yourhandle/
 *   APPROVED_COUNTRIES  optional   comma list of ISO codes; overrides the default below
 *
 * Only /api/contact runs through this worker (see _routes.json);
 * everything else is served as plain static files.
 */

// Approved ISO 3166-1 alpha-2 country codes. Edit here, or set APPROVED_COUNTRIES.
const DEFAULT_APPROVED = 'QA,AE,SA,US,GB,DE,BH,CA,AU,OM,KW,FR';

// Best-effort filter for crawlers, scrapers and link-preview fetchers.
// Search engines run from the US (an approved country), so without this
// they could read and index the email address.
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|phantom|puppeteer|playwright|selenium|curl|wget|python|scrapy|httpclient|axios|node-fetch|go-http|java\/|libwww|okhttp|apache/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.replace(/\/+$/, '') === '/api/contact') {
      return handleContact(request, env, url);
    }
    if (url.pathname === '/api/download') {
      return handleDownload(request, url);
    }
    // Everything else: normal static site.
    return env.ASSETS.fetch(request);
  },
};

function handleContact(request, env, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return reply({ error: 'method_not_allowed' }, 405, { Allow: 'GET, HEAD' });
  }

  const country = getCountry(request, env, url);
  const approved = toSet(env.APPROVED_COUNTRIES || DEFAULT_APPROVED);
  const ua = request.headers.get('user-agent') || '';
  const looksAutomated = !ua || BOT_UA.test(ua);

  const email = String(env.CONTACT_EMAIL || '').trim();
  const phone = String(env.CONTACT_PHONE || '').trim();
  const instagram = cleanInstagram(env.INSTAGRAM_URL);

  // Fail closed: unknown country, bot, or missing config => social view.
  if (!looksAutomated && approved.has(country) && email) {
    const digits = phone.replace(/\D/g, '');
    return reply({
      mode: 'full',
      email,
      phone,
      whatsapp: digits ? 'https://wa.me/' + digits : '',
      instagram,
    });
  }

  return reply({ mode: 'social', instagram });
}

function getCountry(request, env, url) {
  // Local testing only (wrangler pages dev, set DEV_COUNTRY in .dev.vars).
  // Ignored on the live site, so it can never be used as a bypass.
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (isLocal && env.DEV_COUNTRY) return String(env.DEV_COUNTRY).trim().toUpperCase();

  const c = (request.cf && request.cf.country) || request.headers.get('cf-ipcountry') || '';
  return String(c).trim().toUpperCase(); // 'XX' (unknown) and 'T1' (Tor) simply won't match
}

function toSet(list) {
  return new Set(
    String(list)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );
}

function cleanInstagram(value) {
  try {
    const u = new URL(String(value || '').trim());
    const ok = u.protocol === 'https:' && /(^|\.)instagram\.com$/i.test(u.hostname);
    return ok ? u.href : '';
  } catch (e) {
    return '';
  }
}

function reply(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0', // never cache a per-visitor answer
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}

// Explicit allowlist: this endpoint is for deliberately PUBLIC downloadable files only.
// Do not add transcripts or identity documents to this list.
const PUBLIC_DOWNLOADS = {
  'cv': { key: "pdf file/SajidMehmood CV.pdf", filename: "SajidMehmood CV.pdf" },
  'ccna': { key: "assets/CCNA certificate.pdf", filename: "CCNA certificate.pdf" },
  'azure': { key: "assets/AZURE.jpg", filename: "AZURE.jpg" },
  'aptech': { key: "pdf file/Aptech Certificats .pdf", filename: "Aptech Certificats .pdf" },
  'odoo': { key: "pdf file/odoo event certificate.pdf", filename: "odoo event certificate.pdf" },
  'techwiz': { key: "pdf file/TECHWIZ4 CERTIFICATES.pdf", filename: "TECHWIZ4 CERTIFICATES.pdf" },
  'mdxcareer': { key: "pdf file/MDX career fair volunteering certificate.png", filename: "MDX career fair volunteering certificate.png" },
  'hia': { key: "pdf file/airport project certificate .png", filename: "airport project certificate .png" },
  'starlink': { key: "pdf file/starlink Experience Letter .pdf", filename: "starlink Experience Letter .pdf" },
};
async function handleDownload(request, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {status:405, headers:{Allow:'GET, HEAD'}});
  }
  const file = PUBLIC_DOWNLOADS[url.searchParams.get('file') || ''];
  if (!file) return new Response('File not found', {status:404});
  const publicUrl = 'https://assets.sajidmk.com/' + file.key.split('/').map(encodeURIComponent).join('/');
  try {
    const result = await fetch(publicUrl);
    if (!result.ok) return new Response('R2 file unavailable', {status:502});
    const headers = new Headers();
    headers.set('Content-Type', result.headers.get('Content-Type') || 'application/octet-stream');
    headers.set('Content-Disposition', 'attachment; filename="' + file.filename.replace(/["\r\n]/g, '') + '"');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Cache-Control', 'public, max-age=600');
    return new Response(request.method === 'HEAD' ? null : result.body, {status:200,headers});
  } catch (error) {
    return new Response('R2 temporarily unavailable', {status:502});
  }
}
