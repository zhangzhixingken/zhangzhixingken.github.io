(() => {
  "use strict";

  const gesturePanel = document.getElementById("gesturePanel");
  const gestureToggle = document.getElementById("gestureToggle");
  const gestureStatus = document.getElementById("gestureStatus");
  const gestureVideo = document.getElementById("gestureVideo");
  const gestureCanvas = document.getElementById("gestureCanvas");
  const gestureCursor = document.getElementById("gestureCursor");
  const collapsePreview = document.getElementById("gestureCollapsePreview");
  const openPreview = document.getElementById("gestureOpenPreview");

  if (!gesturePanel || !gestureToggle || !gestureStatus || !gestureVideo || !gestureCanvas || !gestureCursor) {
    return;
  }

  const gestureCtx = gestureCanvas.getContext("2d");

  const MEDIAPIPE_TASKS_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18";
  const MEDIAPIPE_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
  const HAND_MODEL_URL = "https://storage.googleapis.com/mediapipe-tasks/hand_landmarker/hand_landmarker.task";
  const GESTURE_PREFERENCE_KEY = "kenGestureMode";

  let HandLandmarker = null;
  let FilesetResolver = null;

  let stream = null;
  let handLandmarker = null;
  let running = false;
  let rafId = null;
  let scrollRafId = null;
  let activeScrollDirection = 0;
  let lastScrollFrameTime = 0;

  let lastVideoTime = -1;
  let lastDetectTime = 0;
  let cursorX = window.innerWidth / 2;
  let cursorY = window.innerHeight / 2;
  let hasCursor = false;
  let isPinching = false;

  // Pinch-drag page scrolling: hold a thumb+index pinch and move the hand.
  // Hand moves up => page scrolls down; hand moves down => page scrolls up.
  let pinchDragScrollEligible = false;
  let pinchDragScrollActive = false;
  let pinchDragStartY = 0;
  let pinchDragLastY = 0;

  const PINCH_DOWN_DISTANCE = 0.074; // thumb + index only
  const PINCH_UP_DISTANCE = 0.104;
  const DETECT_INTERVAL_MS = 42;

  // Lower x gain makes nav hovering and orbit dragging less jumpy.
  const HAND_MAPPING_GAIN_X = 1.08;
  const HAND_MAPPING_GAIN_Y = 1.55;
  const HAND_EDGE_PADDING_PX = 8;

  const HAND_DEADZONE_PX = 24;
  const HAND_PINCH_DEADZONE_PX = 18;

  const PINCH_DRAG_SCROLL_START_PX = 14;
  const PINCH_DRAG_SCROLL_GAIN = 2.15;

  const NAV_NEAR_RADIUS_PX = 88;
  const EDGE_SCROLL_SPEED = 900; // px per second, shared across all pages
  const SCROLL_BUTTON_ATTRACT_RADIUS = 118;
  const EDGE_SCROLL_EDGE_ZONE_PX = 92;
  const EDGE_SCROLL_ENABLED = document.body?.dataset?.gestureEdgeScroll !== "false";

  const scrollZones = EDGE_SCROLL_ENABLED ? createScrollZones() : [];

  function setStatus(text) {
    gestureStatus.textContent = text;
  }

  function clampValue(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalizedDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  function getThumbIndexPinchDistance(landmarks) {
    // Click gesture is intentionally limited to thumb tip + index fingertip.
    // Middle finger is ignored entirely.
    return normalizedDistance(landmarks[4], landmarks[8]);
  }

  function mapHandPointToScreen(point) {
    const mirroredX = 1 - point.x;
    const amplifiedX = 0.5 + (mirroredX - 0.5) * HAND_MAPPING_GAIN_X;
    const amplifiedY = 0.5 + (point.y - 0.5) * HAND_MAPPING_GAIN_Y;

    return {
      x: clampValue(amplifiedX * window.innerWidth, HAND_EDGE_PADDING_PX, window.innerWidth - HAND_EDGE_PADDING_PX),
      y: clampValue(amplifiedY * window.innerHeight, HAND_EDGE_PADDING_PX, window.innerHeight - HAND_EDGE_PADDING_PX)
    };
  }

  function applyMotionDeadzone(rawX, rawY, currentX, currentY, deadzonePx) {
    const dx = rawX - currentX;
    const dy = rawY - currentY;
    const distance = Math.hypot(dx, dy);

    if (distance <= deadzonePx) {
      return { x: currentX, y: currentY };
    }

    const travel = distance - deadzonePx;
    const nx = dx / distance;
    const ny = dy / distance;

    return {
      x: currentX + nx * travel,
      y: currentY + ny * travel
    };
  }

  function resizeGestureCanvas() {
    const rect = gestureCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    gestureCanvas.width = Math.max(1, Math.round(rect.width * dpr));
    gestureCanvas.height = Math.max(1, Math.round(rect.height * dpr));
    gestureCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawHand(landmarks, pinchDistance) {
    resizeGestureCanvas();
    const w = gestureCanvas.clientWidth;
    const h = gestureCanvas.clientHeight;
    gestureCtx.clearRect(0, 0, w, h);

    if (!landmarks) return;

    gestureCtx.lineWidth = 1;
    gestureCtx.strokeStyle = "rgba(248,245,244,0.72)";
    gestureCtx.fillStyle = "rgba(248,245,244,0.84)";

    const connections = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [0,9],[9,10],[10,11],[11,12],
      [0,13],[13,14],[14,15],[15,16],
      [0,17],[17,18],[18,19],[19,20]
    ];

    gestureCtx.beginPath();
    connections.forEach(([a, b]) => {
      const pa = landmarks[a];
      const pb = landmarks[b];
      gestureCtx.moveTo(pa.x * w, pa.y * h);
      gestureCtx.lineTo(pb.x * w, pb.y * h);
    });
    gestureCtx.stroke();

    landmarks.forEach((p, index) => {
      const r = index === 4 || index === 8 ? 3.3 : 2.1;
      gestureCtx.beginPath();
      gestureCtx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
      gestureCtx.fill();
    });

    const thumb = landmarks[4];
    const index = landmarks[8];
    const thumbX = thumb.x * w;
    const thumbY = thumb.y * h;
    const indexX = index.x * w;
    const indexY = index.y * h;

    gestureCtx.strokeStyle = pinchDistance < PINCH_DOWN_DISTANCE ? "rgba(248,245,244,0.98)" : "rgba(248,245,244,0.42)";
    gestureCtx.beginPath();
    gestureCtx.moveTo(thumbX, thumbY);
    gestureCtx.lineTo(indexX, indexY);
    gestureCtx.stroke();
  }

  function updateGestureCursor(x, y, pinching, edgeScrolling = false) {
    gestureCursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    gestureCursor.classList.toggle("is-visible", true);
    gestureCursor.classList.add("is-gesture-source");
    gestureCursor.classList.remove("is-mouse-source", "is-link", "is-card", "is-mouse-down");
    gestureCursor.classList.toggle("is-pinching", pinching);
    gestureCursor.classList.toggle("is-scrolling", edgeScrolling);
  }

  function clearGestureUI(cancelScroll = true) {
    gestureCursor.classList.remove("is-visible", "is-pinching", "is-scrolling");
    document.querySelectorAll(".is-gesture-near").forEach((el) => el.classList.remove("is-gesture-near"));
    scrollZones.forEach((zone) => zone.classList.remove("is-gesture-hover"));
    if (cancelScroll) cancelAutoScroll();
    else stopAutoScroll();
  }

  function createScrollZones() {
    const existing = Array.from(document.querySelectorAll(".gesture-scroll-zone"));
    if (existing.length) return existing;

    const topZone = document.createElement("button");
    topZone.type = "button";
    topZone.className = "gesture-scroll-zone gesture-scroll-zone-top";
    topZone.dataset.gestureScroll = "up";
    topZone.setAttribute("aria-hidden", "true");
    topZone.tabIndex = -1;
    topZone.textContent = "↑";

    const bottomZone = document.createElement("button");
    bottomZone.type = "button";
    bottomZone.className = "gesture-scroll-zone gesture-scroll-zone-bottom";
    bottomZone.dataset.gestureScroll = "down";
    bottomZone.setAttribute("aria-hidden", "true");
    bottomZone.tabIndex = -1;
    bottomZone.textContent = "↓";

    document.body.append(topZone, bottomZone);
    return [topZone, bottomZone];
  }

  function updateNavProximity(x, y) {
    const targets = Array.from(document.querySelectorAll(".site-nav .logo, .site-nav .nav-links a, .site-nav .nav-docs a"));
    let closest = null;
    let closestDistance = Infinity;

    targets.forEach((target) => {
      const rect = target.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const distance = Math.hypot(x - cx, y - cy);

      if (distance < closestDistance) {
        closestDistance = distance;
        closest = target;
      }
    });

    targets.forEach((target) => {
      target.classList.toggle("is-gesture-near", target === closest && closestDistance < NAV_NEAR_RADIUS_PX);
    });
  }

  function updateScrollZones(x, y) {
    if (!EDGE_SCROLL_ENABLED) return false;

    if (isPinching) {
      scrollZones.forEach((zone) => zone.classList.remove("is-gesture-hover"));
      stopAutoScroll();
      return false;
    }

    let direction = 0;
    let activeZone = null;
    let closestDistance = Infinity;

    scrollZones.forEach((zone) => {
      const rect = zone.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(x - centerX, y - centerY);
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      const attracted = inside || distance < SCROLL_BUTTON_ATTRACT_RADIUS;

      if (attracted && distance < closestDistance) {
        closestDistance = distance;
        activeZone = zone;
      }
    });

    // In addition to the visible arrow buttons, allow the top/bottom edge
    // of the viewport itself to trigger the same continuous scroll. This
    // prevents pages with different layouts from feeling "stuck" when the
    // hand cursor misses the center of the arrow pill.
    if (!activeZone) {
      if (y < EDGE_SCROLL_EDGE_ZONE_PX) {
        direction = -1;
        activeZone = scrollZones.find((zone) => zone.classList.contains("gesture-scroll-zone-top"));
      } else if (y > window.innerHeight - EDGE_SCROLL_EDGE_ZONE_PX) {
        direction = 1;
        activeZone = scrollZones.find((zone) => zone.classList.contains("gesture-scroll-zone-bottom"));
      }
    }

    scrollZones.forEach((zone) => {
      zone.classList.toggle("is-gesture-hover", zone === activeZone);
    });

    if (activeZone) {
      direction = direction || (activeZone.classList.contains("gesture-scroll-zone-top") ? -1 : 1);
      startAutoScroll(direction);
    } else {
      stopAutoScroll();
    }

    return Boolean(direction);
  }

  function startAutoScroll(direction) {
    if (activeScrollDirection === direction && scrollRafId) return;
    activeScrollDirection = direction;
    lastScrollFrameTime = performance.now();

    if (!scrollRafId) {
      const loop = (now) => {
        if (!activeScrollDirection || !running) {
          scrollRafId = null;
          lastScrollFrameTime = 0;
          return;
        }

        const dt = Math.min(0.05, Math.max(0, (now - lastScrollFrameTime) / 1000));
        lastScrollFrameTime = now;
        performGestureScroll(activeScrollDirection * EDGE_SCROLL_SPEED * dt);
        scrollRafId = requestAnimationFrame(loop);
      };

      scrollRafId = requestAnimationFrame(loop);
    }
  }

  function stopAutoScroll() {
    activeScrollDirection = 0;
    if (scrollRafId) {
      cancelAnimationFrame(scrollRafId);
      scrollRafId = null;
    }
  }

  function cancelAutoScroll() {
    stopAutoScroll();
  }

  function getPageScrollTop() {
    return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function directPageScroll(deltaY) {
    const root = document.scrollingElement || document.documentElement;
    if (root && root.scrollHeight > root.clientHeight) {
      root.scrollTop += deltaY;
      return;
    }

    window.scrollBy({ top: deltaY, left: 0, behavior: "auto" });
  }

  function isPinchDragScrollTarget(x, y) {
    const element = document.elementFromPoint(x, y);
    if (!element) return true;

    // Do not turn a pinch-drag into page scroll when the user starts from
    // the Gesture panel or the homepage orbit, where the same pinch is used
    // for UI control / orbit dragging. Everywhere else, the pinch-drag can
    // act like grabbing the page and pulling it.
    return !Boolean(element.closest?.(".gesture-panel, #orbitScene, .orbit-scene"));
  }

  function resetPinchDragScroll() {
    pinchDragScrollEligible = false;
    pinchDragScrollActive = false;
    pinchDragStartY = 0;
    pinchDragLastY = 0;
  }

  function beginPinchDragScroll(x, y) {
    pinchDragScrollEligible = isPinchDragScrollTarget(x, y);
    pinchDragScrollActive = false;
    pinchDragStartY = y;
    pinchDragLastY = y;
  }

  function updatePinchDragScroll(x, y) {
    if (!pinchDragScrollEligible) return false;

    const totalDy = y - pinchDragStartY;
    const frameDy = y - pinchDragLastY;
    pinchDragLastY = y;

    if (!pinchDragScrollActive && Math.abs(totalDy) > PINCH_DRAG_SCROLL_START_PX) {
      pinchDragScrollActive = true;
    }

    if (!pinchDragScrollActive) return false;

    // Inverted, natural grab direction:
    // hand up (negative dy) => scrollTop increases => image moves down.
    performGestureScroll(-frameDy * PINCH_DRAG_SCROLL_GAIN);
    return true;
  }

  function performGestureScroll(deltaY) {
    const before = getPageScrollTop();

    if (window.portfolioGestureBridge && typeof window.portfolioGestureBridge.scrollByDelta === "function") {
      window.portfolioGestureBridge.scrollByDelta(deltaY);
    } else {
      directPageScroll(deltaY);
    }

    // Some pages accidentally define a bridge that does not reach the actual
    // scroll container. If nothing moved, fall back to the document scroller.
    const after = getPageScrollTop();
    if (Math.abs(after - before) < 0.5) {
      directPageScroll(deltaY);
    }
  }

  async function loadGestureDependencies() {
    if (HandLandmarker && FilesetResolver) return;

    setStatus("Loading MediaPipe…");

    try {
      const tasksVision = await import(MEDIAPIPE_TASKS_URL);
      HandLandmarker = tasksVision.HandLandmarker;
      FilesetResolver = tasksVision.FilesetResolver;
    } catch (error) {
      console.error("Gesture Mode: MediaPipe import failed:", error);
      setStatus("MediaPipe failed");
      throw error;
    }
  }

  async function setupHandLandmarker() {
    if (handLandmarker) return handLandmarker;

    await loadGestureDependencies();
    setStatus("Loading hand model…");

    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
    const handOptions = {
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55
    };

    try {
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: HAND_MODEL_URL,
          delegate: "GPU"
        },
        ...handOptions
      });
    } catch (gpuError) {
      console.warn("Gesture Mode: GPU delegate failed. Falling back to CPU.", gpuError);
      setStatus("CPU fallback");
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: HAND_MODEL_URL,
          delegate: "CPU"
        },
        ...handOptions
      });
    }

    return handLandmarker;
  }

  async function requestCameraStream() {
    setStatus("Requesting camera…");

    if (!window.isSecureContext) {
      throw new Error("Camera needs HTTPS");
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Camera unavailable");
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 480 },
          height: { ideal: 360 },
          frameRate: { ideal: 24, max: 30 }
        },
        audio: false
      });
    } catch (constraintError) {
      if (
        constraintError &&
        (constraintError.name === "NotAllowedError" ||
          constraintError.name === "SecurityError")
      ) {
        throw constraintError;
      }

      console.warn("Gesture Mode: detailed camera constraints failed. Retrying with video:true.", constraintError);
      setStatus("Retrying camera…");
      return navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
    }
  }

  function waitForVideoMetadata() {
    if (gestureVideo.readyState >= 1) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error("Camera preview timed out"));
      }, 8000);

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        gestureVideo.removeEventListener("loadedmetadata", handleLoaded);
        gestureVideo.removeEventListener("error", handleError);
      };

      const handleLoaded = () => {
        cleanup();
        resolve();
      };

      const handleError = () => {
        cleanup();
        reject(new Error("Camera preview failed"));
      };

      gestureVideo.addEventListener("loadedmetadata", handleLoaded, { once: true });
      gestureVideo.addEventListener("error", handleError, { once: true });
    });
  }

  async function startGestureMode() {
    try {
      if (running) return;

      localStorage.setItem(GESTURE_PREFERENCE_KEY, "on");
      gesturePanel.classList.add("is-running");
      gesturePanel.classList.remove("is-collapsed", "is-error");
      document.body.classList.add("gesture-active");

      // Safari is more reliable when the camera permission request happens
      // immediately after the user's click, before loading MediaPipe/WASM.
      stream = await requestCameraStream();
      gestureVideo.muted = true;
      gestureVideo.playsInline = true;
      gestureVideo.autoplay = true;
      gestureVideo.setAttribute("muted", "");
      gestureVideo.setAttribute("playsinline", "");
      gestureVideo.setAttribute("autoplay", "");
      gestureVideo.srcObject = stream;
      await waitForVideoMetadata();
      await gestureVideo.play();
      resizeGestureCanvas();

      setStatus("Loading hand model…");
      await setupHandLandmarker();

      running = true;
      setStatus("On");
      detectLoop();
    } catch (error) {
      console.error("Gesture Mode failed:", error);
      gesturePanel.classList.add("is-error");
      stopGestureMode(true);
      gestureToggle.checked = localStorage.getItem(GESTURE_PREFERENCE_KEY) === "on";
      setStatus(
        error && error.name === "NotAllowedError"
          ? "Allow camera in Safari"
          : error && error.message
            ? error.message.slice(0, 42)
            : "Gesture unavailable"
      );
    }
  }

  function stopGestureMode(preservePreference = false) {
    if (!preservePreference) localStorage.setItem(GESTURE_PREFERENCE_KEY, "off");

    running = false;
    isPinching = false;
    hasCursor = false;
    resetPinchDragScroll();
    cancelAutoScroll();

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    gestureVideo.srcObject = null;
    gestureCtx.clearRect(0, 0, gestureCanvas.width, gestureCanvas.height);
    gesturePanel.classList.remove("is-running");
    document.body.classList.remove("gesture-active");
    clearGestureUI();
    setStatus("Off");
  }

  function detectLoop(now = performance.now()) {
    if (!running || !handLandmarker) return;

    if (gestureVideo.readyState >= 2 && gestureVideo.currentTime !== lastVideoTime && now - lastDetectTime > DETECT_INTERVAL_MS) {
      lastVideoTime = gestureVideo.currentTime;
      lastDetectTime = now;

      const results = handLandmarker.detectForVideo(gestureVideo, now);
      const landmarks = results.landmarks && results.landmarks[0];

      if (landmarks) {
        const thumb = landmarks[4];
        const index = landmarks[8];

        const pinchPoint = {
          x: (thumb.x + index.x) / 2,
          y: (thumb.y + index.y) / 2,
          z: ((thumb.z || 0) + (index.z || 0)) / 2
        };

        const mappedPoint = mapHandPointToScreen(pinchPoint);
        const pinchDistance = getThumbIndexPinchDistance(landmarks);
        const willPinch = isPinching || pinchDistance < PINCH_DOWN_DISTANCE;
        const deadzone = willPinch ? HAND_PINCH_DEADZONE_PX : HAND_DEADZONE_PX;
        const filteredPoint = hasCursor
          ? applyMotionDeadzone(mappedPoint.x, mappedPoint.y, cursorX, cursorY, deadzone)
          : { x: mappedPoint.x, y: mappedPoint.y };

        const smoothing = hasCursor ? (willPinch ? 0.42 : 0.32) : 1;
        cursorX += (filteredPoint.x - cursorX) * smoothing;
        cursorY += (filteredPoint.y - cursorY) * smoothing;
        hasCursor = true;

        updateNavProximity(cursorX, cursorY);
        const edgeScrolling = updateScrollZones(cursorX, cursorY);

        if (!isPinching && pinchDistance < PINCH_DOWN_DISTANCE) {
          isPinching = true;
          cancelAutoScroll();
          beginPinchDragScroll(cursorX, cursorY);
          window.portfolioGestureBridge?.down(cursorX, cursorY);
        } else if (isPinching && pinchDistance > PINCH_UP_DISTANCE) {
          isPinching = false;
          resetPinchDragScroll();
          window.portfolioGestureBridge?.up(cursorX, cursorY);
        }

        let pinchDragScrolling = false;
        if (isPinching) {
          window.portfolioGestureBridge?.move(cursorX, cursorY);
          pinchDragScrolling = updatePinchDragScroll(cursorX, cursorY);
        }

        updateGestureCursor(cursorX, cursorY, isPinching, edgeScrolling || pinchDragScrolling);
        drawHand(landmarks, pinchDistance);
        setStatus(pinchDragScrolling ? "Drag Scroll" : edgeScrolling ? "Scroll" : isPinching ? "Press" : "On");
      } else {
        if (isPinching) {
          isPinching = false;
          resetPinchDragScroll();
          window.portfolioGestureBridge?.up(cursorX, cursorY);
        }

        clearGestureUI();
        drawHand(null);
        setStatus("On");
      }
    }

    rafId = requestAnimationFrame(detectLoop);
  }

  gestureToggle.addEventListener("change", () => {
    if (gestureToggle.checked) {
      setStatus("Starting…");
      startGestureMode();
    } else {
      stopGestureMode();
    }
  });

  collapsePreview?.addEventListener("click", () => {
    gesturePanel.classList.add("is-collapsed");
  });

  openPreview?.addEventListener("click", () => {
    gesturePanel.classList.remove("is-collapsed");
  });

  window.addEventListener("resize", resizeGestureCanvas, { passive: true });
  window.addEventListener("beforeunload", () => stopGestureMode(true));

  if (localStorage.getItem(GESTURE_PREFERENCE_KEY) === "on") {
    // Safari requires camera access to begin from a fresh user gesture.
    // Keep the preference visible, but wait for the user to click the switch.
    gestureToggle.checked = false;
    setStatus("Tap to start");
  } else {
    gestureToggle.checked = false;
    setStatus("Off");
  }
})();
