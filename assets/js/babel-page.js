(() => {
  "use strict";

  document.documentElement.classList.add("babel-enhanced");

  const revealItems = Array.from(document.querySelectorAll(".babel-reveal"));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -7%" });

    revealItems.forEach((item) => observer.observe(item));
  }

  const hero = document.querySelector(".babel-hero");
  if (!hero || reduceMotion) return;

  let frame = null;
  const updateHero = () => {
    frame = null;
    const progress = Math.min(Math.max(window.scrollY / Math.max(hero.offsetHeight, 1), 0), 1);
    hero.style.setProperty("--film-shift", `${progress * 7}vh`);
    hero.style.setProperty("--copy-shift", `${progress * -5}vh`);
    hero.style.setProperty("--copy-opacity", String(Math.max(0, 1 - progress * 1.8)));
  };
  const scheduleHero = () => {
    if (frame) return;
    frame = requestAnimationFrame(updateHero);
  };

  window.addEventListener("scroll", scheduleHero, { passive: true });
  window.addEventListener("resize", scheduleHero, { passive: true });
  updateHero();
})();
