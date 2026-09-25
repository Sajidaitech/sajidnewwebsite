const $  = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => [...c.querySelectorAll(s)];

/* Copyright year in the footer is intentionally fixed at 2025. */

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasHover = matchMedia('(hover:hover)').matches;

/* ---------------------------------------------------------------
   Part 5 — shared rAF-batched scroll dispatcher.
   Several features below used to attach their own raw 'scroll'
   listener (one synchronous layout read per scroll event each).
   They now register here and run together once per animation
   frame, so a fast scroll fires one rAF instead of three+ handlers.
--------------------------------------------------------------- */
const scrollUpdaters = [];
let scrollTicking = false;
window.addEventListener('scroll', () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => { scrollUpdaters.forEach(fn => fn()); scrollTicking = false; });
}, { passive: true });

/* ---------------------------------------------------------------
   Transparent nav — gains a touch of body once the page has
   scrolled past the hero, so links stay legible over busy sections
   while it reads as fully transparent over the hero itself.
--------------------------------------------------------------- */
{
  const nav = $('#topNav');
  if (nav) {
    const setNavState = () => nav.classList.toggle('nav--scrolled', window.scrollY > 60);
    setNavState();
    scrollUpdaters.push(setNavState);
  }
}

/* ---------------------------------------------------------------
   Specular highlight on every glass panel — tracks the pointer via
   --mx/--my, consumed by the ::before spotlight in styles.css.
   This is the one signature "liquid glass" interaction.
--------------------------------------------------------------- */
if (hasHover) {
  $$('.glass').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });
}

/* Part 5: the always-on trailing cursor glow (a permanent rAF loop
   plus a permanent pointermove listener, running for the entire
   session regardless of interaction) has been removed — it was the
   one piece of continuous/infinite motion on the site and pure
   mouse-tracking overhead. The pointer-driven .glass specular
   highlight above already gives panels a "lit" feel on hover,
   scoped to hover only. */

/* ---------------------------------------------------------------
   Hero photo pointer-tilt now handled by the generic [data-tilt]
   system (Part 1 / Part 2 foundation) — see bottom of this file.
--------------------------------------------------------------- */

/* ---------------------------------------------------------------
   Animated stat counters — the hero readout and the About section
   highlight numbers count up once, the first time they're seen.
--------------------------------------------------------------- */
function animateCounter(el){
  const raw = el.textContent.trim();
  const match = raw.match(/^(\d+)/);
  if (!match) return; // non-numeric values (e.g. "CCNA", "Zero") stay as-is
  const end = parseInt(match[1], 10);
  const suffix = raw.slice(match[1].length);
  if (reduceMotion || end === 0) return;
  const dur = 1000;
  let start = null;
  function step(ts){
    if (!start) start = ts;
    const p = Math.min((ts - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(eased * end) + suffix;
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = raw;
  }
  el.textContent = '0' + suffix;
  requestAnimationFrame(step);
}
const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: .4 });
$$('.status-item .val, .highlight-card .val').forEach(el => counterObserver.observe(el));

/* ---------------------------------------------------------------
   Timeline progress line — fills as you scroll through Experience,
   echoing an uptime meter rather than a generic scrollbar.
--------------------------------------------------------------- */
const tlProgress = $('#tlProgress');
const timelineEl = $('#timeline');
if (tlProgress && timelineEl && !reduceMotion) {
  function updateTlProgress(){
    const rect = timelineEl.getBoundingClientRect();
    const raw = (innerHeight * .8 - rect.top) / (rect.height + innerHeight * .3);
    const pct = Math.max(0, Math.min(1, raw));
    tlProgress.style.height = `${pct * 100}%`;
  }
  scrollUpdaters.push(updateTlProgress);
  window.addEventListener('resize', updateTlProgress);
  updateTlProgress();
}

