/*
  Homepage orbit — WebGL image layer.

  The DOM orbit (index.html) still does everything it did before: layout, rotation,
  hover, click, captions, gesture mode. This file only takes over *drawing the images*.
  Each card face carries four zero-size corner markers; every frame we read where the
  browser projects those corners on screen and draw the image there with WebGL, using
  perspective-correct texture mapping. Hover scale, depth scale, the entry animation and
  the portrait sizing therefore carry over exactly.

  Why: CSS 3D rasterises each card at its layout size and the GPU then composites ~40
  large layers every frame. Here the GPU samples the original image files directly
  (mipmapped, never below 1 image pixel per device pixel for the front card), and the
  DOM cards are empty and cheap to composite.

  Turn off: remove the <script src="assets/js/orbit-gl.js"> tag; the page falls back
  to the CSS images automatically. It also falls back if WebGL2 is unavailable.
*/
(function () {
  "use strict";

  const MARKERS = '<span class="gl-quad" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  const HOVER_SCALE = 1.16; // matches .orbit-card:hover .card-shell in index.html
  const LABEL_TEXT = "Proposal — AI render";

  function init(api) {
    const canvas = document.createElement("canvas");
    canvas.className = "orbit-gl";
    canvas.setAttribute("aria-hidden", "true");
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) return null;

    const vs = `#version 300 es
      in vec2 aPos; in vec3 aUvq;
      uniform vec2 uView;
      out vec3 vUvq;
      void main() {
        vUvq = aUvq;
        vec2 clip = vec2(aPos.x / uView.x * 2.0 - 1.0, 1.0 - aPos.y / uView.y * 2.0);
        gl_Position = vec4(clip, 0.0, 1.0);
      }`;
    const fs = `#version 300 es
      precision highp float;
      in vec3 vUvq; uniform sampler2D uTex; uniform float uAlpha;
      out vec4 outColor;
      // LOD bias -0.75: up to ~1.7x downscale samples the full-resolution image, not a
      // blend with the half-size mip, so the front card never looks softer than the file.
      void main() { outColor = texture(uTex, vUvq.xy / vUvq.z, -0.75) * uAlpha; }`;
    const compile = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const loc = {
      pos: gl.getAttribLocation(prog, "aPos"), uvq: gl.getAttribLocation(prog, "aUvq"),
      view: gl.getUniformLocation(prog, "uView"), alpha: gl.getUniformLocation(prog, "uAlpha"),
      tex: gl.getUniformLocation(prog, "uTex"),
    };
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc.pos);
    gl.enableVertexAttribArray(loc.uvq);
    gl.vertexAttribPointer(loc.pos, 2, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(loc.uvq, 3, gl.FLOAT, false, 20, 8);
    gl.uniform1i(loc.tex, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
    const verts = new Float32Array(30);

    // ── Per-card state ──────────────────────────────────────────────
    const items = api.cards.map((card, index) => {
      const project = api.projects[index];
      const faces = [...card.querySelectorAll(".card-face")].map((face) => {
        const media = face.querySelector(".image-media");
        if (!media) return null;
        media.insertAdjacentHTML("beforeend", MARKERS);
        const quad = media.querySelector(".gl-quad");
        return { quad, pts: [...quad.children] };
      }).filter(Boolean);
      return { card, project, faces, tex: null, img: null, aspect: 0, loading: false, labelFor: 0 };
    });

    function sourceFor(item) {
      // Smallest file that still gives >= 1 image pixel per device pixel on the
      // front card at hover scale. The 1x files are 1600 px wide, the -2x files 3200 px.
      const L = api.getLayout();
      const dpr = window.devicePixelRatio || 1;
      const boxW = item.project.portrait && item.aspect
        ? L.cardH * 1.24 * item.aspect
        : L.cardW;
      const need = boxW * dpr * HOVER_SCALE;
      return need > 1600 ? item.project.image.replace(/\.webp$/i, "-2x.webp") : item.project.image;
    }

    function uvRect(item) {
      // object-fit: cover inside the card box (landscape); portrait boxes match the image.
      if (item.project.portrait) return [0, 0, 1, 1];
      const L = api.getLayout();
      const box = L.cardW / L.cardH, a = item.aspect;
      if (a > box) { const f = box / a; return [(1 - f) / 2, 0, (1 + f) / 2, 1]; }
      const f = a / box; return [0, (1 - f) / 2, 1, (1 + f) / 2];
    }

    function placeQuads(item) {
      const L = api.getLayout();
      item.faces.forEach(({ quad }) => {
        if (item.project.portrait && item.aspect) {
          const h = L.cardH * 1.24, w = h * item.aspect;
          quad.style.cssText = `left:${(L.cardW - w) / 2}px;top:${(L.cardH - h) / 2}px;width:${w}px;height:${h}px`;
        } else {
          quad.style.cssText = "";
        }
      });
    }

    function upload(item, source) {
      if (!item.tex) item.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, item.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT,
        Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    }

    function bakeLabel(item) {
      // "Proposal — AI render" drawn into the image itself, at the same size and position
      // as the CSS label (10px, 9px from the left, 8px from the bottom of the card box).
      const img = item.img, L = api.getLayout();
      const [u0, , u1, v1] = uvRect(item);
      const boxW = item.project.portrait ? L.cardH * 1.24 * item.aspect : L.cardW;
      const s = ((u1 - u0) * img.naturalWidth) / boxW;
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      ctx.font = `500 ${10 * s}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = `${0.2 * s}px`;
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "bottom";
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 8 * s;
      ctx.fillText(LABEL_TEXT, u0 * c.width + 9 * s, v1 * c.height - 8 * s);
      item.labelFor = L.cardW;
      return c;
    }

    function load(item) {
      if (item.loading) return;
      item.loading = true;
      const img = new Image();
      img.decoding = "async";
      const finish = () => {
        item.img = img;
        item.aspect = img.naturalWidth / img.naturalHeight;
        const better = sourceFor(item);
        if (!img.src.endsWith(better)) { // portrait boxes needed the aspect first
          item.loading = false; item.src = better; load(item); return;
        }
        placeQuads(item);
        upload(item, item.project.aiRender ? bakeLabel(item) : img);
        item.loading = false;
      };
      img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(finish);
      img.onerror = () => { item.loading = false; };
      img.src = item.src || sourceFor(item);
    }

    // Load front-most cards first.
    items.slice().sort((a, b) => api.depthOf(b.card) - api.depthOf(a.card)).forEach(load);

    // ── Drawing ─────────────────────────────────────────────────────
    function corners(face) {
      const p = face.pts.map((el) => el.getBoundingClientRect());
      return [p[0].left, p[0].top, p[1].left, p[1].top, p[2].left, p[2].top, p[3].left, p[3].top];
    }

    function facing(c) {
      let s = 0;
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        s += c[i * 2] * c[j * 2 + 1] - c[j * 2] * c[i * 2 + 1];
      }
      return s > 1;
    }

    function drawQuad(c, uv, alpha) {
      // Projective interpolation: weight each corner by the diagonal split ratio.
      const [x0, y0, x1, y1, x2, y2, x3, y3] = c;
      const d = (x2 - x0) * (y3 - y1) - (y2 - y0) * (x3 - x1);
      if (Math.abs(d) < 1e-6) return;
      const t = ((x1 - x0) * (y3 - y1) - (y1 - y0) * (x3 - x1)) / d;
      const cx = x0 + t * (x2 - x0), cy = y0 + t * (y2 - y0);
      const dist = (x, y) => Math.hypot(x - cx, y - cy);
      const d0 = dist(x0, y0), d1 = dist(x1, y1), d2 = dist(x2, y2), d3 = dist(x3, y3);
      if (!d0 || !d1 || !d2 || !d3) return;
      const q = [(d0 + d2) / d2, (d1 + d3) / d3, (d2 + d0) / d0, (d3 + d1) / d1];
      const [u0, v0, u1, v1] = uv;
      const corner = [[x0, y0, u0, v0, q[0]], [x1, y1, u1, v0, q[1]], [x2, y2, u1, v1, q[2]], [x3, y3, u0, v1, q[3]]];
      let k = 0;
      for (const i of [0, 1, 2, 0, 2, 3]) {
        const [x, y, u, v, w] = corner[i];
        verts[k++] = x; verts[k++] = y; verts[k++] = u * w; verts[k++] = v * w; verts[k++] = w;
      }
      gl.uniform1f(loc.alpha, alpha);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STREAM_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    let clipEl = null;
    function findClip() {
      clipEl = null;
      for (let el = api.scene; el && el !== document.body; el = el.parentElement) {
        const st = getComputedStyle(el);
        if (st.overflowX !== "visible" || st.overflowY !== "visible") { clipEl = el; break; }
      }
    }
    findClip();
    let lastW = 0, lastH = 0;
    function render() {
      const W = window.innerWidth, H = window.innerHeight, dpr = window.devicePixelRatio || 1;
      if (W !== lastW || H !== lastH || canvas.width !== Math.round(W * dpr)) {
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        lastW = W; lastH = H;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(loc.view, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (api.scene.getBoundingClientRect().bottom < 0) return; // scrolled past the hero

      // Clip like the DOM does: cards are cut off by the nearest overflow-clipping ancestor.
      gl.disable(gl.SCISSOR_TEST);
      if (clipEl) {
        const r = clipEl.getBoundingClientRect();
        const x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(W, r.right), y1 = Math.min(H, r.bottom);
        if (x1 <= x0 || y1 <= y0) return;
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(Math.floor(x0 * dpr), Math.floor((H - y1) * dpr), Math.ceil((x1 - x0) * dpr), Math.ceil((y1 - y0) * dpr));
      }
      const sceneAlpha = parseFloat(getComputedStyle(api.scene).opacity) || 0;
      const order = items.filter((it) => it.tex).sort((a, b) => api.depthOf(a.card) - api.depthOf(b.card));
      for (const it of order) {
        const alpha = parseFloat(getComputedStyle(it.card).opacity) * sceneAlpha;
        if (alpha < 0.004) continue;
        // Facing away: draw the same quad with left/right swapped, so the far side of
        // the ring reads the right way round (the CSS back face never flipped: a later
        // `.card-face { transform: translateZ(0) }` overrides its rotate, so the live
        // CSS version shows the far side mirrored).
        let c = corners(it.faces[0]);
        if (!facing(c)) {
          // Phones (<= 840px) hide the back face in CSS; keep that behaviour.
          const back = it.card.querySelector(".card-back");
          if (!back || getComputedStyle(back).display === "none") continue;
          c = [c[2], c[3], c[0], c[1], c[6], c[7], c[4], c[5]];
        }
        if (!facing(c)) continue;
        gl.bindTexture(gl.TEXTURE_2D, it.tex);
        drawQuad(c, uvRect(it), alpha);
      }
    }

    function relayout() {
      findClip();
      items.forEach((it) => {
        if (!it.img) return;
        placeQuads(it);
        const want = sourceFor(it);
        if (!it.img.src.endsWith(want)) { it.src = want; load(it); }
        else if (it.project.aiRender && it.labelFor !== api.getLayout().cardW) upload(it, bakeLabel(it));
      });
    }

    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      document.body.classList.remove("gl-orbit");
      api.onRender(null);
    });

    api.scene.parentNode.insertBefore(canvas, api.scene);
    document.body.classList.add("gl-orbit");
    return { render, relayout };
  }

  window.initOrbitGL = function (api) {
    try { return init(api); } catch (err) { console.warn("orbit-gl disabled:", err); return null; }
  };
})();
