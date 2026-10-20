(() => {
  "use strict";

  // Works alongside installation-scroll.js, which moves the track.
  // This file adds: phase timeline, centre-image highlighting, scroll length,
  // and play/pause for the film inside the slider.

  const gallery = document.getElementById("images");
  const track = document.getElementById("galleryTrack");
  if (!gallery || !track) return;

  const items = Array.from(track.querySelectorAll(".gallery-item"));
  const cards = Array.from(track.querySelectorAll(".eph-phase-card"));
  const buttons = Array.from(gallery.querySelectorAll(".eph-timeline button[data-phase]"));
  const film = track.querySelector(".eph-film-video");
  const filmFigure = film ? film.closest(".gallery-item") : null;
  const soundButton = track.querySelector(".eph-sound");

  const desktopQuery = window.matchMedia("(min-width: 901px)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const ACTIVE_LINE = 0.55;   // a phase becomes current when its card passes 55% of the width
  const JUMP_LINE = 0.1;      // timeline clicks bring the phase card to 10% from the left
  const SCROLL_PER_PX = 0.94; // vertical scroll per pixel of horizontal travel

  let travel = 1;
  let inView = false;
  let frame = null;
  let currentItem = null;

  const isDesktop = () => desktopQuery.matches && !reduceMotion;

  function getTravel() {
    // Same formula as installation-scroll.js.
    return Math.max(1, track.scrollWidth - window.innerWidth + window.innerWidth * 0.13);
  }

  // Left edge of an element in the viewport when the track is not translated.
  function restingLeft(element) {
    const transform = getComputedStyle(track).transform;
    const shift = transform && transform !== "none" ? new DOMMatrixReadOnly(transform).m41 : 0;
    return element.getBoundingClientRect().left - shift;
  }

  function measure() {
    if (!isDesktop()) {
      gallery.style.removeProperty("height");
      return;
    }
    travel = getTravel();
    gallery.style.height = `${Math.round(window.innerHeight + travel * SCROLL_PER_PX)}px`;
    cards.forEach((card, index) => {
      const at = clamp((restingLeft(card) - window.innerWidth * ACTIVE_LINE) / travel, 0, 1);
      if (buttons[index]) buttons[index].style.setProperty("--at", at.toFixed(4));
    });
    window.dispatchEvent(new Event("scroll"));
  }

  function setCurrent(item) {
    if (item === currentItem) return;
    currentItem = item;
    items.forEach((element) => element.classList.toggle("is-current", element === item));
    syncFilm();
  }

  function update() {
    frame = null;
    if (!isDesktop()) return;

    const centre = window.innerWidth / 2;
    let nearest = null;
    let nearestDistance = Infinity;
    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - centre);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = item;
      }
    });
    setCurrent(nearest);

    let phase = 0;
    cards.forEach((card, index) => {
      if (card.getBoundingClientRect().left < window.innerWidth * ACTIVE_LINE) phase = index + 1;
    });
    buttons.forEach((button, index) => {
      const active = index + 1 === phase;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });

    if (inView) frame = requestAnimationFrame(update);
  }

  function start() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  // Run the highlight loop only while the slider is on screen.
  new IntersectionObserver((entries) => {
    inView = entries.some((entry) => entry.isIntersecting);
    if (inView) start();
    syncFilm();
  }, { rootMargin: "100px 0px" }).observe(gallery);

  buttons.forEach((button, index) => {
    button.addEventListener("click", () => {
      const card = cards[index];
      if (!card || !isDesktop()) return;
      const progress = clamp((restingLeft(card) - window.innerWidth * JUMP_LINE) / travel, 0, 1);
      const galleryTop = gallery.getBoundingClientRect().top + window.scrollY;
      const scrollDistance = Math.max(1, gallery.offsetHeight - window.innerHeight);
      window.scrollTo({ top: galleryTop + progress * scrollDistance + 1, behavior: "smooth" });
    });
  });

  // ── Film ──
  let filmVisible = false;

  function syncFilm() {
    if (!film || reduceMotion) return;
    const shouldPlay = isDesktop() ? inView && currentItem === filmFigure : filmVisible;
    if (shouldPlay && film.paused) {
      const attempt = film.play();
      if (attempt && attempt.catch) attempt.catch(() => {});
    } else if (!shouldPlay && !film.paused) {
      film.pause();
    }
  }

  if (film) {
    if (reduceMotion) film.setAttribute("controls", "");

    new IntersectionObserver((entries) => {
      filmVisible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
      syncFilm();
    }, { threshold: [0, 0.5, 1] }).observe(film);

    if (soundButton) {
      soundButton.addEventListener("click", () => {
        film.muted = !film.muted;
        soundButton.setAttribute("aria-pressed", film.muted ? "false" : "true");
        soundButton.textContent = film.muted ? "Sound off" : "Sound on";
        if (!film.muted && film.paused) {
          const attempt = film.play();
          if (attempt && attempt.catch) attempt.catch(() => {});
        }
      });
    }
  }

  window.addEventListener("resize", () => { measure(); start(); }, { passive: true });
  window.addEventListener("load", () => { measure(); start(); });
  desktopQuery.addEventListener?.("change", () => {
    if (!isDesktop()) items.forEach((item) => item.classList.remove("is-current"));
    currentItem = null;
    measure();
    start();
    syncFilm();
  });

  measure();
  start();
})();