/* ---------------------------------------------------------------
   Contact section — live Doha time readout
--------------------------------------------------------------- */
const dohaClock = $('#dohaClock');
if (dohaClock) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Qatar', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  function tickClock(){ dohaClock.textContent = fmt.format(new Date()); }
  tickClock();
  setInterval(tickClock, 1000);
}

/* ---------------------------------------------------------------
   Scroll-scrubbed hero photo — as you scroll through the hero,
   the portrait turns (via a CSS var, composited with the existing
   pointer-tilt) and the role tag cycles through titles, echoing
   an Apple-style scroll-scrub sequence without needing frame assets.
--------------------------------------------------------------- */
const heroSection = $('.hero');
const heroPhoto = $('.hero-photo');
const roleCycleEl = $('#heroRoleCycle');
const roleCycle = [
  'Infrastructure & Networking',
  'Enterprise IT Support',
  'CCNA Certified Engineer',
  'Zero-Downtime Systems'
];
let lastRoleIdx = 0;

if (heroSection && heroPhoto && !reduceMotion) {
  function updateHeroScrub(){
    const rect = heroSection.getBoundingClientRect();
    const range = rect.height * .8;
    const scrolled = Math.min(Math.max(-rect.top, 0), range);
    const frac = range > 0 ? scrolled / range : 0;

    const rotY = (frac - .5) * 22;   // -11deg .. 11deg
    const rotX = (frac - .5) * -6;   // slight vertical counter-turn
    heroPhoto.style.setProperty('--scrollRotY', `${rotY.toFixed(2)}deg`);
    heroPhoto.style.setProperty('--scrollRotX', `${rotX.toFixed(2)}deg`);

    if (roleCycleEl) {
      const idx = Math.min(roleCycle.length - 1, Math.floor(frac * roleCycle.length));
      if (idx !== lastRoleIdx) {
        lastRoleIdx = idx;
        roleCycleEl.classList.add('swap');
        setTimeout(() => {
          roleCycleEl.textContent = roleCycle[idx];
          roleCycleEl.classList.remove('swap');
        }, 140);
      }
    }
  }
  scrollUpdaters.push(updateHeroScrub);
  window.addEventListener('resize', updateHeroScrub);
  updateHeroScrub();
}

/* ---------------------------------------------------------------
   Mirrored / reflected section headers with a one-time glitch
   flicker as each heading scrolls into view.
--------------------------------------------------------------- */
$$('.section h2, .contact-panel h2').forEach(h2 => {
  h2.setAttribute('data-mirror', h2.textContent.trim());
});
if (!reduceMotion) {
  const glitchObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('glitch-in');
        glitchObserver.unobserve(entry.target);
      }
    });
  }, { threshold: .5 });
  $$('.section h2, .contact-panel h2').forEach(h2 => glitchObserver.observe(h2));
}

/* ---------------------------------------------------------------
   Scroll reveal — single fade, no slide (kept restrained)
--------------------------------------------------------------- */
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .15 });
$$('.reveal').forEach(el => observer.observe(el));

/* ---------------------------------------------------------------
   Nav: active link + mobile drawer + smooth scroll
--------------------------------------------------------------- */
const navLinks = $$('.nav-links a, .mob-drawer a:not(.mob-cta)');
const sections = $$('main section[id]');
const navObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });
sections.forEach(s => navObserver.observe(s));

$$('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const target = id.length > 1 ? $(id) : null;
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenu(false);
  });
});

const navToggle = $('#navToggle');
const mobDrawer = $('#mobDrawer');
const navScrim  = $('#navScrim');

/* One place that opens/closes the mobile menu so the drawer, the dimmed
   backdrop, the button icon and the ARIA state can never disagree. */
