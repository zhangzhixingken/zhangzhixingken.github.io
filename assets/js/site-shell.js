(() => {
  "use strict";
  // thin cursor preset active


  function ensureUnifiedCursor() {
    let cursor = document.getElementById("gestureCursor");
    if (!cursor) {
      cursor = document.createElement("div");
      cursor.className = "gesture-cursor";
      cursor.id = "gestureCursor";
      cursor.setAttribute("aria-hidden", "true");
      document.body.prepend(cursor);
    }
    return cursor;
  }

  function setupUnifiedMouseCursor() {
    const cursor = ensureUnifiedCursor();
    if (!window.matchMedia || !window.matchMedia("(pointer: fine)").matches) return;

    document.body.classList.add("has-unified-cursor");

    let visible = false;
    const setPosition = (x, y) => {
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    };

    document.addEventListener("mousemove", (event) => {
      // When a hand is being tracked, MediaPipe updates the same element.
      // A real mouse movement can still take over the visual cursor, so there
      // is always only one cursor object on screen.
      setPosition(event.clientX, event.clientY);
      visible = true;
      cursor.classList.add("is-visible", "is-mouse-source");
      cursor.classList.remove("is-gesture-source", "is-pinching", "is-scrolling");
      const target = event.target;
      const card = target?.closest?.(".orbit-card, .art-card, .career-card, .gallery-frame, .photo-slide");
      const link = target?.closest?.("a, button, input, label, [role='button']");
      cursor.classList.toggle("is-card", Boolean(card));
      cursor.classList.toggle("is-link", Boolean(link) && !card);
    }, { passive: true });

    document.addEventListener("mousedown", () => cursor.classList.add("is-mouse-down"), { passive: true });
    document.addEventListener("mouseup", () => cursor.classList.remove("is-mouse-down"), { passive: true });
    document.addEventListener("mouseleave", () => {
      visible = false;
      cursor.classList.remove("is-visible", "is-link", "is-card", "is-mouse-down");
    }, { passive: true });
  }

  function createDefaultGestureBridge() {
    let downTarget = null;
    let last = { x: 0, y: 0 };
    let moved = 0;

    const insidePanel = (element) => Boolean(element?.closest?.(".gesture-panel"));
    const clickable = (element) => element?.closest?.("a, button, input, label, [role='button']") || null;

    const scrollDocument = (deltaY) => {
      const rootScroller = document.scrollingElement || document.documentElement || document.body;
      if (rootScroller && rootScroller.scrollHeight > rootScroller.clientHeight) {
        rootScroller.scrollTop += deltaY;
        return;
      }
      window.scrollBy({ top: deltaY, left: 0, behavior: "auto" });
    };

    return {
      move(x, y) {
        if (!downTarget) return;
        moved += Math.abs(x - last.x) + Math.abs(y - last.y);
        last = { x, y };
      },
      down(x, y) {
        const element = document.elementFromPoint(x, y);
        if (insidePanel(element)) return;
        downTarget = element;
        last = { x, y };
        moved = 0;
      },
      up(x, y) {
        const released = document.elementFromPoint(x, y);
        const target = clickable(released) || clickable(downTarget);
        if (moved < 20 && target && !insidePanel(target)) target.click();
        downTarget = null;
      },
      scrollByDelta(deltaY) {
        scrollDocument(deltaY);
      }
    };
  }

  function setupResponsiveProjectTitles() {
    const selector = ".hero-title, .installation-title, .cover-title";
    let resizeFrame = 0;

    const fitTitles = () => {
      document.querySelectorAll(selector).forEach((title) => {
        title.style.removeProperty("font-size");

        const maximumSize = parseFloat(getComputedStyle(title).fontSize);
        const minimumSize = Math.min(maximumSize, window.innerWidth <= 480 ? 14 : 16);

        const fits = (size) => {
          title.style.fontSize = `${size}px`;
          const range = document.createRange();
          range.selectNodeContents(title);
          const lineTops = [];
          Array.from(range.getClientRects()).forEach((rect) => {
            if (rect.width > 0 && !lineTops.some((top) => Math.abs(top - rect.top) < 1)) {
              lineTops.push(rect.top);
            }
          });
          const withinTwoLines = lineTops.length <= 2;
          const withinWidth = title.scrollWidth <= title.clientWidth + 1;
          return withinTwoLines && withinWidth;
        };

        if (fits(maximumSize)) return;

        let low = minimumSize;
        let high = maximumSize;
        for (let index = 0; index < 12; index += 1) {
          const middle = (low + high) / 2;
          if (fits(middle)) low = middle;
          else high = middle;
        }
        title.style.fontSize = `${low}px`;
      });
    };

    const scheduleFit = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(fitTitles);
    };

    scheduleFit();
    window.addEventListener("resize", scheduleFit, { passive: true });
    document.fonts?.ready.then(scheduleFit);
  }

  const path = window.location.pathname;
  const nested = /\/(art|career)\//.test(path);
  const root = nested ? "../" : "";
  const page = path.split("/").pop() || "index.html";
  setupUnifiedMouseCursor();
  setupResponsiveProjectTitles();

  const section = path.includes("/art/") || page === "arts.html"
    ? "arts"
    : path.includes("/career/") || page === "careers.html"
      ? "work"
      : page === "about.html"
        ? "about"
        : page === "contact.html"
          ? "contact"
          : "home";

  const nav = document.querySelector(".site-nav") || document.createElement("nav");
  nav.className = "site-nav";
  nav.dataset.mobileReady = "true";
  nav.setAttribute("aria-label", "Main navigation");
  nav.innerHTML = `
    <a class="logo" href="/">Zhixing Zhang</a>
    <ul class="nav-links">
      <li><a href="${root}arts.html"${section === "arts" ? ' class="is-active"' : ""}>Arts</a></li>
      <li><a href="https://career.zhixingzhang.com">Career</a></li>
      <li><a href="${root}about.html"${section === "about" ? ' class="is-active"' : ""}>About</a></li>
      <li><a href="${root}contact.html"${section === "contact" ? ' class="is-active"' : ""}>Contact</a></li>
    </ul>
    <div class="nav-docs" aria-label="Social media">
      <a class="nav-instagram" href="https://www.instagram.com/zhixing_gallery/" target="_blank" rel="noopener" title="Instagram" data-help="Visit Zhixing Zhang’s Instagram." aria-label="Visit Zhixing Zhang’s Instagram"><span class="nav-instagram-icon" aria-hidden="true"></span></a>
    </div>
    <button class="shell-mobile-toggle" type="button" aria-label="Open menu" aria-expanded="false"><span></span><span></span></button>
  `;

  if (!nav.isConnected) document.body.prepend(nav);

  document.querySelectorAll(".mobile-nav-dropdown").forEach((element) => element.remove());

  const menu = document.createElement("div");
  menu.className = "shell-mobile-menu";
  menu.setAttribute("aria-hidden", "true");
  menu.innerHTML = `
    <a href="${root}arts.html">Arts</a>
    <a href="https://career.zhixingzhang.com">Career</a>
    <a href="${root}about.html">About</a>
    <a href="${root}contact.html">Contact</a>
    <div class="shell-mobile-docs">
      <a class="nav-instagram" href="https://www.instagram.com/zhixing_gallery/" target="_blank" rel="noopener" aria-label="Visit Zhixing Zhang’s Instagram"><span class="nav-instagram-icon" aria-hidden="true"></span></a>
    </div>
  `;
  nav.insertAdjacentElement("afterend", menu);

  const toggle = nav.querySelector(".shell-mobile-toggle");
  const setMenu = (open) => {
    document.body.classList.toggle("shell-menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.setAttribute("aria-hidden", String(!open));
  };

  toggle.addEventListener("click", () => setMenu(!document.body.classList.contains("shell-menu-open")));
  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") setMenu(false); });

  if (document.body.dataset.noGesture === "true") {
    document.querySelectorAll(".gesture-panel, .gesture-scroll-zone").forEach((element) => element.remove());
    return;
  }

  if (!document.getElementById("gesturePanel")) {
    document.body.insertAdjacentHTML("afterbegin", `
      <aside class="gesture-panel is-collapsed" id="gesturePanel" aria-label="Gesture control panel">
        <div class="gesture-shell">
          <div class="gesture-topbar">
            <div class="gesture-title"><span class="gesture-kicker">Gesture Mode</span><span class="gesture-status" id="gestureStatus">Off</span></div>
            <button class="gesture-collapse-open" id="gestureOpenPreview" type="button" aria-label="Open camera preview">⌄</button>
            <label class="gesture-switch" aria-label="Enable gesture mode"><input type="checkbox" id="gestureToggle"><span class="gesture-slider"></span></label>
          </div>
          <div class="gesture-preview-wrap" id="gesturePreviewWrap">
            <div class="gesture-preview">
              <video id="gestureVideo" playsinline muted></video>
              <canvas id="gestureCanvas"></canvas>
              <button class="gesture-collapse" id="gestureCollapsePreview" type="button" aria-label="Collapse camera preview">⌄</button>
            </div>
          </div>
        </div>
      </aside>
    `);
  }

  const hasOrbitBridge = Boolean(document.getElementById("orbitScene") && window.portfolioGestureBridge);
  if (!hasOrbitBridge) {
    window.portfolioGestureBridge = createDefaultGestureBridge();
  }
})();
