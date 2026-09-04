document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Scroll-reveal */
  const elements = document.querySelectorAll('.animated');
  const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);
  elements.forEach(el => observer.observe(el));

  /* Nav scroll state + mobile toggle */
  const nav = document.querySelector('.site-nav');
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  const onScroll = () => {
    if (window.scrollY > 40) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

  /* Depth gauge (analog needle dial) */
  const depthGauge = document.querySelector('.depth-gauge');
  const depthNeedle = document.getElementById('depth-needle');
  const depthNeedleTail = document.getElementById('depth-needle-tail');
  const depthReadoutNum = document.getElementById('depth-readout-num');
  const depthLabel = document.querySelector('.depth-label');
  const MAX_DEPTH = 40; // recreational scuba limit, in metres
  const SWEEP_START = -135; // degrees, needle rest position (0 m)
  const SWEEP_RANGE = 270; // degrees, full sweep to max depth
  const NEEDLE_LEN = 24; // stays well clear of the tick-label ring (radius ~37) at every angle
  const TAIL_LEN = 8;
  const DEPTH_STOPS = [
    { at: 0, label: 'Surface' },
    { at: 0.15, label: 'Descending' },
    { at: 0.4, label: 'Mid-Water' },
    { at: 0.7, label: 'Reef Zone' },
    { at: 0.92, label: 'Seabed' }
  ];
  const BG_SHALLOW = [13, 40, 51]; // sunlit surface water
  const BG_DEEP = [4, 7, 9]; // near-black abyss
  const root = document.documentElement;

  const heroEl = document.querySelector('.hero');
  let gaugeVisible = false;

  /* Exhale-style bubbles: a big burst when the gauge first surfaces, then a
     smaller puff every 5m of depth crossed while scrolling, like breaths
     released on the way down (or up). */
  const bubbleContainer = document.getElementById('depth-gauge-bubbles');
  const rand = (min, max) => min + Math.random() * (max - min);

  const spawnBubbles = (count, { size, drift, rise, delay, duration, cleanup }) => {
    if (!bubbleContainer) return;
    const frag = document.createDocumentFragment();
    const spans = [];
    for (let i = 0; i < count; i++) {
      const span = document.createElement('span');
      span.style.setProperty('--bsize', `${rand(size[0], size[1]).toFixed(1)}px`);
      span.style.setProperty('--bleft', `${rand(33, 67).toFixed(1)}%`);
      span.style.setProperty('--bx', `${rand(drift[0], drift[1]).toFixed(1)}px`);
      span.style.setProperty('--by', `${rand(rise[0], rise[1]).toFixed(1)}px`);
      span.style.animationDelay = `${rand(delay[0], delay[1]).toFixed(2)}s`;
      span.style.animationDuration = `${rand(duration[0], duration[1]).toFixed(2)}s`;
      frag.appendChild(span);
      spans.push(span);
    }
    bubbleContainer.appendChild(frag);
    if (cleanup) {
      spans.forEach(span => span.addEventListener('animationend', () => span.remove(), { once: true }));
    }
  };

  spawnBubbles(40, {
    size: [4, 14], drift: [-120, 120], rise: [-150, -280],
    delay: [0, 0.9], duration: [1.1, 1.9], cleanup: false
  });

  const spawnDepthPuff = () => spawnBubbles(10, {
    size: [3, 9], drift: [-70, 70], rise: [-100, -180],
    delay: [0, 0.25], duration: [0.8, 1.3], cleanup: true
  });
  let lastMilestone = 0; // 0m is covered by the entrance burst above

  const SPRING_STIFFNESS = 0.07;
  const SPRING_DAMPING = 0.8;
  const SETTLE_EPSILON = 0.0006;
  let targetProgress = 0;
  let displayProgress = 0;
  let springVelocity = 0;
  let springFrame = null;
  const gaugeReady = depthGauge && depthNeedle && depthNeedleTail && depthReadoutNum && depthLabel;

  const renderGauge = progress => {
    const clamped = Math.min(Math.max(progress, 0), 1);
    const depth = Math.round(clamped * MAX_DEPTH);
    const label = DEPTH_STOPS.reduce((acc, stop) => (clamped >= stop.at ? stop.label : acc), 'Surface');
    const angleRad = ((SWEEP_START + clamped * SWEEP_RANGE) * Math.PI) / 180;

    depthNeedle.setAttribute('x2', 50 + NEEDLE_LEN * Math.sin(angleRad));
    depthNeedle.setAttribute('y2', 50 - NEEDLE_LEN * Math.cos(angleRad));
    depthNeedleTail.setAttribute('x2', 50 - TAIL_LEN * Math.sin(angleRad));
    depthNeedleTail.setAttribute('y2', 50 + TAIL_LEN * Math.cos(angleRad));
    depthReadoutNum.textContent = depth;
    depthLabel.textContent = label;

    const milestone = Math.floor(depth / 5) * 5;
    if (milestone !== lastMilestone) {
      lastMilestone = milestone;
      if (gaugeVisible && !prefersReducedMotion) spawnDepthPuff();
    }
  };

  const springTick = () => {
    const diff = targetProgress - displayProgress;
    springVelocity = (springVelocity + diff * SPRING_STIFFNESS) * SPRING_DAMPING;
    displayProgress += springVelocity;
    renderGauge(displayProgress);

    if (Math.abs(diff) > SETTLE_EPSILON || Math.abs(springVelocity) > SETTLE_EPSILON) {
      springFrame = requestAnimationFrame(springTick);
    } else {
      displayProgress = targetProgress;
      springVelocity = 0;
      renderGauge(displayProgress);
      springFrame = null;
    }
  };

  const onDepthScroll = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(Math.max(window.scrollY / scrollable, 0), 1) : 0;
    targetProgress = progress;

    const bg = BG_SHALLOW.map((start, i) => Math.round(start + (BG_DEEP[i] - start) * progress));
    root.style.setProperty('--depth-bg', `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`);

    if (gaugeReady) {
      // Trigger early in the hero (48%) rather than waiting for it to mostly
      // clear. The hero's own background overlay now stops 55% short of the
      // hero's bottom (see .hero::after), so this stays just past where that
      // overlay ends instead of surfacing invisibly behind it.
      const heroBottom = heroEl ? heroEl.offsetHeight : 500;
      const showAt = Math.max(heroBottom * 0.48, 80);
      const hideAt = Math.max(heroBottom * 0.48 - 180, 40);

      if (!gaugeVisible && window.scrollY > showAt) {
        gaugeVisible = true;
        depthGauge.classList.add('is-visible');
      } else if (gaugeVisible && window.scrollY < hideAt) {
        gaugeVisible = false;
        depthGauge.classList.remove('is-visible');
      }
      if (prefersReducedMotion) {
        displayProgress = progress;
        renderGauge(progress);
      } else if (springFrame === null) {
        springFrame = requestAnimationFrame(springTick);
      }
    }
  };
  window.addEventListener('scroll', onDepthScroll, { passive: true });
  onDepthScroll();

  /* Stat count-up */
  const statEls = document.querySelectorAll('.stat-num');
  const statObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      if (prefersReducedMotion || !target) {
        el.textContent = target + suffix;
        obs.unobserve(el);
        return;
      }
      const duration = 1200;
      const start = performance.now();
      const tick = now => {
        const progress = Math.min((now - start) / duration, 1);
        const value = Math.round(target * (1 - Math.pow(1 - progress, 3)));
        el.textContent = value + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  statEls.forEach(el => statObserver.observe(el));

  /* Constellation / network background */
  const canvas = document.getElementById('network-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const hero = canvas.closest('.hero');
  let width, height, bubbles;
  const BUBBLE_COUNT = 34;

  function resize() {
    width = canvas.width = hero.offsetWidth;
    height = canvas.height = hero.offsetHeight;
  }

  function makeBubble(spawnAnywhere) {
    const r = Math.random() * 5 + 1.5;
    return {
      x: Math.random() * width,
      y: spawnAnywhere ? Math.random() * height : height + r,
      r,
      speed: Math.random() * 0.5 + 0.15,
      drift: Math.random() * 0.6 - 0.3,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.02 + 0.01
    };
  }

  function makeBubbles() {
    bubbles = Array.from({ length: BUBBLE_COUNT }, () => makeBubble(true));
  }

  function step() {
    ctx.clearRect(0, 0, width, height);

    bubbles.forEach(b => {
      b.wobble += b.wobbleSpeed;
      b.y -= b.speed;
      b.x += b.drift * 0.3 + Math.sin(b.wobble) * 0.3;

      if (b.y < -b.r * 2) Object.assign(b, makeBubble(false));

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(33, 199, 193, ${0.35 - b.r * 0.03})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(33, 199, 193, 0.06)';
      ctx.fill();
    });

    if (!prefersReducedMotion) requestAnimationFrame(step);
  }

  resize();
  makeBubbles();
  step();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      makeBubbles();
      if (prefersReducedMotion) step();
    }, 200);
  });
});
