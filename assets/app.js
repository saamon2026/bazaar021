(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* ---------------------------------------------------------- preload the two shots */
  const bar = $("#loaderBar"), pct = $("#loaderPct");
  const SHOTS = ["assets/shot-behind.jpg", "assets/shot-overhead.jpg"];
  let loaded = 0, released = false;
  function release() { if (released) return; released = true; document.body.classList.remove("is-loading"); }
  SHOTS.forEach(src => {
    const im = new Image();
    im.onload = im.onerror = () => {
      loaded++;
      const p = Math.round(loaded / SHOTS.length * 100);
      bar.style.width = p + "%"; pct.textContent = p + "%";
      if (loaded === SHOTS.length) setTimeout(release, 350);
    };
    im.src = src;
  });
  setTimeout(release, 8000);
  $("#slideImg").src = SHOTS[1];

  /* ---------------------------------------------------------- scroll */
  const film = $("#film"), slide = $("#slide"), top = $("#top");
  const caps = [...document.querySelectorAll(".cap")];
  const prog = $("#filmProgress"), hint = $("#scrollhint");
  const shot = $("#slideShot"), panel = $("#slidePanel"), rail = $("#rail"), track = $("#track");
  const shade = document.createElement("div");
  shade.className = "film__shade";
  shade.style.cssText = "position:absolute;inset:0;pointer-events:none;background:linear-gradient(20deg,rgba(6,24,16,.78) 0%,rgba(6,24,16,.35) 32%,rgba(6,24,16,0) 58%);opacity:1";
  $(".film__stage").insertBefore(shade, $(".cap"));

  function sectionProgress(el) {
    const r = el.getBoundingClientRect();
    return clamp(-r.top / (r.height - innerHeight), 0, 1);
  }
  function onScroll() {
    const p = sectionProgress(film);
    target = p;
    if (reduce) cur = target;
    prog.style.width = (p * 100) + "%";
    hint.style.opacity = p > 0.03 ? 0 : 1;
    caps.forEach(c => c.classList.toggle("is-on", p >= +c.dataset.in && p < +c.dataset.out));

    // the slide: shot drifts left and recedes, green store slides in, then the rail travels
    const q = sectionProgress(slide);
    const a = ease(clamp(q / 0.34, 0, 1));
    shot.style.transform = `translateX(${-28 * a}%) scale(${1 - 0.08 * a})`;
    shot.style.filter = `brightness(${1 - 0.35 * a})`;
    panel.style.transform = `translateX(${(1 - a) * 100}%)`;
    const b = clamp((q - 0.36) / 0.6, 0, 1);
    const travel = Math.max(0, track.scrollWidth - panel.clientWidth + parseFloat(getComputedStyle(panel).paddingLeft) + 40);
    track.style.transform = `translateX(${-travel * b}px)`;

    const br = $("#brands").getBoundingClientRect();
    const solid = br.top <= 60 && br.bottom > 60;
    top.classList.toggle("is-solid", solid);
    top.classList.toggle("is-dark", !solid);
  }
  // camera choreography on two real shots: push in over the shoulder, rise, rotate to top-down
  const shotA = $("#shotA"), shotB = $("#shotB");
  let cur = 0, target = 0;
  function render(p) {
    const push = ease(clamp(p / 0.5, 0, 1));                 // 0 → 0.5 : dolly in toward the knit
    const x = clamp((p - 0.42) / 0.16, 0, 1), xe = ease(x);   // 0.38 → 0.62 : the rise / crossfade
    const settle = ease(clamp((p - 0.6) / 0.4, 0, 1));        // 0.6 → 1 : overhead settles
    const sa = 1 + 0.28 * push + 0.45 * xe;
    shotA.style.transform = `scale(${sa}) translateY(${-3 * push}%)`;
    shotA.style.opacity = 1 - xe;
    shotA.style.filter = `blur(${10 * xe}px) brightness(${1 + 0.25 * Math.sin(Math.PI * x)})`;
    const sb = 1.32 - 0.22 * xe - 0.1 * settle;
    shotB.style.transform = `rotate(${(1 - xe) * -9}deg) scale(${sb})`;
    shotB.style.opacity = xe;
    shotB.style.filter = `blur(${10 * (1 - xe)}px) brightness(${1 + 0.25 * Math.sin(Math.PI * x)})`;
  }
  function loop() {
    if (!reduce) cur += (target - cur) * 0.12; else cur = target;
    render(cur);
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

  addEventListener("resize", onScroll);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll(); loop();
})();
