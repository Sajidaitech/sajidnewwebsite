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
   Real nav height, not a guess — .nav is position:fixed so nothing
   below it reserves space automatically. The focus-slider (and
   anything else that needs to clear the floating nav) used to rely
   on a hardcoded margin-top px value, which drifted out of sync
   whenever the nav's own rendered height changed (safe-area insets,
   font scaling, wrapping, etc.), leaving little to no visible gap
   on some phones. Measure it for real and expose it as --nav-h so
   CSS can just add a fixed breathing-room gap on top of it.
--------------------------------------------------------------- */
{
  const nav = $('#topNav');
  if (nav) {
    const setNavH = () => {
      document.documentElement.style.setProperty('--nav-h', `${nav.offsetHeight}px`);
    };
    setNavH();
    window.addEventListener('resize', setNavH);
    window.addEventListener('orientationchange', setNavH);
    if (window.ResizeObserver) new ResizeObserver(setNavH).observe(nav);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setNavH);
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
    '#achievements':'awards wins', '#references':'recommendations referees testimonials', '#about':'bio profile who', '#toolkit':'bat scripts downloads windows tools utilities'
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
   Builds a vCard from the contact details already on the page and
   renders it as a scannable QR. Tries two independent QR image
   providers (in case one is down or blocked by an extension/
   network filter) before falling back to a plain text notice —
   the vCard download itself never depends on either provider,
   since it's a local data: URI.
================================================================= */
(function qrBusinessCard(){
  const img = document.getElementById('qrImg');
  const dl = document.getElementById('qrDownload');
  const card = document.querySelector('.qr-card');
  if (!img || !dl || !card) return;

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

  // Always works, no network dependency at all.
  dl.href = `data:text/vcard;charset=utf-8,${encoded}`;

  const providers = [
    `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=6&data=${encoded}`,
    `https://quickchart.io/qr?text=${encoded}&size=240&margin=2`
  ];
  let attempt = 0;

  function tryNext(){
    if (attempt >= providers.length) {
      // Both providers failed (blocked network, offline, extension, etc.)
      // — don't leave a broken-image icon, show a clear text fallback and
      // keep the vCard download (which still works) front and centre.
      card.classList.add('qr-failed');
      img.remove();
      return;
    }
    img.src = providers[attempt];
    attempt++;
  }

  img.addEventListener('error', tryNext);
  tryNext();
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

/* =================================================================
   LIVE FOCUS SLIDER — blurs every glass panel's BACKGROUND only
   (hero, recruiter bar, every .section, footer panel), via
   backdrop-filter — never the panel's own text/content, which is
   what plain filter:blur() would do.
   Left (0)  = fully Clear: no blur AND the panel background itself
               goes fully transparent, so the page behind shows
               straight through.
   Right(100)= fully Blurred, backdrop-filter:blur(100px), normal
               tinted glass background.
   The chosen value is saved to localStorage and restored on the
   next visit, so a reload picks up right where the user left it.
   Text color on blurred panels is a separate, user-controlled
   choice — see the ink-toggle module below — not automatic.
================================================================= */
(function focusSlider(){
  const slider = document.getElementById('heroFocusRange');
  const readout = document.getElementById('focusSliderReadout');
  const panels = document.querySelectorAll('.hero, .recruiter-bar, .section, .footer-panel');
  if (!slider || !panels.length) return;

  const STORAGE_KEY = 'focusBlurPx';

  panels.forEach(p => {
    p.style.transition = 'backdrop-filter .12s linear, -webkit-backdrop-filter .12s linear, background .12s linear';
  });

  function apply(px, persist){
    const clamped = Math.min(100, Math.max(0, px));
    const isClear = clamped === 0;
    // 'none' at 0 is required, not '' — every panel also carries a permanent
    // baseline blur via CSS (--blur-section, ~2px) that isn't tied to this
    // slider at all, so merely clearing the inline override would let that
    // baseline blur leak back through instead of true zero blur.
    const bf = isClear ? 'none' : `blur(${clamped}px) saturate(1.3) contrast(1.02)`;

    panels.forEach(p => {
      p.style.backdropFilter = bf;
      p.style.webkitBackdropFilter = bf;
      // At 0, drop the panel's own tinted background too, for full transparency —
      // otherwise let the CSS default (tinted glass) take back over.
      p.style.background = isClear ? 'transparent' : '';
    });

    slider.value = clamped;
    slider.style.setProperty('--focus-fill', clamped + '%');
    if (readout) readout.textContent = clamped + 'px';

    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, String(clamped)); } catch (e) { /* storage unavailable — ignore */ }
    }
  }

  let saved = NaN;
  try { saved = parseFloat(localStorage.getItem(STORAGE_KEY)); } catch (e) { /* storage unavailable — ignore */ }
  const initial = Number.isFinite(saved) ? saved : (parseFloat(slider.value) || 0);
  apply(initial, false);

  slider.addEventListener('input', () => {
    apply(parseFloat(slider.value), true);
  });
})();

