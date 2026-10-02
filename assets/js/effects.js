/* =========================================================
   SANA — Effets visuels (chargé après main.js)
   Tout est désactivé si le visiteur a demandé moins d'animations.
   ========================================================= */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const root = document.documentElement;

  // ---------- Écran d'ouverture (une seule fois par visite) ----------
  const loader = document.getElementById("loader");
  if (loader) {
    let seen = false;
    try { seen = sessionStorage.getItem("sana-intro") === "1"; sessionStorage.setItem("sana-intro", "1"); } catch (e) {}
    if (seen || reduce) loader.remove();
    else setTimeout(() => { loader.classList.add("done"); setTimeout(() => loader.remove(), 700); }, 650);
  }

  // ---------- En-tête compact + barre de progression ----------
  const header = document.querySelector(".header");
  const bar = document.getElementById("scrollProgress");
  const toTop = document.getElementById("toTop");
  let ticking = false;
  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header.classList.toggle("scrolled", y > 24);
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    if (toTop) toTop.classList.toggle("show", y > 900);
    ticking = false;
  }
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }));

  // Lien du menu correspondant à la section visible
  const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]:not(.btn)')];
  const sections = navLinks.map(a => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) navLinks.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(s => spy.observe(s));
  }

  if (reduce) return;

  // ---------- Titre principal : apparition mot par mot ----------
  const h1 = document.querySelector(".hero h1");
  if (h1) {
    let i = 0;
    h1.querySelectorAll("span, em").forEach(part => {
      const words = part.textContent.trim().split(/\s+/);
      part.innerHTML = words.map(w => `<span class="w" style="--i:${i++}">${w.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`).join(" ");
    });
    h1.classList.add("split");
  }

  // ---------- Apparition des blocs au défilement ----------
  const groups = [
    ".section-head", ".about-text", ".features li", ".product", ".species-tab", ".panel",
    ".steps li", ".review", ".faq-grid > div:first-child", ".faq-item", ".cta-in > *", ".contact-info", ".strip-item",
  ];
  const targets = [];
  groups.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      const siblings = el.parentElement ? [...el.parentElement.children].filter(c => c.matches(sel)) : [el];
      el.style.setProperty("--d", `${Math.min(siblings.indexOf(el), 6) * 90}ms`);
      el.classList.add("rv");
      targets.push(el);
    });
  });
  root.classList.add("fx");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    targets.forEach(el => io.observe(el));
  } else {
    targets.forEach(el => el.classList.add("in"));
  }
  // sécurité : tout est visible au bout de 4 s quoi qu'il arrive
  setTimeout(() => targets.forEach(el => el.classList.add("in")), 4000);

  // ---------- Compteurs animés ----------
  document.querySelectorAll(".hero-facts dt").forEach((dt, k) => {
    const m = dt.textContent.match(/^(\d+)(.*)$/);
    if (!m) return;
    const end = +m[1], suffix = m[2];
    const t0 = performance.now() + 500 + k * 150, dur = 1200;
    dt.textContent = "0" + suffix;
    (function step(now) {
      const p = Math.min(1, Math.max(0, (now - t0) / dur));
      dt.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  });

  // ---------- Fiche formule : inclinaison 3D au survol ----------
  const spec = document.querySelector(".spec");
  const hero = document.querySelector(".hero");
  if (spec && hero && finePointer) {
    hero.addEventListener("pointermove", e => {
      const r = spec.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      spec.style.transform = `perspective(1000px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-4px)`;
    });
    hero.addEventListener("pointerleave", () => { spec.style.transform = ""; });
  }

  // ---------- Emblème du hero : léger parallaxe ----------
  const emblem = document.querySelector(".hero-emblem");
  if (emblem) {
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      if (y < 900) emblem.style.transform = `translateY(${y * 0.25}px) rotate(${y * 0.02}deg)`;
    }, { passive: true });
  }

  // ---------- Cartes : reflet lumineux qui suit la souris ----------
  if (finePointer) {
    document.querySelectorAll(".product, .features li, .review").forEach(card => {
      card.addEventListener("pointermove", e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
  }

  // ---------- Hero : grains d'aliment qui flottent ----------
  const canvas = document.getElementById("heroFx");
  if (canvas && hero) {
    const ctx = canvas.getContext("2d");
    const colors = ["rgba(255,161,36,", "rgba(243,129,29,", "rgba(255,255,255,", "rgba(122,186,80,"];
    let w, h, dpr, grains = [], running = true, raf;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = hero.clientWidth; h = hero.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(70, (w * h) / 16000));
      grains = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: 1.5 + Math.random() * 3.5, rot: Math.random() * Math.PI,
        vx: (Math.random() - 0.5) * 0.25, vy: -0.15 - Math.random() * 0.35, vr: (Math.random() - 0.5) * 0.01,
        c: colors[Math.floor(Math.random() * colors.length)], a: 0.15 + Math.random() * 0.4,
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const g of grains) {
        g.x += g.vx; g.y += g.vy; g.rot += g.vr;
        if (g.y < -10) { g.y = h + 10; g.x = Math.random() * w; }
        if (g.x < -10) g.x = w + 10; else if (g.x > w + 10) g.x = -10;
        ctx.save();
        ctx.translate(g.x, g.y); ctx.rotate(g.rot);
        ctx.fillStyle = g.c + g.a + ")";
        ctx.beginPath(); ctx.ellipse(0, 0, g.r * 1.6, g.r, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      if (running) raf = requestAnimationFrame(draw);
    }
    resize();
    draw();
    window.addEventListener("resize", () => { cancelAnimationFrame(raf); resize(); if (running) draw(); });
    // pause quand le hero n'est plus visible
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([en]) => {
        const vis = en.isIntersecting;
        if (vis && !running) { running = true; draw(); }
        if (!vis) { running = false; cancelAnimationFrame(raf); }
      }).observe(hero);
    }
  }
})();
