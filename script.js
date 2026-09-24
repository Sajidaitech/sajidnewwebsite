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