/* =================================================================
   TEXT-COLOR (INK) TOGGLE — a manual White/Black switch for text on
   every blurred glass panel, next to the focus slider. Replaces the
   old automatic "flip past 20px" rule: the user decides, and the
   choice is remembered across visits (localStorage).
================================================================= */
(function inkToggle(){
  const btn = document.getElementById('inkToggle');
  const panels = document.querySelectorAll('.hero, .recruiter-bar, .section, .footer-panel');
  if (!btn || !panels.length) return;

  const STORAGE_KEY = 'focusInkMode';

  function apply(mode, persist){
    const isBlack = mode === 'black';
    panels.forEach(p => p.classList.toggle('blur-ink', isBlack));
    btn.setAttribute('aria-pressed', String(isBlack));
    btn.textContent = isBlack ? 'Aa · Black text' : 'Aa · White text';

    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) { /* storage unavailable — ignore */ }
    }
  }

  let saved = 'white';
  try { saved = localStorage.getItem(STORAGE_KEY) || 'white'; } catch (e) { /* storage unavailable — ignore */ }
  apply(saved, false);

  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-pressed') === 'true' ? 'white' : 'black';
    apply(next, true);
  });
})();

/* =================================================================
   INTERACTIVE DIAGNOSTICS DEMO
   A scripted, clearly-labelled simulation of a DNS → ping →
   traceroute sequence. Nothing here makes a real network call —
   browsers can't send raw ICMP packets — it's purely illustrative
   of the diagnostic order/methodology.
================================================================= */
(function diagnosticsDemo(){
  const form = document.getElementById('diagForm');
  const input = document.getElementById('diagTarget');
  const runBtn = document.getElementById('diagRun');
  const out = document.getElementById('diagConsole');
  if (!form || !input || !runBtn || !out) return;

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function line(text, cls){
    const div = document.createElement('div');
    div.className = 'diag-line' + (cls ? ' ' + cls : '');
    div.textContent = text;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  }

  // Deterministic pseudo-random numbers seeded from the host string,
  // so the same input always produces the same (fake) results rather
  // than looking like noise on refresh.
  function seededRandom(seed){
    let h = 0;
    for (let i = 0; i < seed.length; i++) { h = (h * 31 + seed.charCodeAt(i)) >>> 0; }
    return function(){
      h = (h * 1664525 + 1013904223) >>> 0;
      return h / 4294967296;
    };
  }

  async function run(target){
    out.innerHTML = '';
    runBtn.disabled = true;
    const rand = seededRandom(target.toLowerCase());
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(target);
    const fakeIp = isIp ? target : `${140 + Math.floor(rand()*80)}.${Math.floor(rand()*255)}.${Math.floor(rand()*255)}.${10 + Math.floor(rand()*240)}`;

    line(`[SIMULATED] Diagnostic sequence for ${target}`, 'muted');
    await sleep(350);

    if (!isIp) {
      line(`Resolving ${target} ...`);
      await sleep(500);
      line(`→ Resolved to ${fakeIp}`, 'ok');
      await sleep(300);
    }

    line(`Pinging ${fakeIp} with 32 bytes of data:`);
    await sleep(250);
    let sent = 0, received = 0, times = [];
    for (let i = 0; i < 4; i++) {
      sent++;
      await sleep(280);
      const dropped = rand() < 0.05;
      if (dropped) {
        line(`Request timed out.`, 'warn');
      } else {
        const t = Math.round(8 + rand() * 42);
        times.push(t);
        received++;
        line(`Reply from ${fakeIp}: bytes=32 time=${t}ms TTL=54`);
      }
    }
    const loss = Math.round(((sent - received) / sent) * 100);
    const avg = times.length ? Math.round(times.reduce((a,b)=>a+b,0) / times.length) : 0;
    line(`Packets: Sent = ${sent}, Received = ${received}, Lost = ${sent - received} (${loss}% loss)`, loss > 0 ? 'warn' : 'ok');
    if (times.length) line(`Approximate round trip: min=${Math.min(...times)}ms max=${Math.max(...times)}ms avg=${avg}ms`, 'muted');

    await sleep(400);
    line(`Running traceroute to ${fakeIp} ...`);
    await sleep(300);
    const hopNames = ['gateway.local', 'isp-edge-1.net', 'isp-core-3.net', 'transit-xchg.net', 'regional-pop.net', `${target}`];
    const hopCount = 3 + Math.floor(rand() * 3);
    for (let h = 1; h <= hopCount; h++) {
      await sleep(260);
      const t = Math.round(4 + h * (6 + rand() * 10));
      const name = h === hopCount ? (isIp ? fakeIp : target) : hopNames[Math.min(h-1, hopNames.length-2)];
      line(`${String(h).padStart(2,' ')}  ${t}ms  ${name}`);
    }

    await sleep(300);
    if (loss === 0) {
      line(`✔ Diagnosis: host reachable, no packet loss, latency within normal range.`, 'ok');
    } else {
      line(`⚠ Diagnosis: intermittent packet loss detected — next step would be checking the local gateway and ISP link before escalating.`, 'warn');
    }
    runBtn.disabled = false;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const target = input.value.trim();
    if (!target) { input.focus(); return; }
    run(target);
  });
})();

