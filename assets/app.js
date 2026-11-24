(() => {
  const F = window.FRAMES;                       // {files:[...], dir:"frames/"}
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* ---------------------------------------------------------- frames */
  const imgs = new Array(F.files.length);
  let loaded = 0;
  const bar = $("#loaderBar"), pct = $("#loaderPct");
  // load every 4th frame first so the scrub works early, then fill in
  const order = [];
  for (let s of [4, 2, 1]) for (let i = 0; i < F.files.length; i += s) if (!order.includes(i)) order.push(i);
  const firstPass = Math.ceil(F.files.length / 4);
  let released = false;
  function release() {
    if (released) return; released = true;
    document.body.classList.remove("is-loading");
    draw(true);
  }
  order.forEach((i, n) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = im.onerror = () => {
      imgs[i] = im.naturalWidth ? im : null;
      loaded++;
      const p = Math.min(100, Math.round(loaded / firstPass * 100));
      bar.style.width = p + "%"; pct.textContent = p + "%";
      if (loaded >= firstPass) release();
      if (i === F.files.length - 1) $("#slideImg").src = im.src;
      if (!released || Math.abs(i - cur) < 3) draw(true);
    };
    // stagger network a little so the first pass lands first
    setTimeout(() => { im.src = F.dir + F.files[i]; }, n < firstPass ? 0 : 60 + n * 8);
  });
  setTimeout(release, 9000); // never trap the user behind the loader

  /* ---------------------------------------------------------- canvas */
  const cv = $("#filmCanvas"), ctx = cv.getContext("2d");
  function size() {
    const d = Math.min(devicePixelRatio || 1, 2);
    cv.width = innerWidth * d; cv.height = innerHeight * d;
    draw(true);
  }
  function nearest(i) {
    for (let k = 0; k < imgs.length; k++) {
      if (imgs[i - k]) return imgs[i - k];
      if (imgs[i + k]) return imgs[i + k];
    }
    return null;
  }
  let cur = 0, target = 0, lastDrawn = -1;
  function cover(im) {
    const cw = cv.width, ch = cv.height, r = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
    const w = im.naturalWidth * r, h = im.naturalHeight * r;
    // on portrait screens keep the subject (left-centre of the frame) in view
    const bias = cw < ch ? 0.44 : 0.5;
    ctx.drawImage(im, (cw - w) * bias, (ch - h) / 2, w, h);
  }
  function draw(force) {
    const i = Math.round(cur);
    if (!force && i === lastDrawn) return;
    const im = nearest(i);
    if (!im) return;
    cover(im);
    lastDrawn = i;
  }

  /* ---------------------------------------------------------- scroll */
  const film = $("#film"), slide = $("#slide"), top = $("#top");
  const caps = [...document.querySelectorAll(".cap")];
  const prog = $("#filmProgress"), hint = $("#scrollhint");
  const shot = $("#slideShot"), panel = $("#slidePanel"), rail = $("#rail");
  const shade = document.createElement("div");
  shade.className = "film__shade";
  shade.style.cssText = "position:absolute;inset:0;pointer-events:none;background:linear-gradient(0deg,rgba(8,30,20,.62),rgba(8,30,20,0) 55%);opacity:0";
  $(".film__stage").insertBefore(shade, $(".cap"));

  function sectionProgress(el) {
    const r = el.getBoundingClientRect();
    return clamp(-r.top / (r.height - innerHeight), 0, 1);
  }
  function onScroll() {
    const p = sectionProgress(film);
    target = p * (F.files.length - 1);
    if (reduce) cur = target;
    prog.style.width = (p * 100) + "%";
    hint.style.opacity = p > 0.03 ? 0 : 1;
    caps.forEach(c => c.classList.toggle("is-on", p >= +c.dataset.in && p < +c.dataset.out));
    shade.style.opacity = clamp((p - 0.62) / 0.25, 0, 1);

    // the slide: shot drifts left and recedes, green store slides in, then the rail travels
    const q = sectionProgress(slide);
    const a = ease(clamp(q / 0.34, 0, 1));
    shot.style.transform = `translateX(${-28 * a}%) scale(${1 - 0.08 * a})`;
    shot.style.filter = `brightness(${1 - 0.35 * a})`;
    panel.style.transform = `translateX(${(1 - a) * 100}%)`;
    const b = clamp((q - 0.36) / 0.6, 0, 1);
    const travel = Math.max(0, rail.scrollWidth - (panel.clientWidth - rail.offsetLeft) + 40);
    rail.style.transform = `translateX(${-travel * b}px)`;

    const inStore = slide.getBoundingClientRect().top <= 0;
    top.classList.toggle("is-dark", (p > 0.72 && !inStore) || (inStore && a > 0.5 && document.querySelector("#shop").getBoundingClientRect().top > 60));
    top.classList.toggle("is-solid", $("#brands").getBoundingClientRect().top < 60);
  }
  function loop() {
    if (!reduce) cur += (target - cur) * 0.14;
    draw(false);
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------- products */
  const money = v => "$" + Number(v).toFixed(2);
  const shopURL = h => "https://seulementlocal.com/products/" + h;
  function kind(t) {
    t = t.toLowerCase();
    if (/pant/.test(t)) return "pant";
    if (/sweater|thermal|knit/.test(t)) return "knit";
    if (/shirt|tee|jersey|t-shirt|club/.test(t)) return "tee";
    if (/hoodie/.test(t)) return "hood";
    return "other";
  }
  function card(p, opts = {}) {
    const a = document.createElement("button");
    a.type = "button";
    a.className = "card" + (opts.hero ? " card--hero" : "");
    a.dataset.k = kind(p.t);
    const imgs = (p.i || []).map((src, n) => `<img src="${src}" alt="${n ? "" : p.t}" loading="lazy">`).join("");
    const badge = opts.badge ? `<span class="badge">${opts.badge}</span>` : (!p.a ? `<span class="badge badge--out">Sold out</span>` : (p.c ? `<span class="badge">Sale</span>` : ""));
    a.innerHTML = `<div class="card__img">${imgs}${badge}</div>
      <div class="card__meta"><div><div class="card__v">${p.v}</div><div class="card__t">${p.t}</div></div>
      <div class="card__p">${p.p ? money(p.p) : ""}${p.c ? `<s>${money(p.c)}</s>` : ""}</div></div>`;
    a.addEventListener("click", () => openQV(p));
    return a;
  }
  const HERO = { t: "Knit 01 — Vieux-Port", v: "Local", p: null, a: true, s: [], i: ["assets/knit01.webp"], h: null, hero: true };

  fetch("assets/products.json").then(r => r.json()).then(d => {
    rail.appendChild(card(HERO, { hero: true, badge: "New design" }));
    d.local.filter(p => p.a).slice(0, 9).forEach(p => rail.appendChild(card(p)));
    const more = document.createElement("a");
    more.href = "#shop"; more.className = "card"; more.style.cssText = "display:grid;place-items:center;border:1px solid rgba(246,244,239,.35);border-radius:4px;text-decoration:none;aspect-ratio:4/5;align-self:flex-start;font-family:var(--serif);font-style:italic;font-size:34px";
    more.textContent = "Shop all →";
    rail.appendChild(more);
    const grid = $("#grid");
    grid.appendChild(card(HERO, { hero: true, badge: "New design" }));
    d.local.forEach(p => grid.appendChild(card(p)));
    onScroll();
  });

  document.querySelectorAll(".chip").forEach(ch => ch.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(c => c.classList.toggle("is-on", c === ch));
    const f = ch.dataset.f;
    document.querySelectorAll("#grid .card").forEach(c => c.classList.toggle("is-hidden", f !== "all" && c.dataset.k !== f));
  }));

  const BRANDS = [
    ["Monaco Social Club", "Motorsport tees"], ["Tourn", "Saint college stitch"], ["Kuwalla", "Fleece & linen"],
    ["Nouvelle Époque", "Football jerseys"], ["Curated by Muse", "Heavyweight chenille"], ["Tsumi", "Illustrated tees"],
    ["Riche et en santé", "Athletic club"], ["NYXYN", "Raw denim"], ["Madré", "Graphic tees"], ["Modeste", "Phantom sets"]
  ];
  $("#brandlist").innerHTML = BRANDS.map(([n, d]) =>
    `<li><a href="https://seulementlocal.com/search?q=${encodeURIComponent(n)}" target="_blank" rel="noopener">${n}<small>${d} ↗</small></a></li>`).join("");

  /* ---------------------------------------------------------- quick view */
  const qv = $("#qv");
  let lastFocus = null;
  function openQV(p) {
    lastFocus = document.activeElement;
    $("#qvImg").src = p.i[0]; $("#qvImg").alt = p.t;
    $("#qvVendor").textContent = p.v;
    $("#qvTitle").textContent = p.t;
    $("#qvPrice").textContent = p.hero ? "Coming soon — first access for the Local family" : (p.a ? money(p.p) : "Sold out");
    const sz = $("#qvSizes"); sz.innerHTML = "";
    (p.s || []).forEach((s, n) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = s;
      b.addEventListener("click", () => { sz.querySelectorAll("button").forEach(x => x.classList.toggle("is-on", x === b)); });
      sz.appendChild(b);
    });
    const buy = $("#qvBuy");
    if (p.hero) { buy.href = "#stores"; buy.innerHTML = 'Get notified <span aria-hidden="true">→</span>'; }
    else { buy.href = shopURL(p.h); buy.target = "_blank"; buy.innerHTML = (p.a ? "Add to cart" : "View product") + ' <span aria-hidden="true">→</span>'; }
    buy.onclick = p.hero ? () => closeQV() : null;
    qv.hidden = false;
    $("#qvX").focus();
  }
  function closeQV() { qv.hidden = true; lastFocus && lastFocus.focus(); }
  $("#qvX").addEventListener("click", closeQV);
  qv.addEventListener("click", e => { if (e.target === qv) closeQV(); });
  addEventListener("keydown", e => { if (e.key === "Escape" && !qv.hidden) closeQV(); });

  /* ---------------------------------------------------------- skip / enter */
  const jump = el => el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  $("#skip").addEventListener("click", () => jump($("#shop")));
  $("#enterStore").addEventListener("click", () => {
    const y = slide.offsetTop + (slide.offsetHeight - innerHeight) * 0.36;
    scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  });

  addEventListener("resize", () => { size(); onScroll(); });
  addEventListener("scroll", onScroll, { passive: true });
  size(); onScroll(); loop();
})();
