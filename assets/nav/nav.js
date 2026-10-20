/*
  Site navigation behaviour — shared by www.zhixingzhang.com and career.zhixingzhang.com
  (career loads it from https://www.zhixingzhang.com/assets/nav/nav.js; keep this path).
  Builds the mobile menu from the nav's own links, so the markup only has to exist once.
*/
(() => {
  "use strict";

  const nav = document.querySelector(".site-nav");
  if (!nav || nav.dataset.navReady === "true") return;
  nav.dataset.navReady = "true";

  const toggle = nav.querySelector(".nav-toggle");
  if (!toggle) return;

  const menu = document.createElement("div");
  menu.className = "nav-menu";
  menu.id = "site-nav-menu";
  menu.setAttribute("aria-hidden", "true");

  nav.querySelectorAll(".nav-links a").forEach((link) => {
    menu.appendChild(link.cloneNode(true));
  });

  const social = document.createElement("div");
  social.className = "nav-menu-social";
  nav.querySelectorAll(".nav-docs a").forEach((link) => {
    social.appendChild(link.cloneNode(true));
  });
  if (social.childElementCount) menu.appendChild(social);

  nav.insertAdjacentElement("afterend", menu);
  toggle.setAttribute("aria-controls", menu.id);

  const focusable = () => [...menu.querySelectorAll("a")];
  focusable().forEach((link) => link.setAttribute("tabindex", "-1"));

  const setOpen = (open) => {
    document.body.classList.toggle("nav-menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.setAttribute("aria-hidden", String(!open));
    focusable().forEach((link) => link.setAttribute("tabindex", open ? "0" : "-1"));
  };

  toggle.addEventListener("click", () => {
    setOpen(!document.body.classList.contains("nav-menu-open"));
  });

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("nav-menu-open")) {
      setOpen(false);
      toggle.focus();
    }
  });

  window.matchMedia("(max-width: 840px)").addEventListener("change", (event) => {
    if (!event.matches) setOpen(false);
  });
})();