/* =================================================================
   LIVE TICKET TRIAGE DEMO
   A rule-based classifier mirroring real service-desk triage:
   category by keyword match, priority by impact language, then an
   SLA target and first diagnostic step per category. Everything
   runs client-side — nothing is stored or transmitted.
================================================================= */
(function ticketTriage(){
  const form = document.getElementById('triageForm');
  const input = document.getElementById('triageInput');
  const runBtn = document.getElementById('triageRun');
  const out = document.getElementById('triageResult');
  if (!form || !input || !runBtn || !out) return;

  const CATEGORIES = [
    { key:'security', label:'Security', icon:'🛡️',
      words:['phishing','malware','virus','ransomware','breach','hacked','suspicious','unauthorized','unauthorised','compromised','security'],
      step:'Isolate the affected endpoint immediately, preserve logs, and begin containment per the incident-response runbook before anything else.' },
    { key:'network', label:'Network', icon:'🌐',
      words:['wifi','wi-fi','network','internet','vpn','dns','router','switch','firewall','vlan','connectivity','offline','packet','latency','lan'],
      step:'Check physical link and switch port status, confirm DNS resolution, then run a ping/traceroute before escalating to routing.' },
    { key:'hardware', label:'Hardware & power', icon:'🔧',
      words:['laptop','desktop','printer','monitor','ups','power','server','hardware','device','battery','cable','peripheral','rack'],
      step:'Verify the power source and cable seating, check UPS/PDU status and device health logs before dispatching a replacement.' },
    { key:'access', label:'Access & identity', icon:'🔑',
      words:['password','login','locked','account','mfa','2fa','permission','access denied','active directory','credentials','sign in','signin'],
      step:'Verify the requester identity, check the Active Directory/Azure AD account status, then reset access under change control.' },
    { key:'cloud', label:'Cloud & M365', icon:'☁️',
      words:['azure','microsoft 365','office 365','m365','sharepoint','exchange','onedrive','teams','intune','cloud'],
      step:'Check Microsoft 365 service health first, then verify licensing/sync status and Azure AD sign-in logs.' },
    { key:'software', label:'Software', icon:'💻',
      words:['software','application','app','crash','error','install','update','outlook','excel','freeze','bug'],
      step:'Reproduce the issue, check for a recent update or patch conflict, and review application/event logs before a clean reinstall.' }
  ];
  const DEFAULT_CAT = { label:'General IT support', icon:'🗂️',
    step:'Confirm exactly what changed for the user, gather screenshots or error text, and reproduce the issue before assigning a specialist.' };

  const P1_WORDS = ['down','outage','entire','all users','all staff','everyone','production','cannot work','can not work','emergency','critical','data loss','breach','hospital','airport','no one can','whole floor','whole office'];
  const P2_WORDS = ['multiple users','several users','some users','degraded','intermittent','slow','many people','half the'];
  const P4_WORDS = ['how do i','how to','question','when will','just wondering','curious','request info','out of curiosity'];

  const PRIORITY = {
    P1: { label:'P1 — Critical', cls:'p1', sla:'15 min response · 4h resolution target' },
    P2: { label:'P2 — High',     cls:'p2', sla:'1h response · 8h resolution target' },
    P3: { label:'P3 — Medium',   cls:'p3', sla:'4h response · next business day' },
    P4: { label:'P4 — Low',      cls:'p4', sla:'1 business day response' }
  };

  let counter = 10480 + Math.floor(Math.random() * 40);

  function classify(text){
    const t = text.toLowerCase();
    let best = null, bestScore = 0;
    CATEGORIES.forEach(cat => {
      const score = cat.words.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; best = cat; }
    });
    const category = best || DEFAULT_CAT;

    let priority = 'P3';
    if (P1_WORDS.some(w => t.includes(w))) priority = 'P1';
    else if (P2_WORDS.some(w => t.includes(w))) priority = 'P2';
    else if (P4_WORDS.some(w => t.includes(w))) priority = 'P4';

    return { category, priority };
  }

  function esc(s){
    return s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function render(text){
    const { category, priority } = classify(text);
    const p = PRIORITY[priority];
    counter++;
    out.innerHTML = `
      <div class="triage-card">
        <div class="triage-top">
          <span class="triage-id">SD-${counter}</span>
          <span class="triage-badge ${p.cls}">${esc(p.label)}</span>
        </div>
        <div class="triage-cat">${category.icon} ${esc(category.label)}</div>
        <div class="triage-row"><span>SLA target</span><strong>${esc(p.sla)}</strong></div>
        <div class="triage-row"><span>First diagnostic step</span></div>
        <p class="triage-step">${esc(category.step)}</p>
        <div class="triage-foot">Assigned to Sajid Mehmood · auto-triaged in real time — demo only, no ticket is actually created.</div>
      </div>`;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    render(text);
  });
})();