function setMenu(open){
  if (!mobDrawer || !navToggle) return;
  mobDrawer.classList.toggle('open', open);
  navScrim?.classList.toggle('open', open);
  mobDrawer.setAttribute('aria-hidden', String(!open));
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
navToggle?.addEventListener('click', () => setMenu(!mobDrawer.classList.contains('open')));
navScrim?.addEventListener('click', () => setMenu(false));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && mobDrawer?.classList.contains('open')) { setMenu(false); navToggle.focus(); }
});
/* rotating a phone / resizing to desktop must not leave the menu open */
matchMedia('(min-width:1180px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

/* ---------------------------------------------------------------
   Scroll progress bar
--------------------------------------------------------------- */
const progress = $('#scrollProgress');
function updateProgress(){
  const h = document.documentElement;
  const max = h.scrollHeight - h.clientHeight;
  progress.style.width = max > 0 ? `${(h.scrollTop/max)*100}%` : '0%';
}
scrollUpdaters.push(updateProgress);
updateProgress();

/* ---------------------------------------------------------------
   Case study accordion
--------------------------------------------------------------- */
$$('[data-case]').forEach(card => {
  const head = card.querySelector('[data-case-toggle]');
  head.addEventListener('click', () => {
    const wasOpen = card.classList.contains('open');
    $$('[data-case]').forEach(c => c.classList.remove('open'));
    if (!wasOpen) card.classList.add('open');
  });
});

/* =============================================================
   Spatial Animation Foundation — Part 1
   Reusable [data-*] engine: transform + opacity only, GPU-friendly.
   Independent of the .reveal system above — does not replace it.
   ============================================================= */
(function spatialFoundation(){
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasHover = matchMedia('(hover:hover)').matches;
  const isTouch = matchMedia('(pointer:coarse)').matches;
  const isNarrow = innerWidth < 720;

  /* Stagger — assign --sp-i to each [data-reveal] child inside a [data-stagger] group */
  $$('[data-stagger]').forEach(group => {
    $$('[data-reveal]', group).forEach((el, i) => el.style.setProperty('--sp-i', i));
  });

  /* Reveal — IntersectionObserver, one-shot, respects reduced motion */
  const revealEls = $$('[data-reveal]');
  if (revealEls.length) {
    if (reduceMotion) {
      revealEls.forEach(el => el.classList.add('is-visible'));
    } else {
      const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: .18, rootMargin: '0px 0px -8% 0px' });
      revealEls.forEach(el => revealObserver.observe(el));
    }
  }

  /* Depth / parallax — rAF-batched scroll, translate3d only. Skipped on narrow viewports. */
  const depthEls = $$('[data-depth], [data-parallax]');
  if (depthEls.length && !reduceMotion && !isNarrow) {
    let ticking = false;
    function applyDepth(){
      const vh = innerHeight;
      depthEls.forEach(el => {
        const factor = parseFloat(el.dataset.depth ?? el.dataset.parallax ?? .06);
        const r = el.getBoundingClientRect();
        const centerOffset = (r.top + r.height / 2) - vh / 2;
        const y = (centerOffset * factor * -1).toFixed(2);
        el.style.transform = `translate3d(0, ${y}px, 0)`;
      });
      ticking = false;
    }
    function onScroll(){ if (!ticking) { requestAnimationFrame(applyDepth); ticking = true; } }
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    applyDepth();
  }

  /* Tilt — pointer-driven perspective, desktop hover only.
     Responsive tiers: full strength >=1024px, reduced 640-1023px,
     effectively off below 640px (also gated by hover/touch above). */
  if (hasHover && !isTouch && !reduceMotion) {
    function tiltStrength(){
      const w = innerWidth;
      if (w < 640) return 0;
      if (w < 1024) return .45;
      return 1;
    }
    $$('[data-tilt]').forEach(el => {
      const max = parseFloat(el.dataset.tiltMax) || 6;
      el.addEventListener('pointermove', e => {
        const strength = tiltStrength();
        if (!strength) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - .5;
        const py = (e.clientY - r.top) / r.height - .5;
        const m = max * strength;
        el.style.transform = `perspective(1200px) rotateY(${(px*m).toFixed(2)}deg) rotateX(${(py*-m).toFixed(2)}deg)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transform = 'perspective(1200px) rotateY(0deg) rotateX(0deg)';
      });
    });
  }
})();

/* =================================================================
   PART 4 — Technical Arsenal tab switcher
   Simple click-to-show tag cloud, no external deps, respects the
   existing reveal/tilt systems above (does not touch them).
================================================================= */
(function arsenalTabs(){
  const tabs = document.querySelectorAll('.arsenal-tab');
  if (!tabs.length) return;
  const clouds = document.querySelectorAll('.arsenal-cloud');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.arsenal;
      tabs.forEach(t => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', t === tab); });
      clouds.forEach(c => c.classList.toggle('active', c.dataset.panel === key));
    });
  });
})();

/* =================================================================
   PART 4b — Engagement breakdown cards (click-to-expand)
   Each .bd-card toggles its own .is-open state independently
   (multiple can be open at once) — the height animation itself is
   pure CSS via grid-template-rows, this just flips the class + ARIA.
================================================================= */
(function breakdownCards(){
  const cards = document.querySelectorAll('.bd-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const open = card.classList.toggle('is-open');
      card.setAttribute('aria-expanded', open);
    });
  });
})();

/* =================================================================
   CONTACT FORM — Formspree AJAX submission
   Uses the existing #contactForm markup only. Native HTML5
   validation runs first (required fields + email type); on pass,
   submits via fetch so the visitor never leaves the page or sees
   a Formspree redirect. Button label and a small status line
   (aria-live) are the only things that change — no new animation,
   no layout shift.
================================================================= */
(function contactForm(){
  const form = document.getElementById('contactForm');
  if (!form) return;

  const submitBtn = form.querySelector('.cf-submit');
  const submitLabel = form.querySelector('.cf-submit-text');
  const status = form.querySelector('.cf-status');
  let resetTimer = null;

  function setState(state, message){
    if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
    status.classList.remove('is-success', 'is-error');
    if (state === 'sending') {
      submitBtn.disabled = true;
      submitLabel.textContent = 'Sending…';
      status.textContent = '';
    } else if (state === 'success') {
      submitBtn.disabled = false;
      submitLabel.textContent = 'Message Sent ✓';
      status.textContent = message;
      status.classList.add('is-success');
      resetTimer = setTimeout(() => { submitLabel.textContent = 'Send Message'; }, 4000);
    } else if (state === 'error') {
      submitBtn.disabled = false;
      submitLabel.textContent = 'Try Again';
      status.textContent = message;
      status.classList.add('is-error');
    } else {
      submitBtn.disabled = false;
      submitLabel.textContent = 'Send Message';
      status.textContent = '';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Normal browser validation — required fields + email format.
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    setState('sending');

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        setState('success', "Message sent successfully. Thank you for reaching out — I'll get back to you as soon as possible.");
        form.reset();
      } else {
        let detail = '';
        try {
          const data = await response.json();
          if (data && Array.isArray(data.errors)) {
            detail = data.errors.map(err => err.message).join(' ');
          }
        } catch (parseErr) {
          // response wasn't JSON — nothing further to extract
        }
        if (detail) console.error('Formspree error:', detail);
        setState('error', 'Unable to send your message. Please try again.');
      }
    } catch (networkErr) {
      console.error('Contact form network error:', networkErr);
      setState('error', 'Unable to send your message. Please check your connection and try again.');
    }
  });
})();


/* ---------------------------------------------------------------
   Command Console — press Ctrl/⌘ + K (or "/") anywhere.
   A glass palette to jump to any section or run a recruiter action
   (view / download CV, email, WhatsApp, LinkedIn, copy email).
   Everything is read from links already on the page, so nothing is
   duplicated. Keyboard-first, works with a tap too, no pointer
   tracking.
--------------------------------------------------------------- */
(function commandConsole(){
  const root = $('#cmdk');
  if (!root) return;
  const input = $('#cmdkInput'), list = $('#cmdkList'), toast = $('#cmdkToast');
  const triggers = ['#cmdkOpen', '#cmdkTip'].map(s => $(s)).filter(Boolean);
  const html = document.documentElement;
  let items = [], shown = [], active = 0, isOpen = false, lastFocus = null, toastTimer = 0;

  // ⌘ on Apple devices, Ctrl elsewhere
  const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
  $$('[data-cmdk-mod]').forEach(k => { k.textContent = isMac ? '⌘' : 'Ctrl'; });

  const KEYS = {
    '#why-hire':'hire why recruit', '#experience':'work history jobs career', '#skills':'abilities strengths',
    '#arsenal':'tools stack tech tooling', '#certifications':'certs certificates ccna itil', '#projects':'projects case studies missions',
    '#proof':'evidence results metrics', '#lab':'home lab practice', '#education':'degree university school',
    '#achievements':'awards wins', '#references':'recommendations referees testimonials', '#about':'bio profile who'
  };

  function build(){
    if (items.length) return;
    $$('.nav-links a').forEach(a => items.push({
      group:'Sections', kind:'section', ico:'#', hint:'Jump',
      label:a.textContent.trim(), href:a.getAttribute('href'), keys:KEYS[a.getAttribute('href')] || ''
    }));
    const byText = t => $$('.hero-actions a').find(a => a.textContent.trim().toLowerCase().startsWith(t));
    const view = byText('view'), dl = byText('download');
    const mail = $('a[href^="mailto:"]'), wa = $('a[href*="wa.me"]'), li = $('.side-rail a[href*="linkedin.com"]');
    if (view) items.push({ group:'Actions', kind:'link', ico:'↗', hint:'Opens in new tab', label:'View CV', href:view.href, external:true, keys:'resume pdf' });
    if (dl)   items.push({ group:'Actions', kind:'link', ico:'↓', hint:'Download', label:'Download CV', href:dl.href, download:true, keys:'resume pdf save' });
    if (mail) {
      const addr = mail.getAttribute('href').replace(/^mailto:/i, '').split('?')[0];
      items.push({ group:'Actions', kind:'link', ico:'@', hint:'Opens your mail app', label:'Send an email', href:mail.href, keys:'contact mail' });
      items.push({ group:'Actions', kind:'copy', ico:'⧉', hint:addr, label:'Copy email address', value:addr, keys:'contact mail clipboard' });
    }
    if (wa) items.push({ group:'Actions', kind:'link', ico:'↗', hint:'Opens in new tab', label:'Message on WhatsApp', href:wa.href, external:true, keys:'chat phone' });
    if (li) items.push({ group:'Actions', kind:'link', ico:'↗', hint:'Opens in new tab', label:'Open LinkedIn', href:li.href, external:true, keys:'profile network' });
  }

  function score(it, q){
    if (!q) return 1;
    const label = it.label.toLowerCase(), keys = (it.keys || '').toLowerCase();
    if (label.startsWith(q)) return 4;
    if (label.includes(q)) return 3;
    if (keys.includes(q)) return 2;
    let i = 0;
    for (const ch of label) if (ch === q[i]) i++;
    return i === q.length ? 1 : 0;
  }

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render(){
    const q = input.value.trim().toLowerCase();
    shown = items.map(it => ({ it, s:score(it, q) })).filter(x => x.s > 0);
    if (q) shown.sort((a, b) => b.s - a.s);
    shown = shown.map(x => x.it);
    list.textContent = '';
    if (!shown.length) {
      list.appendChild(el('li', 'cmdk-empty', `Nothing matches “${input.value.trim()}”`));
      input.removeAttribute('aria-activedescendant');
      return;
    }
    let group = null;
    shown.forEach((it, i) => {
      if (!q && it.group !== group) {
        group = it.group;
        const h = el('li', 'cmdk-group', group);
        h.setAttribute('role', 'presentation');
        list.appendChild(h);
      }
      const li = el('li', 'cmdk-item');
      li.id = 'cmdk-o-' + i; li.dataset.i = i;
      li.setAttribute('role', 'option');
      li.append(el('span', 'cmdk-ico', it.ico), el('span', 'cmdk-label', it.label), el('span', 'cmdk-hint', it.hint));
      list.appendChild(li);
    });
    setActive(0);
  }

  function setActive(i, scroll = true){
    const opts = $$('.cmdk-item', list);
    if (!opts.length) return;
    active = (i + opts.length) % opts.length;
    opts.forEach((o, k) => { const on = k === active; o.classList.toggle('is-active', on); o.setAttribute('aria-selected', String(on)); });
    input.setAttribute('aria-activedescendant', opts[active].id);
    if (scroll) opts[active].scrollIntoView({ block:'nearest' });
  }

  function say(msg){
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 1900);
  }

  function copy(text){
    const ok = () => say('Email address copied');
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(ok, () => say(text)); return; }
    const t = document.createElement('textarea');
    t.value = text; t.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy') ? ok() : say(text); } catch { say(text); }
    t.remove();
  }

  function run(it){
    if (!it) return;
    close(true);
    if (it.kind === 'section') {
      const t = $(it.href);
      if (t) t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block:'start' });
    } else if (it.kind === 'copy') {
      copy(it.value);
    } else if (it.external) {
      window.open(it.href, '_blank', 'noopener,noreferrer');
    } else if (it.download) {
      const a = document.createElement('a');
      a.href = it.href; a.download = '';
      document.body.appendChild(a); a.click(); a.remove();
    } else {
      location.href = it.href;
    }
  }

  function open(){
    if (isOpen) return;
    build();
    isOpen = true;
    lastFocus = document.activeElement;
    input.value = '';
    render();
    root.hidden = false;
    html.classList.add('cmdk-open');
    triggers.forEach(t => t.setAttribute('aria-expanded', 'true'));
    requestAnimationFrame(() => root.classList.add('is-open'));
    input.focus();
  }

  function close(silent){
    if (!isOpen) return;
    isOpen = false;
    root.classList.remove('is-open');
    html.classList.remove('cmdk-open');
    triggers.forEach(t => t.setAttribute('aria-expanded', 'false'));
    const done = () => { if (!isOpen) root.hidden = true; };
    if (reduceMotion) done(); else setTimeout(done, 240);
    if (!silent && lastFocus && lastFocus.focus) lastFocus.focus();
  }

  triggers.forEach(t => t.addEventListener('click', open));
  input.addEventListener('input', render);
  root.addEventListener('click', e => {
    if (e.target.closest('[data-cmdk-close]')) { close(); return; }
    const li = e.target.closest('.cmdk-item');
    if (li) run(shown[+li.dataset.i]);
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End')  { e.preventDefault(); setActive(shown.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); run(shown[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); input.focus(); } // keep focus inside the dialog
  });
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'k') { e.preventDefault(); isOpen ? close() : open(); return; }
    if (k === '/' && !isOpen && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
      e.preventDefault(); open();
    }
  });
})();

/* =================================================================
   VIEWER GATE + IN-SITE DOCUMENT VIEWER
   Intercepts every "View CV" / "Download CV" / certificate button.
   Visitor gives their name (+ optional company) first; that plus
   the action (viewed/downloaded) and item name is emailed via the
   existing Formspree endpoint. "View" actions then open the file
   in an in-page viewer instead of navigating to Google Drive;
   "Download" actions trigger the actual file download.
================================================================= */
(function viewerGate(){
  const CV_ID = '1-Ktw3XGNO4UZvxATGR9ED44NZiFMlwz_';
  const NOTIFY_ENDPOINT = 'https://formspree.io/f/mbglyrwl'; // same form used by the contact section

  const gate = document.getElementById('vgate');
  const gateForm = document.getElementById('vgateForm');
  const gateName = document.getElementById('vgateName');
  const gateCompany = document.getElementById('vgateCompany');
  const gateSub = document.getElementById('vgateSub');
  const gateSubmit = document.getElementById('vgateSubmit');
  const gateSubmitText = document.getElementById('vgateSubmitText');
  const gateStatus = document.getElementById('vgateStatus');

  const viewer = document.getElementById('vview');
  const viewerTitle = document.getElementById('vviewTitle');
  const viewerOpen = document.getElementById('vviewOpen');
  const viewerBody = document.getElementById('vviewBody');

  if (!gate || !viewer) return;

  let pending = null; // { url, downloadUrl, title, action: 'view'|'download' }
  let lastFocused = null;

  // iOS Safari doesn't fully honour `overflow:hidden` on <html>/<body> —
  // the page behind a modal can still drag/rubber-band. Pinning the body
  // to a fixed position (and restoring the exact scroll offset on close)
  // is the reliable cross-browser fix. A counter means the gate closing
  // and the viewer opening right after it (or vice versa) doesn't
  // release the lock in between and let the page jump.
  let scrollLockCount = 0;
  let savedScrollY = 0;
  function lockScroll(){
    if (scrollLockCount === 0) {
      savedScrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    }
    scrollLockCount++;
  }
  function unlockScroll(){
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, savedScrollY);
    }
  }

  function driveIdFromUrl(url){
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  }
  function isImageUrl(url){ return /\.(png|jpe?g|gif|webp)$/i.test(url); }

  function openGate(item){
    pending = item;
    gateForm.reset();
    gateStatus.textContent = '';
    gateStatus.classList.remove('is-error');
    gateName.classList.remove('is-touched');
    gateSub.textContent = `Quick intro before you ${item.action === 'download' ? 'download' : 'view'} ${item.title}.`;
    lastFocused = document.activeElement;
    lockScroll();
    gate.hidden = false;
    document.documentElement.classList.add('vgate-open');
    requestAnimationFrame(() => {
      gate.classList.add('is-open');
      gateName.focus();
    });
  }
  function closeGate(){
    gate.classList.remove('is-open');
    document.documentElement.classList.remove('vgate-open');
    unlockScroll();
    setTimeout(() => { gate.hidden = true; }, 250);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function openViewer(item){
    viewerTitle.textContent = item.title;
    viewerOpen.href = item.url;
    viewerBody.innerHTML = '';
    if (isImageUrl(item.url)) {
      const img = document.createElement('img');
      img.className = 'vview-img';
      img.src = item.url;
      img.alt = item.title;
      viewerBody.appendChild(img);
    } else {
      const driveId = driveIdFromUrl(item.url);
      const iframe = document.createElement('iframe');
      iframe.className = 'vview-iframe';
      iframe.src = driveId ? `https://drive.google.com/file/d/${driveId}/preview` : item.url;
      iframe.allow = 'autoplay';
      iframe.loading = 'lazy';
      viewerBody.appendChild(iframe);
    }
    lockScroll();
    viewer.hidden = false;
    document.documentElement.classList.add('vview-open');
    requestAnimationFrame(() => viewer.classList.add('is-open'));
  }
  function closeViewer(){
    viewer.classList.remove('is-open');
    document.documentElement.classList.remove('vview-open');
    unlockScroll();
    setTimeout(() => { viewer.hidden = true; viewerBody.innerHTML = ''; }, 250);
  }

  function notify(name, company, item){
    const actionLabel = item.action === 'download' ? 'Downloaded' : 'Viewed';
    const payload = {
      name: name,
      company: company || '(not given)',
      action: actionLabel,
      item: item.title,
      page: location.href,
      time: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Qatar' }) + ' (Doha)',
      _subject: `🔔 ${actionLabel} — ${item.title} — by ${name}`
    };
    return fetch(NOTIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  function triggerDownload(url){
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener noreferrer';
    // Forces an actual download rather than a navigation for same-origin
    // assets (e.g. local certificate images). Ignored by browsers for
    // cross-origin URLs (Google Drive), which already download via their
    // own Content-Disposition header.
    a.setAttribute('download', '');
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Wire up every certificate button + every CV link on the page.
  function itemFromLink(link){
    const isCV = link.href.includes(CV_ID);
    const isDownload = link.href.includes('export=download') || link.hasAttribute('download');
    let title = 'CV';
    if (!isCV) {
      const certCard = link.closest('.cert-card');
      const eduCard = link.closest('.edu-card');
      const certTitleEl = certCard ? certCard.querySelector('.cert-title') : null;
      const eduTitleEl = eduCard ? eduCard.querySelector('.edu-degree') : null;
      const linkLabel = link.textContent.trim().replace(/^(View|Download)\s+/i, '');
      if (certTitleEl) {
        title = certTitleEl.textContent.trim();
      } else if (eduTitleEl) {
        title = `${linkLabel} — ${eduTitleEl.textContent.trim()}`;
      } else {
        title = linkLabel;
      }
    }
    return {
      url: link.href,
      title: title,
      action: isDownload ? 'download' : 'view'
    };
  }

  const targets = document.querySelectorAll(
    'a.cert-btn, a[href*="' + CV_ID + '"]'
  );
  targets.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openGate(itemFromLink(link));
    });
  });

  gateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    gateName.classList.add('is-touched');
    if (!gateForm.checkValidity()) return;
    if (!pending) return;

    const name = gateName.value.trim();
    const company = gateCompany.value.trim();

    gateSubmit.disabled = true;
    gateSubmitText.textContent = 'One sec…';
    gateStatus.classList.remove('is-error');
    gateStatus.textContent = '';

    notify(name, company, pending)
      .catch(() => { /* notification failure should never block the visitor */ })
      .finally(() => {
        gateSubmit.disabled = false;
        gateSubmitText.textContent = 'Continue';
        const item = pending;
        closeGate();
        if (item.action === 'download') {
          triggerDownload(item.url);
        } else {
          openViewer(item);
        }
      });
  });

  gate.querySelectorAll('[data-vgate-close]').forEach(el => el.addEventListener('click', closeGate));
  viewer.querySelectorAll('[data-vview-close]').forEach(el => el.addEventListener('click', closeViewer));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!gate.hidden) closeGate();
    else if (!viewer.hidden) closeViewer();
  });
})();

