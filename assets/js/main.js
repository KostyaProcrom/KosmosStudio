/* =========================================================
   KosmosStudio — interactions
   ========================================================= */

(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Sticky header ---------- */
  const header = document.getElementById("header");
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile navigation ---------- */
  const nav = document.getElementById("nav");
  const navToggle = document.getElementById("navToggle");

  const closeMenu = () => {
    if (!nav || !navToggle) return;
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Открыть меню");
    document.body.classList.remove("menu-open");
  };

  if (nav && navToggle) {
    navToggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
      document.body.classList.toggle("menu-open", open);
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });

    document.addEventListener("click", (event) => {
      if (!nav.classList.contains("is-open")) return;
      if (nav.contains(event.target) || navToggle.contains(event.target)) return;
      closeMenu();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 860) closeMenu();
    });
  }

  /* ---------- Scroll reveal ---------- */
  const revealItems = Array.from(document.querySelectorAll(".reveal"));

  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  /* ---------- Pointer spotlight on cards ---------- */
  const spotlights = document.querySelectorAll(".card, .project");

  spotlights.forEach((card) => {
    if (reduceMotion.matches) return;
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    });
  });

  /* ---------- Current year ---------- */
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Starfield ---------- */
  const canvas = document.getElementById("stars");

  if (canvas) {
    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars = [];
    let shootingStar = null;
    let nextShootAt = 4000 + Math.random() * 5000;
    let rafId = null;
    let lastFrame = 0;

    const makeStars = () => {
      const count = Math.round(Math.min(190, Math.max(60, (width * height) / 11000)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.25 + 0.25,
        base: Math.random() * 0.5 + 0.18,
        speed: Math.random() * 0.9 + 0.3,
        phase: Math.random() * Math.PI * 2,
        tint: Math.random() < 0.18 ? "cyan" : Math.random() < 0.14 ? "violet" : "white",
      }));
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeStars();
      draw(performance.now(), true);
    };

    const colorFor = (tint) => {
      if (tint === "cyan") return "150, 230, 255";
      if (tint === "violet") return "190, 170, 255";
      return "255, 255, 255";
    };

    const draw = (time, staticFrame) => {
      ctx.clearRect(0, 0, width, height);

      const t = time / 1000;

      for (const star of stars) {
        const flicker = staticFrame
          ? 0.75
          : 0.6 + Math.sin(t * star.speed + star.phase) * 0.34;
        const alpha = Math.max(0.05, star.base * flicker + 0.08);
        const rgb = colorFor(star.tint);

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
        ctx.fill();

        if (star.r > 1.05) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.r * 3.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb}, ${alpha * 0.09})`;
          ctx.fill();
        }
      }

      if (shootingStar) {
        const s = shootingStar;
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 14, s.y - s.vy * 14);
        grad.addColorStop(0, `rgba(190, 230, 255, ${s.alpha})`);
        grad.addColorStop(1, "rgba(190, 230, 255, 0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 14, s.y - s.vy * 14);
        ctx.stroke();
      }
    };

    const tick = (time) => {
      if (!lastFrame) lastFrame = time;
      const delta = Math.min(time - lastFrame, 48);
      lastFrame = time;

      draw(time, false);

      if (!shootingStar && time > nextShootAt) {
        const startX = width * (0.1 + Math.random() * 0.6);
        shootingStar = {
          x: startX,
          y: height * (0.05 + Math.random() * 0.35),
          vx: 6 + Math.random() * 3,
          vy: 2.6 + Math.random() * 1.6,
          alpha: 0.85,
          life: 0,
        };
      }

      if (shootingStar) {
        shootingStar.x += (shootingStar.vx * delta) / 16;
        shootingStar.y += (shootingStar.vy * delta) / 16;
        shootingStar.life += delta;
        shootingStar.alpha = Math.max(0, 0.85 - shootingStar.life / 900);
        if (shootingStar.alpha <= 0 || shootingStar.x > width + 120 || shootingStar.y > height + 120) {
          shootingStar = null;
          nextShootAt = time + 6000 + Math.random() * 9000;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    const start = () => {
      if (rafId !== null) return;
      lastFrame = 0;
      rafId = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (rafId === null) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    };

    resize();

    if (reduceMotion.matches) {
      draw(0, true);
    } else {
      start();
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) stop();
        else start();
      });
      reduceMotion.addEventListener("change", (event) => {
        if (event.matches) {
          stop();
          draw(0, true);
        } else {
          start();
        }
      });
    }

    let resizeTimer;
    window.addEventListener(
      "resize",
      () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(resize, 150);
      },
      { passive: true }
    );
  }
})();