/* =================================================================
   SAJID IT TOOLKIT
   ONE place to edit: TOOLKIT_CONFIG (social links) and TOOLKIT_TOOLS
   (one object per tool). Cards, details modal, source viewer and the
   unlock flow are all generated from these.
================================================================= */
(function sajidToolkit(){
  const grid = $('#tkGrid');
  if (!grid) return;

  /* ---- 1. SOCIAL LINKS — paste your URLs here (leave '' to hide that button) ---- */
  const TOOLKIT_CONFIG = {
    youtubeUrl:   '',   // e.g. 'https://www.youtube.com/@yourchannel'
    instagramUrl: ''    // e.g. 'https://www.instagram.com/yourhandle/'
  };

  /* ---- 2. TOOLS — add / edit tools here ---- */
  const TOOLKIT_TOOLS = [
    {
      id:'software-updater', status:'available', category:'Windows', icon:'update',
      name:'One-Click Software Updater',
      desc:'Update commonly installed Windows applications from one convenient script.',
      long:'Runs Windows Package Manager (winget) to upgrade installed applications, then checks for Windows updates and repairs system files.',
      version:'v1.0.0', updated:'30 September 2026', platform:'Windows 10 / Windows 11',
      admin:true, size:'1,165 bytes',
      sha256:'dc0e288c3626d7be24eb74fafc87ca2054f7037cb8b1f87ac2d74f58bc08896e',
      file:'assets/toolkit/one-click-software-updater.bat',
      runNote:'Save your work and close other programs first. Your PC may restart automatically after updates.',
      extras:[],   // e.g. [{label:'README', path:'assets/toolkit/README.txt'}]
      does:[
        'Checks that it is running as administrator and stops if not.',
        'Runs “winget upgrade --all --include-unknown” to update supported applications.',
        'Installs the PSWindowsUpdate PowerShell module, then installs available Windows updates and drivers.',
        'Restarts the PC automatically if Windows Update requires it.',
        'Runs “sfc /scannow” to scan and repair system files.'
      ],
      requires:['Windows 10 or Windows 11','Windows Package Manager (winget)','Internet connection','Administrator rights'],
      safety:['Save your work first: the PC can restart automatically after updates.','“--include-unknown” can also upgrade apps you did not plan to update.','Downloads a module (PSWindowsUpdate) from the PowerShell Gallery.','Create a restore point or backup before running.']
    },
    {
      id:'cache-cleaner', status:'available', category:'Cleanup', icon:'broom',
      name:'Windows Cache Cleaner',
      desc:'Clean temporary files, cache and other safe-to-remove Windows temporary data.',
      long:'Clears temporary folders and the DNS cache, optimizes drives, and runs the System File Checker.',
      version:'v1.0.0', updated:'30 September 2026', platform:'Windows 10 / Windows 11',
      admin:true, size:'985 bytes',
      sha256:'bca8cdad01610960f65ffd3cf80e9951453856533bc29d6984f0eea12ae24748',
      file:'assets/toolkit/windows-cache-cleaner.bat',
      runNote:'Close your open programs first so temporary files are not in use.',
      extras:[],
      does:[
        'Checks that it is running as administrator and stops if not.',
        'Deletes the contents of your user Temp folder, C:\\Windows\\Temp and C:\\Windows\\Prefetch.',
        'Flushes the DNS resolver cache (ipconfig /flushdns).',
        'Runs “defrag /O” on C: and D: (TRIM for SSDs, defrag for hard drives; D: is skipped or errors if it does not exist).',
        'Runs “sfc /scannow” to scan and repair system files.'
      ],
      requires:['Windows 10 or Windows 11','Administrator rights'],
      safety:['Close your open programs first; files in use are skipped.','Prefetch is rebuilt by Windows, so the first launches afterwards may be slightly slower.','Drive optimization and SFC can take several minutes.','Files removed from Temp folders are not recoverable from the Recycle Bin.']
    },
    {
      id:'file-organizer', status:'available', category:'Productivity', icon:'folder',
      name:'Automatic File Organizer',
      desc:'Automatically organize files into appropriate folders based on their file types.',
      long:'Moves every file in the folder where the script is placed into a subfolder named after its file extension.',
      version:'v1.0.0', updated:'30 September 2026', platform:'Windows 10 / Windows 11',
      admin:false, size:'139 bytes',
      sha256:'ab5578f3df5dd819df1c9466077e0db60841f8d02b35c9931c2141a50045984b',
      file:'assets/toolkit/automatic-file-organizer.bat',
      runNote:'Copy the file into the folder you want to organize (for example a test folder), then run it there. It moves every file in its folder and cannot be undone.',
      extras:[],
      does:[
        'Looks at every file in the folder the script is run from.',
        'Creates a subfolder for each file extension (for example “pdf” or “jpg”).',
        'Moves each file into its matching subfolder.'
      ],
      requires:['Windows 10 or Windows 11','No administrator rights needed'],
      safety:['Copy the script into the folder you want to organize; do not run it from a system folder.','There is no confirmation prompt and no undo. Back up the folder first.','The script moves itself too, because it is also a file in that folder.']
    },
    {
      id:'it-quick-tools', status:'soon', category:'IT Support', icon:'terminal',
      name:'Windows IT Quick Tools',
      desc:'A collection of useful Windows commands and utilities for everyday IT support.',
      version:'v0.0.0', updated:'30 September 2026', platform:'Windows 10 / Windows 11'
    }
  ];

  const CATS = ['All','Windows','Cleanup','Productivity','Networking','IT Support'];
  const ICON = {
    update:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12A8 8 0 0 1 18.3 7.1"/><path d="M18.5 3v4.5H14M5.5 21v-4.5H10"/></svg>',
    broom:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 3l-6.5 6.5"/><path d="M11 8l5 5-3.5 3.5c-1.8 1.8-4.6 1.9-6.5.3L4 15l1-1c.8-.8 2-.8 2.8 0L11 8z"/><path d="M8 17l-1.5 4M11 18l-.5 3M5 15l-2 4"/></svg>',
    folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M8 13h8"/></svg>',
    request:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 9v6M9 12h6"/></svg>',
    terminal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9l3 3-3 3M13 15h4"/></svg>'
  };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const store = {
    get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
    set(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
  };
  const UNLOCK_KEY = 'sajidToolkitSupport';

  /* ---------- cards + search/filter ---------- */
  let cat = 'All', query = '';
  const empty = $('#tkEmpty');

  function renderCards(){
    const q = query.trim().toLowerCase();
    const list = TOOLKIT_TOOLS.filter(t =>
      (cat === 'All' || t.category === cat) &&
      (!q || (t.name + ' ' + t.desc + ' ' + t.category).toLowerCase().includes(q)));
    grid.innerHTML = list.map(t => `
      <article class="tk-card" role="listitem">
        <div class="tk-ico">${ICON[t.icon] || ICON.terminal}</div>
        <h3>${esc(t.name)}</h3>
        <p>${esc(t.desc)}</p>
        <ul class="tk-meta"><li>${esc(t.version)}</li><li>${esc(t.category)}</li>${t.status === 'available' ? `<li>Admin: ${t.admin ? 'Yes' : 'No'}</li>` : ''}</ul>
        ${t.status === 'available'
          ? `<button type="button" class="tk-btn tk-primary" data-open="${esc(t.id)}" aria-label="View tool: ${esc(t.name)}">View Tool</button>`
          : `<button type="button" class="tk-btn" disabled aria-disabled="true">Coming soon</button>`}
      </article>`).join('') + requestCard();
    if (empty) empty.hidden = list.length > 0;
  }

  const filterBox = $('#tkFilter');
  if (filterBox && TOOLKIT_TOOLS.length > 6) {
    filterBox.hidden = false;
    filterBox.innerHTML = `<input type="search" class="tk-search" id="tkSearch" placeholder="Search tools…" aria-label="Search tools" autocomplete="off">
      <div class="tk-chips" role="group" aria-label="Filter by category">${CATS.map((c,i) => `<button type="button" class="tk-fchip" data-cat="${c}" aria-pressed="${i === 0}">${c}</button>`).join('')}</div>`;
    $('#tkSearch').addEventListener('input', e => { query = e.target.value; renderCards(); });
    filterBox.addEventListener('click', e => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      cat = b.dataset.cat;
      $$('.tk-fchip', filterBox).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      renderCards();
    });
  }
  renderCards();

  /* ---------- BAT source viewer (tiny highlighter, no library) ---------- */
  const TOKEN = /(%[^%\s]*%|%%~?[a-z0-9])|\b(echo|if|else|exit|for|in|do|goto|call|set|pause|del|rd|md|mkdir|move|net|sfc|defrag|ipconfig|winget|powershell|not|exist|errorlevel)\b|("[^"]*")/gi;
  function highlight(src){
    return src.split(/\r?\n/).map(line => {
      if (/^\s*(::|rem\b)/i.test(line)) return `<span class="tk-c">${esc(line)}</span>`;
      if (/^\s*:[^:\s]/.test(line)) return `<span class="tk-l">${esc(line)}</span>`;
      let out = '', last = 0, m; TOKEN.lastIndex = 0;
      while ((m = TOKEN.exec(line))) {
        out += esc(line.slice(last, m.index));
        out += `<span class="${m[1] ? 'tk-v' : m[2] ? "tk-k" : "tk-s"}">${esc(m[0])}</span>`;
        last = m.index + m[0].length;
      }
      return out + esc(line.slice(last));
    }).join('\n');
  }
  const srcCache = {};
  async function loadSource(path){
    if (srcCache[path] != null) return srcCache[path];
    const r = await fetch(path, { cache:'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (srcCache[path] = await r.text());
  }
  async function copyText(text){
    try { await navigator.clipboard.writeText(text); return true; } catch(e){}
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch(e){}
    ta.remove(); return ok;
  }

  /* ---------- details modal ---------- */
  const modal = $('#tkModal'), panel = $('#tkPanel'), body = $('#tkmBody');
  let cur = null, lastFocus = null, closing = null;
  const need = { yt: !!TOOLKIT_CONFIG.youtubeUrl, ig: !!TOOLKIT_CONFIG.instagramUrl };
  const done = { yt: false, ig: false };
  const list = arr => `<ul class="tk-list">${(arr || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const unlocked = () => store.get(UNLOCK_KEY) === '1' || (!need.yt && !need.ig);
  const extOf = p => (p.split('.').pop() || 'file').toUpperCase();
  const fname = p => p.split('/').pop();

  function actionHTML(t){
    if (unlocked()) {
      return `<div class="tk-dl" id="tkDl" tabindex="-1">
        <p class="tk-ok">✓ Download unlocked</p>
        <h4>Download ${esc(t.name)}</h4>
        <div class="tk-row">
          <button type="button" class="tk-btn tk-primary" data-download>Download .${esc(extOf(t.file))}</button>
          <button type="button" class="tk-btn" data-src>View Source</button>
          ${(t.extras || []).map(x => `<a class="tk-btn" href="${esc(x.path)}" download>${esc(x.label)} (.${esc(extOf(x.path))})</a>`).join('')}
        </div>
        <p class="tk-honor" id="tkDlStatus" role="status" aria-live="polite">The file never runs automatically.</p>
        <section class="tk-how" aria-labelledby="tkHowTitle">
          <h4 id="tkHowTitle">How to run it</h4>
          <ol class="tk-list">
            <li>Click <strong>Download</strong>. The file is saved to your Downloads folder and is not opened. If Chrome or Edge says it “isn’t commonly downloaded”, choose <strong>Keep</strong>.</li>
            <li>Optional but recommended: right-click the file, choose <strong>Open with</strong>, then <strong>Notepad</strong>, to read what it does.</li>
            ${t.runNote ? `<li>${esc(t.runNote)}</li>` : ''}
            <li>${t.admin ? 'Right-click the file and choose <strong>Run as administrator</strong>, then click <strong>Yes</strong> on the Windows prompt.' : 'Double-click the file to run it.'}</li>
            <li>If Windows shows “Windows protected your PC”, click <strong>More info</strong>, check the file name, and only then choose <strong>Run anyway</strong>.</li>
            <li>A Command Prompt window shows each step. Wait until it finishes or asks you to press a key.</li>
          </ol>
        </section>
      </div>`;
    }
    return `<div class="tk-support">
      <h4>Support My Work</h4>
      <p>These free Windows tools are created and maintained as part of my IT learning and practical projects. If you find them useful, consider supporting my work.</p>
      <div class="tk-row">
        ${need.yt ? `<a class="tk-btn" href="${esc(TOOLKIT_CONFIG.youtubeUrl)}" target="_blank" rel="noopener noreferrer" data-social="yt"><span aria-hidden="true">▶</span> Subscribe on YouTube</a>` : ''}
        ${need.ig ? `<a class="tk-btn" href="${esc(TOOLKIT_CONFIG.instagramUrl)}" target="_blank" rel="noopener noreferrer" data-social="ig"><span aria-hidden="true">◎</span> Follow on Instagram</a>` : ''}
      </div>
      <p class="tk-honor">This is an honor-based unlock. This website cannot check whether you subscribed or followed.</p>
      <button type="button" class="tk-btn tk-primary" data-unlock hidden>I’ve Supported — Unlock Download</button>
      <p class="tk-honor" data-social-status role="status" aria-live="polite"></p>
    </div>
    <div class="tk-row" style="margin-top:14px"><button type="button" class="tk-btn" data-src>View Source</button></div>`;
  }

  function detailHTML(t){
    return `
      <header class="tk-mh"><div class="tk-ico">${ICON[t.icon] || ICON.terminal}</div>
        <div><h3 id="tkmTitle">${esc(t.name)}</h3><p class="tk-mv"><span class="tk-chip">${esc(t.version)}</span><span class="tk-chip">${esc(t.platform)}</span></p></div></header>
      <p class="tk-md">${esc(t.long || t.desc)}</p>
      <dl class="tk-facts">
        <div><dt>Version</dt><dd>${esc(t.version)}</dd></div>
        <div><dt>Windows compatibility</dt><dd>${esc(t.platform)}</dd></div>
        <div><dt>Administrator privileges required</dt><dd>${t.admin ? 'Yes' : 'No'}</dd></div>
        <div><dt>Last updated</dt><dd>${esc(t.updated)}</dd></div>
        <div><dt>File size</dt><dd>${esc(t.size)}</dd></div>
        <div><dt>File</dt><dd>${esc(fname(t.file))}</dd></div>
        <div class="wide"><dt>SHA-256</dt><dd class="mono">${esc(t.sha256 || 'Not published yet')}</dd>
          <span class="tk-hint">Compare after download: certutil -hashfile ${esc(fname(t.file))} SHA256</span></div>
      </dl>
      <div class="tk-cols">
        <section><h4>What the script does</h4>${list(t.does)}</section>
        <section><h4>Requirements</h4>${list(t.requires)}</section>
      </div>
      <h4>Safety information</h4>${list(t.safety)}
      <p class="tk-warn" role="note"><strong>Important:</strong> Always review a script before running it. Create a backup when appropriate.</p>
      <div id="tkAction">${actionHTML(t)}</div>
      <div class="tk-src" id="tkSrc" hidden>
        <div class="tk-src-bar"><span>${esc(fname(t.file))}</span><button type="button" class="tk-btn" data-copy>Copy Code</button></div>
        <pre tabindex="0" aria-label="Source code of ${esc(fname(t.file))}"><code id="tkCode">Loading…</code></pre>
      </div>
      <p class="tk-honor" id="tkCopyStatus" role="status" aria-live="polite"></p>`;
  }

  function show(html, trigger){
    clearTimeout(closing);
    lastFocus = trigger || document.activeElement;
    body.innerHTML = html;
    modal.classList.toggle('tk-ink', $('#toolkit').classList.contains('blur-ink'));   // follow the site's Aa text-colour switch
    modal.hidden = false;
    document.documentElement.classList.add('tk-open');
    panel.scrollTop = 0;
    requestAnimationFrame(() => modal.classList.add('is-open'));
    panel.focus();
  }
  function open(id, trigger){
    const t = TOOLKIT_TOOLS.find(x => x.id === id);
    if (!t || t.status !== 'available') return;
    cur = t; done.yt = done.ig = false;
    show(detailHTML(t), trigger);
  }
  function close(){
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    document.documentElement.classList.remove('tk-open');
    closing = setTimeout(() => { modal.hidden = true; }, reduceMotion ? 0 : 240);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  async function toggleSource(){
    const box = $('#tkSrc'), code = $('#tkCode');
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    code.textContent = 'Loading…';
    try {
      code.innerHTML = highlight(await loadSource(cur.file));
    } catch(e) {
      code.textContent = 'The source could not be loaded here. Check that the file exists at ' + cur.file + ' on the server.';
    }
    box.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block:'nearest' });
  }

  /* Downloads straight from this site as a Blob: no new tab, no Drive page, no navigation.
     If the browser supports it, the bytes are checked against the published SHA-256 first. */
  async function sha256Hex(buf){
    if (!(window.crypto && crypto.subtle)) return null;   // needs https or localhost
    const h = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async function downloadTool(btn){
    const st = $('#tkDlStatus'), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Preparing…'; st.textContent = 'Preparing your download…';
    try {
      const r = await fetch(cur.file, { cache:'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = await r.arrayBuffer();
      const hash = cur.sha256 ? await sha256Hex(buf) : null;
      if (hash && hash !== cur.sha256.toLowerCase()) {
        st.textContent = 'Download stopped: the file on the server does not match the published SHA-256. The site owner needs to update the hash or re-upload the file.';
        btn.disabled = false; btn.textContent = label; return;
      }
      const url = URL.createObjectURL(new Blob([buf], { type:'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url; a.download = fname(cur.file); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      btn.textContent = 'Downloaded ✓'; btn.classList.add('done');
      st.textContent = 'Downloaded ' + fname(cur.file) + (hash ? ' (SHA-256 matched the published value)' : '') + '. Nothing was run. Find it in your Downloads folder.';
      setTimeout(() => { btn.disabled = false; btn.textContent = label; btn.classList.remove('done'); }, 2500);
    } catch(err) {
      btn.disabled = false; btn.textContent = label;
      if (location.protocol === 'file:') {
        /* Browsers cannot read or force-save files from a page opened from disk, and would only display the script. */
        st.textContent = 'Downloads need the page to be served over http(s). This page is opened from a local file, so nothing was downloaded. Run “python -m http.server 8000” in your site folder and open http://localhost:8000, or test on the live site.';
      } else {
        const a = document.createElement('a');
        a.href = cur.file; a.download = fname(cur.file); document.body.appendChild(a); a.click(); a.remove();
        st.innerHTML = 'Direct download started without the SHA-256 check. If nothing downloads, the file is not on the server at <code>' + esc(cur.file) + '</code>.';
      }
    }
  }

  grid.addEventListener('click', e => {
    const b = e.target.closest('[data-open]');
    if (b) open(b.dataset.open, b);
  });

  modal.addEventListener('click', async e => {
    if (e.target.closest('[data-tk-close]')) { close(); return; }
    const soc = e.target.closest('[data-social]');
    if (soc) {   // the link opens normally in a new tab; we only note that it was clicked
      done[soc.dataset.social] = true;
      soc.classList.add('done');
      if (!soc.textContent.includes('✓')) soc.append(' ✓ Opened');
      const ready = (!need.yt || done.yt) && (!need.ig || done.ig);
      const unlock = $('[data-unlock]', modal);
      if (ready && unlock) {
        unlock.hidden = false;
        $('[data-social-status]', modal).textContent = 'Thanks. You can unlock the download now.';
      }
      return;
    }
    if (e.target.closest('[data-unlock]')) {
      store.set(UNLOCK_KEY, '1');
      $('#tkAction').innerHTML = actionHTML(cur);
      $('#tkDl').focus();
      return;
    }
    if (e.target.closest('[data-download]')) { downloadTool(e.target.closest('[data-download]')); return; }
    if (e.target.closest('[data-src]')) { toggleSource(); return; }
    if (e.target.closest('[data-copy]')) {
      const ok = await copyText($('#tkCode').textContent);
      const st = $('#tkCopyStatus'), btn = $('[data-copy]', modal);
      st.textContent = ok ? 'Code copied to clipboard.' : 'Copy failed. Select the code and copy it manually.';
      if (ok && btn) { btn.textContent = 'Copied ✓'; setTimeout(() => { btn.textContent = 'Copy Code'; }, 1800); }
    }
  });

  /* Esc closes; Tab stays inside the dialog; other keys don't leak to the site's shortcuts ("/" and Ctrl+K) */
  modal.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = $$('a[href],button:not([disabled]),input:not([type=hidden]),textarea,pre[tabindex]', panel).filter(x => !x.closest('[hidden]') && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* =================================================================
     CUSTOM SCRIPT REQUESTS
     A visitor describes a .bat they need + leaves an email. It lands in
     your inbox via Formspree (subject "BAT request BAT-XXXX"). You build
     the script, add it to TOOLKIT_TOOLS, upload the file, then reply with
     a direct link:  https://www.sajidmk.com/?tool=<tool-id>#toolkit
  ================================================================= */
  const REQUEST_ENDPOINT = 'https://formspree.io/f/mbglyrwl';   // same Formspree form as the contact section
  const KINDS = ['Cleanup','Network','Backup','Install / Update','Other'];
  let reqId = '', reqKind = 'Other';

  function requestCard(){
    return `<article class="tk-card tk-req" role="listitem">
      <div class="tk-ico">${ICON.request}</div>
      <h3>Need a custom BAT?<span class="tk-cursor" aria-hidden="true">_</span></h3>
      <p>Describe the task and leave your email. I’ll build it, publish it here, and email you when it’s ready.</p>
      <ul class="tk-meta"><li>Free</li><li>Made to order</li></ul>
      <button type="button" class="tk-btn tk-primary" data-request>Request a script</button>
    </article>`;
  }
  function requestHTML(){
    reqId = 'BAT-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    reqKind = 'Other';
    return `<header class="tk-mh"><div class="tk-ico">${ICON.request}</div>
        <div><h3 id="tkmTitle">Request a custom script</h3><p class="tk-mv"><span class="tk-chip">${reqId}</span><span class="tk-chip">Free · made to order</span></p></div></header>
      <p class="tk-md">Tell me what you want automated. I’ll write the .bat file, publish it in this Toolkit with viewable source code, and email you when it’s live.</p>
      <ol class="tk-track" aria-label="How it works"><li class="on">Send request</li><li>I build it</li><li>Emailed to you</li></ol>
      <form class="tk-rq" id="tkReq" novalidate>
        <div class="tk-chips" role="group" aria-label="Type of script">${KINDS.map(k => `<button type="button" class="tk-fchip" data-kind="${esc(k)}" aria-pressed="${k === 'Other'}">${esc(k)}</button>`).join('')}</div>
        <label class="tk-lab">Your email<input class="tk-in" type="email" name="email" required autocomplete="email" placeholder="you@example.com"></label>
        <label class="tk-lab">What should the script do?<textarea class="tk-in" name="message" rows="4" required maxlength="1000" placeholder="e.g. Back up my Documents folder to a USB drive every time I run it"></textarea></label>
        <input type="text" name="_gotcha" class="cf-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <pre class="tk-rq-pre" aria-hidden="true"><code id="rqPrev"></code></pre>
        <div class="tk-row"><button type="submit" class="tk-btn tk-primary" id="rqSend">Send request</button></div>
        <p class="tk-honor" id="rqStatus" role="status" aria-live="polite"></p>
      </form>
      <p class="tk-warn" role="note"><strong>Please don’t include</strong> passwords, license keys or private company data in your request.</p>`;
  }
  function rqPreview(){
    const f = $('#tkReq'), out = $('#rqPrev'); if (!f || !out) return;
    const task = f.message.value.trim().replace(/\s+/g, ' ').slice(0, 56) || '…';
    out.textContent = `@echo off\n:: request  ${reqId}  [${reqKind}]\n:: for      ${f.email.value.trim() || '…'}\n:: task     ${task}\n:: status   queued`;
  }

  grid.addEventListener('click', e => {
    const b = e.target.closest('[data-request]'); if (!b) return;
    cur = null;
    show(requestHTML(), b);
    rqPreview();
  });
  modal.addEventListener('click', e => {
    const k = e.target.closest('[data-kind]'); if (!k) return;
    reqKind = k.dataset.kind;
    $$('[data-kind]', modal).forEach(x => x.setAttribute('aria-pressed', String(x === k)));
    rqPreview();
  });
  modal.addEventListener('input', rqPreview);
  modal.addEventListener('submit', async e => {
    const f = e.target.closest('#tkReq'); if (!f) return;
    e.preventDefault();
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const btn = $('#rqSend'), st = $('#rqStatus'), mail = f.email.value.trim();
    btn.disabled = true; btn.textContent = 'Sending…'; st.textContent = '';
    const fd = new FormData(f);
    fd.append('request_id', reqId);
    fd.append('script_type', reqKind);
    fd.append('_subject', `BAT request ${reqId} — ${reqKind}`);
    try {
      const r = await fetch(REQUEST_ENDPOINT, { method:'POST', body:fd, headers:{ Accept:'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      f.outerHTML = `<div class="tk-dl" tabindex="-1" id="rqDone"><p class="tk-ok">✓ Request ${esc(reqId)} received</p>
        <p>I’ll build your script, publish it in the Toolkit, and email <strong>${esc(mail)}</strong> as soon as it’s live. Keep the request ID handy if you want to follow up.</p>
        <div class="tk-row"><button type="button" class="tk-btn" data-tk-close>Close</button></div></div>`;
      const first = $('.tk-track li:nth-child(2)', modal); if (first) first.classList.add('on');
      $('#rqDone').focus();
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Try again';
      st.textContent = 'Could not send your request. Check your connection and try again.';
    }
  });

  /* Direct link to a tool — use it in the "your script is ready" email: /?tool=<tool-id>#toolkit */
  const want = new URLSearchParams(location.search).get('tool');
  if (want && TOOLKIT_TOOLS.some(t => t.id === want && t.status === 'available')) {
    setTimeout(() => { $('#toolkit').scrollIntoView(); open(want); }, 700);
  }
})();