/* =================================================================
   QR DIGITAL BUSINESS CARD
   Builds a vCard from the contact details already on the page,
   renders it as a scannable QR (via the QR Server API — no key,
   no library to bundle) and offers a direct .vcf download too.
================================================================= */
(function qrBusinessCard(){
  const img = document.getElementById('qrImg');
  const dl = document.getElementById('qrDownload');
  if (!img || !dl) return;

  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Mehmood;Sajid;;;',
    'FN:Sajid Mehmood',
    'TITLE:IT Support Engineer',
    'TEL;TYPE=CELL:+97466969598',
    'EMAIL:sajiditeech@gmail.com',
    'URL:https://sajidmk.com',
    'ADR;TYPE=WORK:;;Doha;;;Qatar',
    'END:VCARD'
  ].join('\n');

  const encoded = encodeURIComponent(vcard);
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=6&data=${encoded}`;
  dl.href = `data:text/vcard;charset=utf-8,${encoded}`;
})();

/* =================================================================
   REFERENCE-CALL CTA
   Scrolls to the contact form and pre-fills subject + a starter
   message, so a recruiter just adds their name/email and sends.
================================================================= */
(function referenceCallCta(){
  const btn = document.getElementById('refCallBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const section = document.getElementById('contact');
    const subject = document.getElementById('cfSubject');
    const message = document.getElementById('cfMessage');
    const name = document.getElementById('cfName');
    if (!section) return;

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (subject && !subject.value) subject.value = 'Reference call request';
    if (message && !message.value) {
      message.value = "Hi Sajid, I'd like to arrange a quick reference call to verify your experience. Let me know a good time.";
    }
    setTimeout(() => { if (name) name.focus(); }, 500);
  });
})();
