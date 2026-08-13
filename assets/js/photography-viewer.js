(() => {
  const project = window.PHOTOGRAPHY_PROJECT;
  const track = document.getElementById("photoTrack");
  const prevButton = document.getElementById("prevPhoto");
  const nextButton = document.getElementById("nextPhoto");
  const status = document.getElementById("viewerStatus");
  const progress = document.getElementById("viewerProgress");

  if (!project || !track || !project.images.length) return;

  const slides = [
    {
      src: project.cover,
      alt: `${project.title} cover photograph`,
      cover: true
    },
    ...project.images.map((src, index) => ({
      src,
      alt: `${project.title}, photograph ${index + 1}`,
      cover: false
    }))
  ];

  const fragment = document.createDocumentFragment();

  slides.forEach((slide, index) => {
    const figure = document.createElement("figure");
    figure.className = `photo-slide${slide.cover ? " is-cover" : ""}${(!slide.cover && index === 1 && project.title === "Undetected") ? " is-force-contain" : ""}`;
    figure.setAttribute("aria-label", slide.cover ? `${project.title} introduction` : `Photograph ${index} of ${project.images.length}`);

    const image = document.createElement("img");
    image.src = slide.src;
    image.alt = slide.alt;
    image.draggable = false;
    image.decoding = "async";
    if (index === 0) image.fetchPriority = "high";
    else image.loading = index < 3 ? "eager" : "lazy";
    image.addEventListener("load", () => {
      figure.classList.toggle("is-portrait", image.naturalHeight > image.naturalWidth);
    }, { once: true });
    if (slide.cover) {
      // The cover occupies two viewport-wide steps. During the first step the
      // image stays pinned while the copy and shade travel left; the second
      // step presents the cover on its own before the gallery begins.
      figure.classList.add("is-cover-stage");
      const media = document.createElement("div");
      media.className = "cover-media";
      media.appendChild(image);

      const hold = document.createElement("span");
      hold.className = "cover-hold";
      hold.setAttribute("aria-hidden", "true");

      const shade = document.createElement("div");
      shade.className = "cover-shade";
      shade.setAttribute("aria-hidden", "true");

      const copy = document.createElement("div");
      copy.className = "cover-copy";
      copy.innerHTML = `
        <h1 class="cover-title">${project.title}</h1>
        <div class="cover-side">
          <p class="cover-meta">${project.meta.join("<br>")}</p>
          <p class="cover-statement">${project.statement}</p>
        </div>
      `;

      figure.append(media, shade, copy, hold);
    } else {
      figure.appendChild(image);
    }

    fragment.appendChild(figure);
  });

  track.appendChild(fragment);

  // Scroll step 0 is the introduction, step 1 is the clean cover, and the
  // remaining steps are the project photographs.
  const stepCount = slides.length + 1;
  let activeIndex = 0;
  let wheelLock = false;
  let scrollTimer = null;

  function measureCoverScale() {
    const coverStage = track.querySelector(".is-cover-stage");
    const coverImage = coverStage?.querySelector(".cover-media > img");
    if (!coverStage || !coverImage?.naturalWidth || !coverImage?.naturalHeight) return;

    const viewportRatio = track.clientWidth / Math.max(1, track.clientHeight);
    const imageRatio = coverImage.naturalWidth / coverImage.naturalHeight;
    const fillScale = imageRatio > viewportRatio
      ? imageRatio / viewportRatio
      : viewportRatio / imageRatio;

    coverStage.dataset.coverScale = String(fillScale);
    coverStage.classList.add("is-cover-ready");
    updateCoverTransition();
  }

  function updateCoverTransition() {
    const coverStage = track.querySelector(".is-cover-stage");
    if (!coverStage) return;
    const coverProgress = Math.max(0, Math.min(1, track.scrollLeft / Math.max(1, track.clientWidth)));
    const fillScale = Number(coverStage.dataset.coverScale || 1);
    const currentScale = 1 + ((fillScale - 1) * (1 - coverProgress));
    coverStage.style.setProperty("--cover-transition", String(coverProgress));
    coverStage.style.setProperty("--cover-current-scale", String(currentScale));
  }

  const coverImage = track.querySelector(".is-cover-stage .cover-media > img");
  if (coverImage?.complete) measureCoverScale();
  else coverImage?.addEventListener("load", measureCoverScale, { once: true });

  function goTo(index) {
    const nextIndex = Math.max(0, Math.min(index, stepCount - 1));
    track.scrollTo({ left: nextIndex * track.clientWidth, behavior: "smooth" });
    setActive(nextIndex);
  }

  function setActive(index) {
    activeIndex = Math.max(0, Math.min(index, stepCount - 1));
    prevButton.disabled = activeIndex === 0;
    nextButton.disabled = activeIndex === stepCount - 1;

    const visibleNumber = activeIndex === 0 ? "" : String(activeIndex);
    status.textContent = visibleNumber;
    progress.style.transform = `scaleX(${activeIndex / (stepCount - 1)})`;
  }

  function syncFromScroll() {
    const index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    setActive(index);
  }

  prevButton.addEventListener("click", () => goTo(activeIndex - 1));
  nextButton.addEventListener("click", () => goTo(activeIndex + 1));

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      goTo(activeIndex - 1);
    }
    if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
      event.preventDefault();
      goTo(activeIndex + 1);
    }
    if (event.key === "Home") goTo(0);
    if (event.key === "End") goTo(slides.length - 1);
  });

  track.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();
    if (wheelLock || Math.abs(event.deltaY) < 12) return;
    wheelLock = true;
    goTo(activeIndex + (event.deltaY > 0 ? 1 : -1));
    window.setTimeout(() => { wheelLock = false; }, 520);
  }, { passive: false });

  track.addEventListener("scroll", () => {
    updateCoverTransition();
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(syncFromScroll, 80);
  }, { passive: true });

  window.addEventListener("resize", () => {
    measureCoverScale();
    goTo(activeIndex);
  }, { passive: true });
  updateCoverTransition();
  setActive(0);
})();
