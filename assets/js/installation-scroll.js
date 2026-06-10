(() => {
  "use strict";

  const gallery = document.getElementById("images");
  const track = document.getElementById("galleryTrack");
  const progressElement = document.getElementById("galleryProgress");
  const panels = Array.from(document.querySelectorAll(".gallery-item"));
  const hero = document.querySelector(".installation-hero");
  const heroImage = document.querySelector(".installation-hero-image img");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const desktopQuery = window.matchMedia("(min-width: 901px)");

  if (!gallery || !track) return;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  let targetX = 0;
  let currentX = 0;
  let targetProgress = 0;
  let currentProgress = 0;
  let renderFrame = null;
  let readFrame = null;
  let lastActiveIndex = -1;

  function readTargets() {
    if (hero && heroImage && !reduceMotion && desktopQuery.matches) {
      const rect = hero.getBoundingClientRect();
      const distance = Math.max(1, hero.offsetHeight - window.innerHeight);
      const progress = clamp(-rect.top / distance, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      heroImage.style.transform = `translate3d(0, ${-190 * eased}px, 0) scale(1.035) scaleY(0.94)`;
    }

    const rect = gallery.getBoundingClientRect();
    const scrollDistance = Math.max(1, gallery.offsetHeight - window.innerHeight);
    targetProgress = clamp(-rect.top / scrollDistance, 0, 1);
    const travel = Math.max(0, track.scrollWidth - window.innerWidth + window.innerWidth * 0.13);
    targetX = -travel * targetProgress;
  }

  function updateActivePanel() {
    if (!panels.length) return;
    const index = clamp(Math.round(currentProgress * (panels.length - 1)), 0, panels.length - 1);
    if (index === lastActiveIndex) return;
    lastActiveIndex = index;
    panels.forEach((panel, panelIndex) => panel.classList.toggle("is-active", panelIndex === index));
  }

  function applyFrame() {
    if (!reduceMotion && desktopQuery.matches) {
      track.style.transform = `translate3d(${currentX}px, 0, 0)`;
      if (progressElement) progressElement.style.transform = `scaleX(${currentProgress})`;
      updateActivePanel();
    } else {
      track.style.transform = "none";
      panels.forEach((panel) => panel.classList.add("is-active"));
    }
  }

  function render() {
    renderFrame = null;
    currentX += (targetX - currentX) * 0.12;
    currentProgress += (targetProgress - currentProgress) * 0.14;
    applyFrame();

    if (Math.abs(targetX - currentX) > 0.35 || Math.abs(targetProgress - currentProgress) > 0.0015) {
      renderFrame = requestAnimationFrame(render);
    }
  }

  function scheduleRead() {
    if (readFrame) return;
    readFrame = requestAnimationFrame(() => {
      readFrame = null;
      readTargets();
      if (!renderFrame) renderFrame = requestAnimationFrame(render);
    });
  }

  window.addEventListener("scroll", scheduleRead, { passive: true });
  window.addEventListener("resize", scheduleRead, { passive: true });
  desktopQuery.addEventListener?.("change", scheduleRead);

  readTargets();
  currentX = targetX;
  currentProgress = targetProgress;
  applyFrame();
})();
