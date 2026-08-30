/* 《汉 · 帝国纪事》第一卷：大风歌 — 交互层 */
(function () {
  "use strict";
  var D = window.HAN_DATA || {};
  var PERSONS = D.persons || [], EVENTS = D.events || [], RELS = D.relations || [],
      LECS = D.lectures || [], SOURCES = D.sources || [], TRAITS = D.traits || [];

  var YS = window.HAN_YUANSHI || { chapters: [], lecMap: {}, chapterMap: {} };

  var UNITS = ["起兵反秦", "楚汉战争", "开国建制", "功臣群像", "晚年危机", "人物总评"];
  var UNIT_Q = {
    "起兵反秦": "一个秦帝国基层小吏，为什么会被时代推到历史前台？",
    "楚汉战争": "兵少、将弱、屡败的刘邦，为什么最后战胜了项羽？",
    "开国建制": "得天下之后，刘邦如何把一支战争联盟变成帝国？",
    "功臣群像": "刘邦集团究竟是如何形成的？",
    "晚年危机": "得到天下之后，刘邦真正恐惧的是什么？",
    "人物总评": "刘邦为什么是刘邦？"
  };
  var MAIN_LINES = ["刘邦", "项羽", "韩信", "吕后", "萧何", "张良"];
  var PHASES = ["起兵反秦", "楚汉战争", "开国建制", "功臣群像", "晚年危机", "人物总评"];

  var app = document.getElementById("app");
  var pageMotion = null;
  var lenis = null;
  var ST = null;   // ScrollTrigger
  var prefersReduced = typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 动效基础设施 ----------
     Lenis 负责平滑滚动（3KB，不劫持滚动条、不破坏 sticky 与 IO），
     ScrollTrigger 负责滚动驱动动画，两者通过 GSAP ticker 同步。      */
  function initMotionBase() {
    if (window.gsap && window.ScrollTrigger) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      ST = window.ScrollTrigger;
    }
    if (!window.Lenis || prefersReduced || lenis) { bindProgressFallback(); return; }

    lenis = new window.Lenis({
      lerp: 0.12,            // 触控板带惯性，调高 lerp 让跟手、削弱漂移滞后感
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      smoothWheel: true,
      syncTouch: true,       // 触屏走原生惯性滚动，避免双重平滑导致黏滞
      syncTouchLerp: 0.1
    });
    if (ST) lenis.on("scroll", ST.update);
    if (window.gsap) {
      window.gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
    }
    lenis.on("scroll", function (e) { paintProgress(e.scroll); });
  }

  /* Lenis 不可用时的进度条降级 */
  function bindProgressFallback() {
    var onScroll = function () {
      var de = document.documentElement || {};
      paintProgress(window.pageYOffset || de.scrollTop || 0);
    };
    onScroll();
    if (window.addEventListener) window.addEventListener("scroll", onScroll, { passive: true });
  }

  function paintProgress(scrollY) {
    var bar = document.getElementById("scrollProgress");
    if (!bar) return;
    var de = document.documentElement || {};
    var max = (de.scrollHeight || 0) - (window.innerHeight || 0);
    var p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    bar.style.transform = "scaleX(" + p + ")";
  }

  function scrollToTop() {
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else if (window.scrollTo) window.scrollTo(0, 0);
  }

  function clearPageMotion() {
    if (ST) ST.getAll().forEach(function (t) { t.kill(); });
    if (pageMotion && pageMotion.revert) pageMotion.revert();
    pageMotion = null;
  }

  function createPageMotion(scope, setup) {
    if (!window.gsap || !scope) return;
    document.documentElement.classList.add("gsap-ready");
    pageMotion = window.gsap.matchMedia();
    pageMotion.add({ reduceMotion: "(prefers-reduced-motion: reduce)" }, function (context) {
      if (context.conditions.reduceMotion) return;
      return setup(window.gsap, scope);
    });
  }

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function yText(y) { return y == null ? "" : (y < 0 ? "前 " + (-y) + " 年" : y + " 年"); }
  function ySort(a, b) {
    if (a.year == null && b.year == null) return 0;
    if (a.year == null) return 1;
    if (b.year == null) return -1;
    return a.year - b.year;
  }
  function byId(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
  function personByName(n) {
    for (var i = 0; i < PERSONS.length; i++) if (PERSONS[i].name === n) return PERSONS[i];
    return null;
  }
  function eventsOfPerson(name) {
    return EVENTS.filter(function (e) { return (e.people || []).indexOf(name) >= 0; });
  }
  function lecsOfPerson(name) {
    return LECS.filter(function (l) { return (l.people || []).indexOf(name) >= 0; });
  }
  function evaluationsOfPerson(name) {
    var out = [];
    LECS.forEach(function (l) {
      (l.evaluations || []).forEach(function (x) {
        if (!x || typeof x !== "object") return;
        if (x.target === name || (x.people || []).indexOf(name) >= 0) {
          out.push({ episode: l.episode, lecture: l.title, trait: x.trait || "人物评价", text: x.text || "", limit: x.limit || "" });
        }
      });
    });
    return out;
  }
  function srcBadge(book) {
    if (!book) return "";
    if (book.indexOf("史记") >= 0) return '<span class="badge badge-shiji">史记</span>';
    if (book.indexOf("汉书") >= 0) return '<span class="badge badge-hanshu">汉书</span>';
    if (book.indexOf("资治通鉴") >= 0) return '<span class="badge badge-zztj">资治通鉴</span>';
    if (book.indexOf("元代散曲") >= 0 || book.indexOf("唐") >= 0) return '<span class="badge badge-modern">后世文献</span>';
    return '<span class="badge badge-modern">' + esc(book) + "</span>";
  }

  /* ---------- reveal ---------- */
  var io = null;
  function observeReveal() {
    if (io) io.disconnect();
    if (!("IntersectionObserver" in window)) {
      var all = document.querySelectorAll(".rv");
      for (var i = 0; i < all.length; i++) all[i].classList.add("in");
      return;
    }
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.06, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll(".rv").forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 8, 6) * 55 + "ms";
      io.observe(el);
    });
  }

  /* ---------- 路由 ---------- */
  function go(hash) { location.hash = hash; }
  function parse() {
    var h = (location.hash || "#/").replace(/^#\/?/, "");
    var p = h.split("/").filter(Boolean);
    return { name: p[0] || "opening", arg: p[1] ? decodeURIComponent(p[1]) : null };
  }

  function render() {
    clearPageMotion();
    clearTimelineScroll();
    var r = parse(), html = "";
    if (r.name === "opening") html = viewOpening();
    else if (r.name === "acts") html = viewActs();
    else if (r.name === "unit") html = viewUnit(r.arg);
    else if (r.name === "timeline") html = viewTimeline();
    else if (r.name === "person") html = viewPerson(r.arg);
    else if (r.name === "relations") html = viewRelations();
    else if (r.name === "rel") html = viewRel(r.arg);
    else if (r.name === "event") html = viewEvent(r.arg);
    else if (r.name === "lectures") html = viewLectures();
    else if (r.name === "lecture") html = viewLecture(r.arg);
    else if (r.name === "traits") html = viewTraits();
    else if (r.name === "sources") html = viewSources();
    else if (r.name === "source") html = viewSource(r.arg);
    else html = viewOpening();

    app.innerHTML = html;
    scrollToTop();
    setNav(r.name);
    bind();
    observeReveal();
    playPageEnter();
    if (ST) ST.refresh();
  }

  /* 页面切换过渡：整页轻微上浮淡入，与 .rv 元素的逐个揭示形成层次 */
  function playPageEnter() {
    if (!window.gsap || prefersReduced) return;
    window.gsap.fromTo(app,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", clearProps: "opacity,transform" });
  }

  function setNav(name) {
    document.querySelectorAll(".hud-nav a").forEach(function (a) {
      a.classList.toggle("on", a.dataset.nav === name);
    });
  }

  function bind() {
    app.querySelectorAll("[data-goto]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        go(el.dataset.goto);
      });
    });
    // 事件卡片
    app.querySelectorAll("[data-ev]").forEach(function (el) {
      el.addEventListener("click", function () { go("#/event/" + encodeURIComponent(el.dataset.ev)); });
    });
    // 人物
    app.querySelectorAll("[data-person]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        var p = personByName(el.dataset.person);
        if (p) go("#/person/" + encodeURIComponent(p.id));
      });
    });
    // 讲坛集
    app.querySelectorAll("[data-lec]").forEach(function (el) {
      el.addEventListener("click", function () { go("#/lecture/" + el.dataset.lec); });
    });
    // 史料篇章
    app.querySelectorAll("[data-src]").forEach(function (el) {
      el.addEventListener("click", function () { go("#/source/" + el.dataset.src); });
    });
    // 关系
    app.querySelectorAll("[data-rel]").forEach(function (el) {
      el.addEventListener("click", function () { go("#/rel/" + encodeURIComponent(el.dataset.rel)); });
    });
    bindTimeline();
    bindRelationGraph();
    bindLayers();
    bindTraits();
    filterLectures();
  }

  /* ---------- 序章 ---------- */
  function viewOpening() {
    return '<section class="opening">' +
      '<div class="op-year">前 二〇九年</div>' +
      '<h1 class="op-line d1">天下苦秦久矣</h1>' +
      '<p class="op-line d2">一个逃亡的亭长</p>' +
      '<p class="op-line d3">被时代推到了历史前台</p>' +
      '<h2 class="op-title">大風歌</h2>' +
      '<p class="op-sub">刘邦　与汉帝国的诞生</p>' +
      '<button class="op-enter" data-goto="#/acts">进 入 纪 事</button>' +
      '<p class="op-scroll">或按 ⌘K 检索人物 · 事件 · 关系 · 讲坛</p>' +
      "</section>";
  }

  /* ---------- 六幕 ---------- */
  function viewActs() {
    var h = '<div class="wrap"><div class="acts-head rv">' +
      '<div class="eyebrow">Chapter Select</div>' +
      '<h1 class="h-big">六 幕</h1>' +
      '<div class="rule-zhu"></div>' +
      '<p class="lead">全篇采用《大风歌》讲座原有的六幕结构。45 集是内容骨架，不是网站的唯一导航形式——你也可以直接按时间、人物或关系进入。</p>' +
      "</div>";
    h += '<div class="act-list">';
    UNITS.forEach(function (u, i) {
      var eps = LECS.filter(function (l) { return l.unit === u; });
      var evs = EVENTS.filter(function (e) { return e.unit === u; });
      var sCount = evs.filter(function (e) { return e.importance === "S"; }).length;
      h += '<div class="act rv" data-goto="#/unit/' + encodeURIComponent(u) + '">' +
        '<div class="act-no">' + ("0" + (i + 1)) + "</div>" +
        "<div><div class=\"act-name\">" + esc(u) + "</div>" +
        '<div class="act-q">' + esc(UNIT_Q[u] || "") + "</div></div>" +
        '<div class="act-meta">第 ' + (eps.length ? eps[0].episode : "—") + " – " + (eps.length ? eps[eps.length - 1].episode : "—") + " 集<br>" +
        "<b>" + evs.length + "</b> 事件 · <b>" + sCount + "</b> 关键</div>" +
        "</div>";
    });
    h += "</div>";
    h += '<div class="rule"></div>' +
      '<div class="chips rv">' +
      '<span class="chip" data-goto="#/timeline">按时间探索</span>' +
      '<span class="chip" data-goto="#/relations">按关系探索</span>' +
      '<span class="chip" data-goto="#/relations">按关系探索</span>' +
      '<span class="chip" data-goto="#/lectures">讲坛模式：45 集</span>' +
      "</div>";
    h += '<div style="height:70px"></div></div>';
    return h;
  }

  function viewUnit(u) {
    var eps = LECS.filter(function (l) { return l.unit === u; });
    var evs = EVENTS.filter(function (e) { return e.unit === u; }).sort(ySort);
    var idx = UNITS.indexOf(u);
    var h = '<div class="wrap"><div class="unit-head rv">' +
      '<div class="back" data-goto="#/acts">返回六幕</div>' +
      '<div class="eyebrow" style="margin-top:22px">Act ' + ("0" + (idx + 1)) + "</div>" +
      '<h1 class="h-big">' + esc(u) + "</h1>" +
      '<div class="rule-zhu"></div>' +
      '<p class="lead">' + esc(UNIT_Q[u] || "") + "</p>" +
      "</div>";

    h += '<div class="sec rv"><div class="sec-h">本幕事件</div><div class="tl-tracks">';
    evs.forEach(function (e) {
      h += '<div class="tl-item imp-' + e.importance + ' rv" data-ev="' + esc(e.id) + '" style="max-width:none;width:100%">' +
        '<div class="tl-item-t">' + esc(e.title) + "</div>" +
        '<div class="tl-item-s">' + esc(e.yearText || yText(e.year)) + (e.summary ? " · " + esc(e.summary) : "") + "</div></div>";
    });
    h += "</div></div>";

    h += '<div class="sec rv"><div class="sec-h">本幕讲坛集</div><div class="chips">';
    eps.forEach(function (l) {
      h += '<span class="chip" data-lec="' + l.episode + '">' + l.episode + "　" + esc(l.title) + "</span>";
    });
    h += "</div></div>";
    h += '<div style="height:70px"></div></div>';
    return h;
  }

  /* ---------- 纪年 Timeline ---------- */
  var tlState = { lines: [], imp: ["S", "A", "B"], selectedYear: -206, selectedEvent: "ev-hongmen", tab: "story" };
  var TL_ERAS = [
    { label: "秦末余晖", from: -211, to: -210 }, { label: "反秦风暴", from: -209, to: -207 },
    { label: "楚汉战争", from: -206, to: -202 }, { label: "开国定制", from: -201, to: -198 },
    { label: "晚年危机", from: -197, to: -195 }
  ];
  var TL_POINTS = {
    "-211":[72,66], "-210":[116,110], "-209":[154,158], "-208":[220,198], "-207":[286,238],
    "-206":[372,286], "-205":[455,362], "-204":[522,420], "-203":[603,462], "-202":[690,502],
    "-201":[758,532], "-200":[818,548], "-199":[862,560], "-198":[904,575], "-197":[950,592],
    "-196":[1002,615], "-195":[1080,650]
  };
  var TL_STREAMS = [
    { name:"刘邦", cls:"liubang", d:"M150 112 C220 122 300 210 372 286 C438 352 520 420 603 462 C740 535 900 585 1080 650", x:138, y:101 },
    { name:"项羽", cls:"xiangyu", d:"M150 210 C225 178 304 220 372 286 C445 315 560 406 690 502", x:137, y:228 },
    { name:"韩信", cls:"hanxin", d:"M330 154 C365 205 406 305 455 362 C520 422 608 465 690 502 C795 554 900 586 1002 615", x:305, y:144 },
    { name:"萧何", cls:"xiaohe", d:"M150 302 C220 324 304 278 372 286 C438 350 520 421 603 462 C735 537 900 588 1040 635", x:135, y:321 },
    { name:"张良", cls:"zhangliang", d:"M218 372 C276 354 330 308 372 286 C440 350 520 421 603 462 C738 538 890 583 1053 640", x:188, y:388 }
  ];

  /* ---------- 纪年 · 单轴时间线 ---------- */
  function tlEraForYear(y) {
    for (var i = 0; i < TL_ERAS.length; i++) if (y >= TL_ERAS[i].from && y <= TL_ERAS[i].to) return TL_ERAS[i];
    return TL_ERAS[0];
  }

  function viewTimeline() {
    var sorted = EVENTS.slice().filter(function (e) { return e.year != null; }).sort(ySort);
    var years = [];
    sorted.forEach(function (e) { if (years.indexOf(e.year) < 0) years.push(e.year); });

    var h = '<div class="tlx">';
    h += '<header class="tlx-head rv"><div class="tlx-head-l">' +
      '<div class="tlx-eyebrow">Chronicle</div>' +
      '<h1>帝国纪年</h1>' +
      '<p>前 211 — 前 195　·　一条轴，串起十六年间的每一次转折</p></div>' +
      '<div class="tlx-tools"><div class="tlx-filter" id="tlxFilter">' +
      '<button class="' + (!tlState.lines.length ? "on" : "") + '" data-line-all>全部</button>';
    MAIN_LINES.forEach(function (p) {
      h += '<button class="' + (tlState.lines.indexOf(p) >= 0 ? "on" : "") + '" data-line="' + esc(p) + '">' + esc(p) + '</button>';
    });
    h += '</div><div class="tlx-filter tlx-imp" id="tlxImp">';
    ["S", "A", "B"].forEach(function (k) {
      h += '<button class="' + (tlState.imp.indexOf(k) >= 0 ? "on" : "") + '" data-imp="' + k + '">' + k + '</button>';
    });
    h += '</div></div></header>';

    h += '<div class="tlx-body" id="tlxBody"><div class="tlx-axis"><i class="tlx-axis-fill"></i></div>';
    years.forEach(function (year) {
      var evs = sorted.filter(function (e) { return e.year === year; });
      var era = tlEraForYear(year);
      h += '<section class="tlx-year" data-year="' + year + '">' +
        '<div class="tlx-year-side"><b>' + yText(year).replace(/ /g, "") + '</b>' +
        '<span>' + esc(era.label) + '</span></div><div class="tlx-events">';
      evs.forEach(function (e) {
        h += '<article class="tlx-ev imp-' + esc(e.importance) + '" data-goto="#/event/' + encodeURIComponent(e.id) +
          '" data-people="' + esc((e.people || []).join(",")) + '" data-level="' + esc(e.importance) + '">' +
          '<i class="tlx-dot"></i><div class="tlx-card"><h3>' + esc(e.title) + '</h3>' +
          '<p>' + esc(e.summary || "") + '</p><div class="tlx-meta">' +
          (e.people && e.people.length ? '<span class="tlx-who">' + esc(e.people.slice(0, 4).join(" · ")) + '</span>' : "") +
          '<span class="tlx-unit">' + esc(e.unit || "") + '</span></div></div></article>';
      });
      h += "</div></section>";
    });
    h += "</div>";
    h += '<footer class="tlx-foot"><span><b id="tlxCount">' + sorted.length + "</b> / " + sorted.length +
      ' 条事件在轴上</span><span class="tlx-hint">点击事件进入三层阅读</span></footer></div>';
    return h;
  }

  var tlScroll = null;
  function clearTimelineScroll() {
    if (tlScroll && window.removeEventListener) window.removeEventListener("scroll", tlScroll);
    tlScroll = null;
  }

  function bindTimeline() {
    clearTimelineScroll();
    var body = document.getElementById("tlxBody");
    if (!body) return;
    var filter = document.getElementById("tlxFilter"), imp = document.getElementById("tlxImp");
    var axis = body.querySelector(".tlx-axis-fill");

    function apply() {
      var n = 0;
      body.querySelectorAll(".tlx-ev").forEach(function (it) {
        var lv = it.dataset.level || "B";
        var pe = (it.dataset.people || "").split(",");
        var ok = (!tlState.imp.length || tlState.imp.indexOf(lv) >= 0) &&
          (!tlState.lines.length || tlState.lines.some(function (l) { return pe.indexOf(l) >= 0; }));
        it.classList.toggle("hid", !ok);
        if (ok) n++;
      });
      body.querySelectorAll(".tlx-year").forEach(function (yr) {
        yr.classList.toggle("hid", !yr.querySelector(".tlx-ev:not(.hid)"));
      });
      var c = document.getElementById("tlxCount");
      if (c) c.textContent = n;
    }

    if (filter) filter.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-line-all")) tlState.lines = [];
      else {
        var i = tlState.lines.indexOf(b.dataset.line);
        if (i >= 0) tlState.lines.splice(i, 1); else tlState.lines.push(b.dataset.line);
      }
      filter.querySelector("[data-line-all]").classList.toggle("on", !tlState.lines.length);
      filter.querySelectorAll("[data-line]").forEach(function (x) {
        x.classList.toggle("on", tlState.lines.indexOf(x.dataset.line) >= 0);
      });
      apply();
    });

    if (imp) imp.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      b.classList.toggle("on");
      tlState.imp = Array.prototype.slice.call(imp.querySelectorAll("button.on")).map(function (x) { return x.dataset.imp; });
      apply();
    });

    apply();

    /* 滚动动效：优先用 ScrollTrigger（轴线 scrub + 节点可回退点亮 + 年份高亮），
       无 GSAP 或用户偏好减少动效时，降级为直接显示。 */
    var items = body.querySelectorAll(".tlx-ev");
    var years = body.querySelectorAll(".tlx-year");

    if (!ST || prefersReduced) {
      items.forEach(function (it) { it.classList.add("in"); });
      if (axis) axis.style.transform = "scaleY(1)";
      return;
    }

    // 轴线随滚动生长（scrub 0.5 → 有轻微追赶感，比直接跟随更有质感）
    if (axis) {
      ST.create({
        trigger: body,
        start: "top 70%",
        end: "bottom 80%",
        scrub: 0.5,
        onUpdate: function (self) { axis.style.transform = "scaleY(" + self.progress + ")"; }
      });
    }

    // 事件节点逐个点亮，反向滚出视口时收回
    items.forEach(function (it) {
      window.gsap.fromTo(it,
        { opacity: 0, y: 28 },
        {
          opacity: 1, y: 0, duration: 0.72, ease: "power2.out",
          scrollTrigger: { trigger: it, start: "top 90%", toggleActions: "play none none reverse" }
        });
    });

    // 年份进入视口中段时高亮
    years.forEach(function (yr) {
      ST.create({
        trigger: yr,
        start: "top 62%",
        end: "bottom 38%",
        onToggle: function (self) { yr.classList.toggle("active", self.isActive); }
      });
    });
  }

  /* ---------- 人物页 ---------- */
  function viewPerson(id) {
    var p = byId(PERSONS, id);
    if (!p) return '<div class="wrap"><div style="padding:80px 0">未找到该人物</div></div>';
    var evs = eventsOfPerson(p.name).sort(ySort);
    var rels = RELS.filter(function (r) { return r.a === p.name || r.b === p.name; });
    var lecs = lecsOfPerson(p.name);
    var personEvals = evaluationsOfPerson(p.name);
    /* 照片：assets/img/people/{姓名}.jpg —— 缺失时回落到姓名首字的帛书头像 */
    var photoName = String(p.id || p.name || "").replace(/^p-/, "");
    var h = '<div class="wrap-narrow"><div style="padding:60px 0 0" class="rv">' +
      '<div class="back" data-goto="#/acts">返回六幕</div>' +
      '<div class="p-head">' +
        '<figure class="p-portrait tier-' + esc(p.tier) + '">' +
          '<img class="p-photo" src="assets/img/people/' + encodeURIComponent(photoName) + '.jpg" alt="' + esc(p.name) +
          '" loading="lazy" onerror="this.classList.add(\'broken\')">' +
          '<i class="p-fallback" aria-hidden="true">' + esc(p.name.slice(0, 1)) + "</i>" +
          '<b class="p-badge">' + esc(p.tier) + "</b>" +
        "</figure>" +
        '<div class="p-head-txt">' +
          '<div class="eyebrow">' + esc(p.tier) + " 级 · " + esc(p.faction || "") + "</div>" +
          '<h1 class="h-big p-name">' + esc(p.name) + "</h1>" +
          '<div class="rule-zhu"></div>' +
          '<div class="rs-titles" style="font-size:15px">' + (p.titles && p.titles.length ? esc(p.titles.join("　→　")) : "—") + "</div>" +
        "</div>" +
      "</div>";
    if (p.note) h += '<p class="lead">' + esc(p.note) + "</p>";
    h += "</div>";

    h += '<div class="sec rv"><table class="kv">';
    h += row("阵营", p.faction); row("职能", p.role);
    h += row("加入阶段", p.joinPhase); h += row("来源途径", p.joinPath);
    h += row("专长", p.specialty); h += row("才与疑", (p.trustUse || "—") + " · " + (p.trustDoubt || "—"));
    h += "</table></div>";

    if (p.name === "刘邦") {
      h += '<div class="sec rv"><div class="sec-h">身份变化 · Role Timeline</div><div class="chips" style="margin-top:0">';
      (p.titles || []).forEach(function (t, i) {
        h += '<span class="chip" style="cursor:default">' + (i ? "↓ " : "") + esc(t) + "</span>";
      });
      h += "</div><p class='lead' style='font-size:14px;margin-top:14px'>刘邦一生不是静态的「皇帝」。从布衣到皇帝，每一次身份变化都对应一次权力与关系的重组。</p></div>";
    }

    if (evs.length) {
      h += '<div class="sec rv"><div class="sec-h">涉及事件</div>';
      evs.forEach(function (e) {
        h += '<div class="tl-item imp-' + e.importance + '" data-ev="' + esc(e.id) + '" style="max-width:none">' +
          '<div class="tl-item-t">' + esc(e.title) + "</div>" +
          '<div class="tl-item-s">' + esc(e.yearText || yText(e.year)) + " · " + esc((e.summary || "").slice(0, 56)) + "</div></div>";
      });
      h += "</div>";
    }
    if (rels.length) {
      h += '<div class="sec rv"><div class="sec-h">关系</div>';
      rels.forEach(function (r) {
        h += '<div class="tl-item" data-rel="' + esc(r.id) + '" style="max-width:none"><div class="tl-item-t">' +
          esc(r.a) + " × " + esc(r.b) + "</div><div class=\"tl-item-s\">" + esc(r.summary) + "</div></div>";
      });
      h += "</div>";
    }
    if (personEvals.length) {
      h += '<div class="sec rv"><div class="sec-h">王立群评价</div><div class="person-evals">';
      personEvals.slice(0, 8).forEach(function (x) {
        h += '<article><div><b>' + esc(x.trait) + '</b><span data-lec="' + x.episode + '">第 ' + x.episode + ' 集 · ' + esc(x.lecture) + '</span></div>' +
          '<p>' + esc(x.text) + '</p>' + (x.limit ? '<small>局限 / 反例　' + esc(x.limit) + '</small>' : '') + '</article>';
      });
      h += '</div></div>';
    }
    if (lecs.length) {
      h += '<div class="sec rv"><div class="sec-h">讲坛相关集</div><div class="chips">';
      lecs.forEach(function (l) { h += '<span class="chip" data-lec="' + l.episode + '">' + l.episode + "　" + esc(l.title) + "</span>"; });
      h += "</div></div>";
    }
    h += '<div style="height:70px"></div></div>';
    return h;

    function row(k, v) { if (!v || v === "—") return ""; h += "<tr><td>" + k + "</td><td>" + esc(v) + "</td></tr>"; return ""; }
  }

  /* ---------- 关系 ---------- */
  var graphSelected = "韩信";
  var GRAPH_AVATARS = {
    "刘邦": ["han-core.png", "22%", "11%"], "萧何": ["han-core.png", "86%", "11%"],
    "樊哙": ["han-core.png", "22%", "72%"], "曹参": ["han-core.png", "86%", "72%"],
    "张良": ["han-allies.png", "22%", "11%"], "韩信": ["han-allies.png", "86%", "11%"],
    "陈平": ["han-allies.png", "22%", "72%"], "周勃": ["han-allies.png", "86%", "72%"],
    "卢绾": ["han-kin.png", "22%", "11%"], "娄敬": ["han-kin.png", "86%", "11%"],
    "黥布": ["han-kin.png", "22%", "72%"], "刘盈": ["han-kin.png", "86%", "72%"],
    "项羽": ["han-court.png", "22%", "11%"], "范增": ["han-court.png", "86%", "11%"],
    "吕后": ["han-court.png", "22%", "72%"], "戚夫人": ["han-court.png", "86%", "72%"]
  };

  function graphAvatarStyle(name) {
    var a = GRAPH_AVATARS[name] || GRAPH_AVATARS["刘邦"];
    return "--portrait:url('../img/people/" + a[0] + "');--px:" + a[1] + ";--py:" + a[2];
  }
  var GRAPH_NODES = [
    { name: "刘邦", x: 49, y: 51, kind: "center" },
    { name: "萧何", x: 14, y: 27, kind: "core" },
    { name: "樊哙", x: 10, y: 52, kind: "core" },
    { name: "曹参", x: 18, y: 75, kind: "core" },
    { name: "周勃", x: 33, y: 84, kind: "core" },
    { name: "卢绾", x: 45, y: 83, kind: "core" },
    { name: "张良", x: 37, y: 19, kind: "ally" },
    { name: "韩信", x: 54, y: 24, kind: "ally" },
    { name: "陈平", x: 37, y: 67, kind: "ally" },
    { name: "娄敬", x: 58, y: 82, kind: "ally" },
    { name: "黥布", x: 70, y: 68, kind: "ally" },
    { name: "项羽", x: 76, y: 28, kind: "rival" },
    { name: "范增", x: 88, y: 47, kind: "rival" },
    { name: "吕后", x: 90, y: 18, kind: "kin" },
    { name: "刘盈", x: 90, y: 61, kind: "kin" },
    { name: "戚夫人", x: 86, y: 82, kind: "kin" }
  ];

  /* 横向关系的实质说明——悬停节点时展示，让连线不只是装饰 */
  var GRAPH_EDGE_NOTES = {
    "萧何|韩信": "月下追韩信，成也萧何",
    "曹参|韩信": "曾隶韩信麾下，随其破齐",
    "陈平|韩信": "献伪游云梦之计，擒韩信于陈",
    "项羽|范增": "尊为亚父，终被反间计疏远",
    "黥布|项羽": "原为楚将，后叛楚归汉",
    "项羽|韩信": "垓下决战，楚汉终局",
    "吕后|韩信": "与萧何定计，诛韩信于长乐宫钟室",
    "吕后|戚夫人": "夺储之争，终成人彘之祸",
    "吕后|刘盈": "母子，刘盈即后来的汉惠帝",
    "樊哙|吕后": "娶吕后之妹吕媭，与刘邦为连襟"
  };

  function viewRelations() {
    var selected = personByName(graphSelected) || personByName("韩信") || PERSONS[0];
    graphSelected = selected.name;
    var life = eventsOfPerson(selected.name).filter(function (e) { return e.importance !== "B"; }).sort(ySort).slice(0, 7);
    if (life.length < 4) life = eventsOfPerson(selected.name).sort(ySort).slice(0, 7);
    var evals = evaluationsOfPerson(selected.name).slice(0, 2);
    var selectedRel = RELS.find(function (r) {
      return (r.a === "刘邦" && r.b === selected.name) || (r.b === "刘邦" && r.a === selected.name);
    });
    var center = GRAPH_NODES[0];
    var h = '<div class="relation-atlas" id="relationAtlas"><div class="rg-head rv">' +
      '<div><h1>人物关系图</h1><p>从一个人才集团，看汉帝国如何诞生</p></div>' +
      '<div class="rg-head-note"><b>' + GRAPH_NODES.length + '</b><span>位核心人物<br>点击节点读取档案</span></div>' +
      '</div><div class="rg-layout">' +
      '<div class="rg-canvas-scroll"><section class="rg-canvas rv" aria-label="主要人物关系思维导图">' +
      '<div class="rg-group rg-g-core">丰沛核心</div><div class="rg-group rg-g-ally">途中加入</div>' +
      '<div class="rg-group rg-g-rival">楚营</div><div class="rg-group rg-g-kin">宗室与外戚</div>' +
      '<svg class="rg-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">';

    GRAPH_NODES.slice(1).forEach(function (n) {
      var active = n.name === selected.name || selected.name === "刘邦";
      h += '<line class="rg-line ' + esc(n.kind) + (active ? " active" : "") + '" data-a="刘邦" data-b="' + esc(n.name) +
        '" x1="' + center.x + '" y1="' + center.y + '" x2="' + n.x + '" y2="' + n.y + '"></line>';
    });
    /* 节点之间的横向关系——「关系交织」的主角。
       全部取自史事：萧何追韩信 / 曹参曾隶韩信 / 陈平献计擒韩信 /
       项羽与范增、与黥布的旧属关系 / 垓下对手 / 吕后诛韩信、与戚夫人夺储、
       吕后刘盈母子、樊哙娶吕后之妹。 */
    [
      ["萧何", "韩信", "ally"], ["曹参", "韩信", "ally"], ["陈平", "韩信", "ally"],
      ["项羽", "范增", "rival"], ["黥布", "项羽", "rival"], ["项羽", "韩信", "rival"],
      ["吕后", "韩信", "kin"], ["吕后", "戚夫人", "kin"], ["吕后", "刘盈", "kin"],
      ["樊哙", "吕后", "kin"]
    ].forEach(function (edge) {
      var a = GRAPH_NODES.find(function (n) { return n.name === edge[0]; });
      var b = GRAPH_NODES.find(function (n) { return n.name === edge[1]; });
      if (!a || !b) return;
      var active = edge[0] === selected.name || edge[1] === selected.name;
      h += '<line class="rg-line secondary ' + edge[2] + (active ? " active" : "") + '" data-a="' + esc(edge[0]) +
        '" data-b="' + esc(edge[1]) + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"></line>';
    });
    h += "</svg>";

    GRAPH_NODES.forEach(function (n) {
      var p = personByName(n.name);
      if (!p) return;
      h += '<button class="rg-node ' + esc(n.kind) + (n.name === selected.name ? " selected" : "") +
        '" style="--x:' + n.x + '%;--y:' + n.y + '%" data-graph-person="' + esc(n.name) +
        '" aria-label="' + esc(n.name + "，" + (p.role || p.faction || "人物")) + '" aria-pressed="' + (n.name === selected.name ? "true" : "false") + '">' +
        '<span class="rg-portrait" style="' + graphAvatarStyle(n.name) + '"><i aria-hidden="true"></i></span><span class="rg-node-caption"><b>' + esc(n.name) +
        '</b><em>' + esc(p.role || p.faction || "人物") + "</em></span></button>";
    });
    h += '<div class="rg-legend"><span class="core">故旧 / 核心</span><span class="ally">合作 / 吸纳</span>' +
      '<span class="rival">对手 / 楚营</span><span class="kin">宗室 / 外戚</span></div>' +
      '<div class="rg-hint">悬停查看路径　·　单击选择人物　·　双击进入完整档案</div></section></div>';

    h += '<aside class="rg-dossier rv"><div class="rg-dossier-top"><span class="rg-dossier-avatar" style="' + graphAvatarStyle(selected.name) + '"></span><div><h2>' + esc(selected.name) + '</h2>' +
      '<p>' + esc(selected.faction || "—") + ' · ' + esc(selected.role || "—") + '</p></div><span>' + esc(selected.tier) + ' 级</span></div>' +
      '<div class="rg-tabs"><b>生平</b><span>身份变化</span><span>关键事件</span><span>王立群评价</span></div>' +
      '<section class="rg-summary"><h3>人物总评</h3><p>' + esc(selected.note || "该人物档案仍在补充中。") + '</p>' +
      '<div class="rg-meta"><span>专长　' + esc(selected.specialty || "—") + '</span><span>才与疑　' +
      esc((selected.trustUse || "—") + " / " + (selected.trustDoubt || "—")) + '</span></div></section>';

    if (selected.titles && selected.titles.length) {
      h += '<section class="rg-roles"><h3>身份变化</h3><div>';
      selected.titles.forEach(function (title, i) { h += '<span>' + (i ? "→　" : "") + esc(title) + '</span>'; });
      h += "</div></section>";
    }
    h += '<section class="rg-life"><h3>关键生平</h3><div class="rg-life-list">';
    life.forEach(function (e) {
      h += '<button data-ev="' + esc(e.id) + '"><time>' + esc(e.yearText || yText(e.year) || "年代未明") +
        '</time><span>' + esc(e.title) + "</span></button>";
    });
    h += "</div></section>";
    h += '<section class="rg-evals"><h3>王立群评价</h3>';
    if (evals.length) {
      evals.forEach(function (x) {
        h += '<blockquote><b>' + esc(x.trait) + '</b><p>' + esc(x.text) + '</p>' +
          (x.limit ? '<small>局限 / 反例　' + esc(x.limit) + '</small>' : "") +
          '<cite data-lec="' + x.episode + '">《大风歌》第 ' + x.episode + ' 集 · ' + esc(x.lecture) + "</cite></blockquote>";
      });
    } else {
      h += '<p class="rg-empty">讲座中尚未整理出该人物的独立评价，可从相关讲坛集继续阅读。</p>';
    }
    h += "</section>";
    if (selectedRel) h += '<button class="rg-relation-link" data-rel="' + esc(selectedRel.id) + '">查看与刘邦的关系阶段　→</button>';
    h += '<button class="rg-open-person" data-person="' + esc(selected.name) + '">打开完整人物档案　›</button>' +
      "</aside></div></div>";
    return h;
  }

  function bindRelationGraph() {
    var atlas = document.getElementById("relationAtlas");
    if (!atlas) return;
    var graphScroll = atlas.querySelector(".rg-canvas-scroll");
    var selectedNode = atlas.querySelector(".rg-node.selected");
    if (graphScroll && selectedNode && window.innerWidth <= 700) {
      graphScroll.scrollLeft = Math.max(0, selectedNode.offsetLeft - graphScroll.clientWidth / 2);
    }
    atlas.querySelectorAll("[data-graph-person]").forEach(function (el) {
      el.addEventListener("click", function () { graphSelected = el.dataset.graphPerson; render(); });
      el.addEventListener("dblclick", function () {
        var p = personByName(el.dataset.graphPerson);
        if (p) go("#/person/" + encodeURIComponent(p.id));
      });
    });

    /* 悬停聚焦：高亮该人物的全部关系连线与相关节点，其余淡出。
       这是关系网最核心的探索交互——一眼看清「谁和谁有瓜葛」。 */
    var nodes = atlas.querySelectorAll(".rg-node");
    var lines = atlas.querySelectorAll(".rg-line");
    function focusGraph(name) {
      var related = {};
      var notes = [];
      atlas.classList.toggle("rg-focusing", !!name);
      if (name) {
        related[name] = true;
        lines.forEach(function (l) {
          var a = l.getAttribute("data-a"), b = l.getAttribute("data-b");
          if (a === name || b === name) {
            l.classList.add("hot"); l.classList.remove("dim");
            related[a] = true; related[b] = true;
            var note = GRAPH_EDGE_NOTES[a + "|" + b] || GRAPH_EDGE_NOTES[b + "|" + a];
            if (note) notes.push("<b>" + esc(a === name ? b : a) + "</b>　" + esc(note));
          } else { l.classList.add("dim"); l.classList.remove("hot"); }
        });
      } else {
        lines.forEach(function (l) { l.classList.remove("hot"); l.classList.remove("dim"); });
      }
      nodes.forEach(function (n) {
        var nm = n.getAttribute("data-graph-person");
        if (name) {
          n.classList.toggle("hot", !!related[nm]);
          n.classList.toggle("dim", !related[nm]);
        } else {
          n.classList.remove("hot"); n.classList.remove("dim");
        }
      });
      /* 把关系的实质读出来，而不只是亮几条线 */
      var hint = atlas.querySelector(".rg-hint");
      if (hint) {
        hint.innerHTML = notes.length
          ? notes.join("　·　")
          : (name ? "该人物暂未收录横向关系说明" : "悬停查看关系　·　单击选择人物　·　双击进入完整档案");
      }
    }
    nodes.forEach(function (n) {
      n.addEventListener("mouseenter", function () { focusGraph(n.getAttribute("data-graph-person")); });
      n.addEventListener("mouseleave", function () { focusGraph(null); });
    });

    setupGraphMotion(atlas);
  }

  function setupGraphMotion(atlas) {
    createPageMotion(atlas, function (gsap, root) {
      var portraits = root.querySelectorAll(".rg-portrait"), lines = root.querySelectorAll(".rg-line");
      gsap.from(portraits, { scale: .45, autoAlpha: 0, duration: .72, stagger: { amount: .75, from: "center" }, ease: "back.out(1.8)" });
      gsap.from(lines, { strokeDasharray: 120, strokeDashoffset: 120, duration: 1.2, stagger: .025, ease: "power2.out" });
      gsap.to(root.querySelectorAll(".rg-line.secondary"), { strokeDashoffset: -28, duration: 3.4, repeat: -1, ease: "none" });
      gsap.from(root.querySelector(".rg-dossier"), { x: 24, autoAlpha: 0, duration: .65, ease: "power2.out" });
      var selected = root.querySelector(".rg-node.selected .rg-portrait");
      if (selected) gsap.to(selected, { scale: 1.055, duration: 1.45, repeat: -1, yoyo: true, ease: "sine.inOut" });
      portraits.forEach(function (portrait) {
        portrait.addEventListener("mouseenter", function () { gsap.to(portrait, { scale: 1.08, duration: .28, overwrite: "auto", ease: "power2.out" }); });
        portrait.addEventListener("mouseleave", function () { if (!portrait.closest(".rg-node.selected")) gsap.to(portrait, { scale: 1, duration: .32, overwrite: "auto", ease: "power2.out" }); });
      });
    });
  }

  function viewRel(id) {
    var r = byId(RELS, id);
    if (!r) return '<div class="wrap"><div style="padding:80px 0">未找到该关系</div></div>';
    var h = '<div class="wrap-narrow"><div style="padding:60px 0 0" class="rv">' +
      '<div class="back" data-goto="#/relations">返回关系</div>' +
      '<div class="eyebrow" style="margin-top:24px">Relation</div>' +
      '<h1 class="h-big" style="font-size:38px">' + esc(r.a) + '　×　' + esc(r.b) + "</h1>" +
      '<div class="rule-zhu"></div><p class="lead">' + esc(r.summary) + "</p></div>";
    h += '<div class="rel-phases">';
    r.phases.forEach(function (ph) {
      h += '<div class="rel-phase rv">' +
        '<div class="rel-ph-y">' + (ph.year ? yText(ph.year) : "　") + "</div>" +
        "<div><div class=\"rel-ph-t\">" + esc(ph.title) + "<small>" + esc(ph.type) + "</small></div>" +
        '<div class="rel-ph-d">' + esc(ph.desc) + "</div>";
      if (ph.events && ph.events.length) {
        h += '<div class="rel-ph-e">';
        ph.events.forEach(function (eid) {
          var e = byId(EVENTS, eid);
          if (e) h += "<span data-ev=\"" + esc(e.id) + '">' + esc(e.title) + "</span>";
        });
        h += "</div>";
      }
      h += "</div></div>";
    });
    h += "</div>";
    // 相关讲坛
    var evIds = [];
    r.phases.forEach(function (p) { (p.events || []).forEach(function (e) { evIds.push(e); }); });
    var lecSet = {};
    evIds.forEach(function (eid) {
      var e = byId(EVENTS, eid);
      if (e) (e.lectureEpisodes || []).forEach(function (n) { lecSet[n] = 1; });
    });
    var ns = Object.keys(lecSet).map(Number).sort(function (a, b) { return a - b; });
    if (ns.length) {
      h += '<div class="sec rv"><div class="sec-h">相关讲坛集</div><div class="chips">';
      ns.forEach(function (n) { h += '<span class="chip" data-lec="' + n + '">' + n + "　" + esc((byId(LECS, "lec-" + ("0" + n).slice(-2)) || {}).title || "") + "</span>"; });
      h += "</div></div>";
    }
    h += '<div style="height:70px"></div></div>';
    return h;
  }

  /* ---------- 事件详情：三层阅读 ---------- */
  function viewEvent(id) {
    var e = byId(EVENTS, id);
    if (!e) return '<div class="wrap"><div style="padding:80px 0">未找到该事件</div></div>';
    var h = '<div class="wrap-narrow"><div class="ev-head rv">' +
      '<div class="back" data-goto="#/timeline">返回纪年</div>' +
      '<div class="ev-year" style="margin-top:24px">' + esc(e.yearText || yText(e.year)) +
      (e.uncertain ? "　·　年份存疑" : "") + "</div>" +
      '<h1 class="ev-title">' + esc(e.title) + "</h1>" +
      '<span class="ev-imp">' + e.importance + " 级</span>　<span class=\"faint\" style=\"font-size:13px\">" + esc(e.unit) + "</span>";
    h += '<div class="chips" style="margin-top:18px">';
    (e.people || []).forEach(function (p) { h += '<span class="chip" data-person="' + esc(p) + '">' + esc(p) + "</span>"; });
    (e.places || []).forEach(function (p) { h += '<span class="chip" style="cursor:default;opacity:.75">' + esc(p) + "</span>"; });
    h += "</div></div>";

    var isLegend = (e.claimType === "legend");
    h += '<div class="layers" id="layers">' +
      '<div class="layer on" data-layer="story">故事</div>' +
      '<div class="layer" data-layer="shiji">史书</div>' +
      '<div class="layer" data-layer="analysis">解析</div>' +
      "</div>";
    h += '<div class="layer-body" id="layerBody">' + layerStory(e) + "</div>";

    if (isLegend) {
      h += '<div class="legend-box rv"><div class="legend-h">LEGEND ／ 帝王神话</div>' +
        '<div class="legend-step"><b>史书记载</b>《史记》《汉书》中确实存在这一叙事。</div>' +
        '<div class="legend-step"><b>王立群解读</b>将其理解为开国皇帝合法性塑造与「造神」现象。</div>' +
        '<div class="legend-step"><b>现代阅读</b>传奇叙事 ≠ 可验证事实。它可以作为「史书中存在的叙事」来研究，但不能当作史实。</div>' +
        "</div>";
    }

    if (e.lectureEpisodes && e.lectureEpisodes.length) {
      h += '<div class="sec rv"><div class="sec-h">讲坛对应集</div><div class="chips">';
      e.lectureEpisodes.forEach(function (n) {
        var l = byId(LECS, "lec-" + ("0" + n).slice(-2));
        h += '<span class="chip" data-lec="' + n + '">' + n + "　" + esc(l ? l.title : "") + "</span>";
      });
      h += "</div></div>";
    }
    h += '<div class="rule"></div><div class="faint" style="font-size:12px;line-height:2">来源与视角：本页「故事」为依据史书的现代汉语叙述；「史书」列《史记》《汉书》相关篇目与摘录；「解析」为王立群在《大风歌》中的解释与评价，不等同于史实。</div>';
    h += '<div style="height:70px"></div></div>';
    return h;
  }

  function layerStory(e) {
    return '<div class="story">' + esc(e.story || e.summary || "") + "</div>";
  }
  function layerShiji(e) {
    var s = (e.shiji || []);
    if (!s.length) return '<div class="an-body">本事件在讲座中未引具体原文。建议核查：《史记·高祖本纪》《汉书·高帝纪》及相关列传。</div>';
    var h = "";
    s.forEach(function (x) {
      h += '<div class="src-card"><div class="src-book">' + esc(x.book) + "　" + esc(x.section || "") +
        '<span>' + (x.verified ? "原文已核" : "待逐字核对") + "</span></div>" +
        '<p class="src-quote">' + esc(x.quote) + "</p>" +
        '<div class="src-flag ' + (x.verified ? "ok" : "") + '">' + (x.verified ? "多源比对一致" : "依讲座转述或通行理解摘录") + "</div></div>";
    });
    return h;
  }
  function layerAnalysis(e) {
    var lecs = (e.lectureEpisodes || []).map(function (n) { return byId(LECS, "lec-" + ("0" + n).slice(-2)); }).filter(Boolean);
    var h = '<div class="an-tag">王立群观点 · lecture_interpretation</div>' +
      '<div class="an-body">' + esc(e.analysis || "（本事件在讲座中的解释待补）") + "</div>";
    if (lecs.length) {
      h += '<div class="badges">';
      lecs.slice(0, 6).forEach(function (l) {
        h += '<span class="badge badge-lecture" data-lec="' + l.episode + '" style="cursor:pointer">《大风歌》第 ' + l.episode + " 集</span>";
      });
      h += "</div>";
    }
    return h;
  }

  function bindLayers() {
    var box = document.getElementById("layers"), body = document.getElementById("layerBody");
    if (!box || !body) return;
    box.addEventListener("click", function (ev) {
      var t = ev.target.closest(".layer"); if (!t) return;
      box.querySelectorAll(".layer").forEach(function (x) { x.classList.remove("on"); });
      t.classList.add("on");
      var e = byId(EVENTS, parse().arg);
      var k = t.dataset.layer;
      body.innerHTML = k === "story" ? layerStory(e) : k === "shiji" ? layerShiji(e) : layerAnalysis(e);
      body.style.animation = "none"; void body.offsetWidth; body.style.animation = "";
      bind();
    });
  }

  /* ---------- 讲坛 ---------- */
  function viewLectures() {
    var h = '<div class="wrap"><div style="padding:60px 0 0" class="rv">' +
      '<div class="eyebrow">Lecture Mode</div>' +
      '<h1 class="h-big">讲 坛</h1>' +
      '<div class="rule-zhu"></div>' +
      '<p class="lead">《大风歌》45 集是本站的叙事骨架与现代评价来源。这里每集只做摘要、关键观点与史料出处，不重新发布全文。</p>' +
      "</div>";
    h += '<div class="chips rv" id="lecFilter">' +
      '<span class="chip on" data-u="all">全部 45 集</span>';
    UNITS.forEach(function (u) { h += '<span class="chip" data-u="' + esc(u) + '">' + esc(u) + "</span>"; });
    h += "</div>";
    h += '<div class="lec-grid" id="lecGrid">';
    LECS.forEach(function (l) {
      h += '<div class="lec-card rv" data-lec="' + l.episode + '" data-unit="' + esc(l.unit) + '">' +
        '<div class="lec-no">' + ("0" + l.episode).slice(-2) + "</div>" +
        '<div class="lec-t">' + esc(l.title) + "</div>" +
        '<div class="lec-s">' + esc(l.summary || "") + "</div>" +
        '<div class="lec-unit">' + esc(l.unit) + "</div></div>";
    });
    h += "</div><div style='height:60px'></div></div>";
    return h;
  }

  function filterLectures() {
    var f = document.getElementById("lecFilter"), g = document.getElementById("lecGrid");
    if (!f || !g) return;
    f.addEventListener("click", function (e) {
      var c = e.target.closest(".chip"); if (!c) return;
      f.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("on"); });
      c.classList.add("on");
      var u = c.dataset.u;
      g.querySelectorAll(".lec-card").forEach(function (card) {
        card.style.display = (u === "all" || card.dataset.unit === u) ? "" : "none";
      });
    });
  }

  function viewLecture(n) {
    var l = byId(LECS, "lec-" + ("0" + n).slice(-2)) || LECS[parseInt(n, 10) - 1];
    if (!l) return '<div class="wrap"><div style="padding:80px 0">未找到该集</div></div>';
    var claims = (l.claims || []).filter(function (c) { return c.type === "lecture_interpretation" || c.type === "lecture_evaluation" || c.type === "legend" || c.type === "disputed"; });
    var h = '<div class="wrap-narrow"><div class="lec-detail rv">' +
      '<div class="back" data-goto="#/lectures">返回讲坛</div>' +
      '<div class="eyebrow" style="margin-top:24px">Lecture ' + ("0" + l.episode).slice(-2) + " · " + esc(l.unit) + "</div>" +
      '<h1 class="h-big" style="font-size:40px">' + esc(l.title) + "</h1>" +
      '<div class="rule-zhu"></div>' +
      '<p class="lec-body">' + esc(l.summary || "") + "</p>";

    if ((l.people || []).length) {
      h += '<div class="sec"><div class="sec-h">涉及人物</div><div class="people-row">';
      l.people.forEach(function (p) {
        if (personByName(p)) h += '<span class="p-tag" data-person="' + esc(p) + '">' + esc(p) + "</span>";
        else h += '<span class="p-tag" style="opacity:.6;cursor:default">' + esc(p) + "</span>";
      });
      h += "</div></div>";
    }

    if (claims.length) {
      h += '<div class="sec"><div class="sec-h">王立群核心判断</div>';
      claims.slice(0, 12).forEach(function (c) {
        h += '<div class="claim ' + esc(c.type) + '">' + esc(c.text) +
          '<div class="claim-t">' + esc(c.type) + "</div></div>";
      });
      h += "</div>";
    }
    if ((l.narration || []).length) {
      h += '<div class="sec"><div class="sec-h">画外音 · 节目叙事（非王立群个人观点）</div>';
      l.narration.slice(0, 5).forEach(function (t) { h += '<div class="narration">' + esc(t) + "</div>"; });
      h += "</div>";
    }
    if ((l.sources || []).length) {
      h += '<div class="sec"><div class="sec-h">史料出处</div>';
      l.sources.slice(0, 14).forEach(function (s) {
        h += '<div class="src-card"><div class="src-book">' + esc(s.book) + "　" + esc(s.section || "") + "</div>" +
          (s.quote ? '<p class="src-quote">' + esc(s.quote) + "</p>" : "") +
          (s.topic ? '<div class="src-flag">用于说明：' + esc(s.topic) + "</div>" : "") + "</div>";
      });
      h += "</div>";
    }
    var evs = EVENTS.filter(function (e) { return (e.lectureEpisodes || []).indexOf(l.episode) >= 0; });
    if (evs.length) {
      h += '<div class="sec"><div class="sec-h">对应网站事件</div>';
      evs.forEach(function (e) {
        h += '<div class="tl-item imp-' + e.importance + '" data-ev="' + esc(e.id) + '" style="max-width:none">' +
          '<div class="tl-item-t">' + esc(e.title) + "</div></div>";
      });
      h += "</div>";
    }
    var srcIds = YS.lecMap[String(l.episode)] || [];
    if (srcIds.length) {
      h += '<div class="sec"><div class="sec-h">延伸阅读 · 原始史料</div>' +
        '<div class="faint" style="font-size:12px;line-height:2;margin:-8px 0 10px">以下一手史料在本集叙事中被引用，点击可通读原文。</div><div class="sr-read-list">';
      srcIds.forEach(function (cid) {
        var c = srcChapterById(cid);
        if (!c) return;
        h += '<div class="sr-read-item rv" data-src="' + esc(c.id) + '">' +
          srcBookBadge(c.book) + '<span class="sr-read-t">' + esc(c.title) + "</span>" +
          (c.span ? '<span class="sr-read-span">' + esc(c.span) + "</span>" : "") + "</div>";
      });
      h += "</div></div>";
    }
    if ((l.disputes || []).length) {
      h += '<div class="sec"><div class="sec-h">存在争议</div>';
      l.disputes.forEach(function (t) { h += '<div class="claim disputed">' + esc(t) + "</div>"; });
      h += "</div>";
    }
    h += '<div class="rule"></div><div class="badges">' +
      '<span class="badge badge-lecture">百家讲坛</span>' +
      (l.sources || []).slice(0, 4).map(function (s) { return srcBadge(s.book); }).join("") +
      "</div>";
    h += '<div class="faint" style="font-size:12px;line-height:2;margin-top:16px">本页为摘要与结构化整理，非讲座全文。凡标「lecture_interpretation / lecture_evaluation」者，均为王立群的解释与评价。</div>';
    h += "</div><div style='height:60px'></div></div>";
    return h;
  }

  /* ---------- 总评 ---------- */
  function viewTraits() {
    var h = '<div class="wrap"><div style="padding:60px 0 0" class="rv">' +
      '<div class="eyebrow">Character Assessment</div>' +
      '<h1 class="h-big">刘邦为什么是刘邦</h1>' +
      '<div class="rule-zhu"></div>' +
      '<p class="lead">评价不作长篇转述，而拆成可点击的论点：每一条都给出王立群的判断、支撑它的事件、以及它的局限或反例。' +
      "来源为《大风歌》第 43《自信人生》、44《魅力四射》、45《用人有道》三集。</p>" +
      "</div>";
    h += '<div class="trust-note rv" style="margin:20px 0 0">以下均为王立群的评价（lecture_evaluation），不是史书记载，也不是本站的结论。</div>';
    h += '<div class="trait-nav" id="traitNav">';
    TRAITS.forEach(function (t, i) {
      h += '<div class="trait-tab' + (i === 0 ? " on" : "") + '" data-trait="' + esc(t.id) + '">' + esc(t.name) + "</div>";
    });
    h += "</div>";
    h += '<div id="traitBody">' + traitHtml(TRAITS[0]) + "</div>";
    h += '<div style="height:70px"></div></div>';
    return h;
  }

  function traitHtml(t) {
    if (!t) return "";
    var h = '<div class="trait-desc">' + esc(t.desc) + "</div>" +
      '<div class="faint mono" style="font-size:11px;letter-spacing:.16em;margin-bottom:6px">来源：' + esc(t.source) + "</div>";
    h += '<div class="trait-items">';
    (t.items || []).forEach(function (it) {
      h += '<div class="ti rv"><div class="ti-label">' + esc(it.label) +
        "<small>论点</small></div><div><div class=\"ti-text\">" + esc(it.text) + "</div>";
      if (it.limit) h += '<div class="ti-limit"><b>局限 / 反例</b>' + esc(it.limit) + "</div>";
      if (it.people && it.people.length) {
        h += '<div class="people-row" style="margin-top:12px">';
        it.people.forEach(function (p) {
          if (personByName(p)) h += '<span class="p-tag" data-person="' + esc(p) + '">' + esc(p) + "</span>";
        });
        h += "</div>";
      }
      h += "</div></div>";
    });
    h += "</div>";
    h += '<div class="faint" style="font-size:12px;line-height:2">闭环：观点 → 人物 → 事件 → 史料。点击上方人物可进入其人物页，再查其涉及事件与对应讲坛集。</div>';
    return h;
  }

  function bindTraits() {
    var nav = document.getElementById("traitNav"), body = document.getElementById("traitBody");
    if (!nav) return;
    nav.addEventListener("click", function (e) {
      var t = e.target.closest(".trait-tab"); if (!t) return;
      nav.querySelectorAll(".trait-tab").forEach(function (x) { x.classList.remove("on"); });
      t.classList.add("on");
      var obj = TRAITS.filter(function (x) { return x.id === t.dataset.trait; })[0];
      body.innerHTML = traitHtml(obj);
      bind(); observeReveal();
    });
  }

  /* ---------- 史料原文（阅读中枢） ----------
     定位：百家讲坛是叙事主线，这里是一手史料的延伸阅读。
     《史记》20 篇 + 《资治通鉴》卷 7—12，可通读原文，并双向串联到讲坛集。 */
  function srcChapterById(id) {
    var arr = YS.chapters || [];
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }
  function srcBookBadge(book) {
    if (book === "史记") return '<span class="badge badge-shiji">史记</span>';
    if (book === "资治通鉴") return '<span class="badge badge-zztj">资治通鉴</span>';
    return '<span class="badge badge-modern">' + esc(book) + "</span>";
  }
  function viewSources() {
    var all = YS.chapters || [];
    var shiji = all.filter(function (c) { return c.book === "史记"; });
    var zizhi = all.filter(function (c) { return c.book === "资治通鉴"; });
    var totalChars = all.reduce(function (a, c) { return a + (c.chars || 0); }, 0);
    function chapCard(c) {
      var linked = (YS.chapterMap[c.id] || []).length;
      return '<div class="sr-chap rv" data-src="' + esc(c.id) + '">' +
        '<div class="sr-chap-top">' + srcBookBadge(c.book) + '<span class="sr-vol">卷 ' + esc(c.juan) + "</span></div>" +
        '<div class="sr-chap-t">' + esc(c.title) + "</div>" +
        '<div class="sr-chap-meta"><span>' + (c.chars || 0).toLocaleString() + " 字</span>" +
        (linked ? '<span class="sr-link">关联 ' + linked + " 集讲坛</span>" : "") + "</div>" +
        (c.span ? '<div class="sr-chap-span">' + esc(c.span) + "</div>" : "") + "</div>";
    }
    var h = '<div class="wrap"><div style="padding:60px 0 0" class="rv">' +
      '<div class="eyebrow">Primary Sources</div>' +
      '<h1 class="h-big">史料原文</h1>' +
      '<div class="rule-zhu"></div>' +
      '<p class="lead">这里是《大风歌》所据的一手史料，供延伸阅读与对照核验。《史记》二十篇、《资治通鉴》秦末汉初六卷，' +
      "共 " + totalChars.toLocaleString() + " 字，按篇目 / 卷次可通读原文。</p>" +
      '<div class="sr-note rv"><b>主线与补充：</b>本站的叙事骨架是王立群《百家讲坛·大风歌》45 集；' +
      '这些原文是讲座引用的「一手证据」，用以学习、对照与查证，并非替代讲座本身。' +
      '每篇史料都标注了它关联了哪些讲坛集，点开即可回到主线。</div></div>';

    h += '<div class="sec"><div class="sec-h">史记 · 二十篇</div><div class="sr-grid">';
    shiji.forEach(function (c) { h += chapCard(c); });
    h += "</div></div>";
    h += '<div class="sec"><div class="sec-h">资治通鉴 · 秦末汉初六卷（卷 7—12）</div><div class="sr-grid">';
    zizhi.forEach(function (c) { h += chapCard(c); });
    h += "</div></div>";
    h += '<div style="height:60px"></div></div>';
    return h;
  }

  /* 单篇史料正文阅读 */
  function viewSource(id) {
    var c = srcChapterById(id);
    if (!c) return '<div class="wrap"><div style="padding:80px 0">未找到该史料篇章</div></div>';
    var linked = (YS.chapterMap[id] || []).slice().sort(function (a, b) { return a - b; });
    var h = '<div class="wrap-narrow"><div class="sr-read rv">' +
      '<div class="back" data-goto="#/sources">返回史料原文</div>' +
      '<div class="sr-read-head">' + srcBookBadge(c.book) +
      '<span class="sr-vol">卷 ' + esc(c.juan) + "</span></div>" +
      '<h1 class="h-big" style="font-size:34px">' + esc(c.title) + "</h1>" +
      (c.span ? '<div class="sr-chap-span">' + esc(c.span) + "</div>" : "") +
      '<div class="rule-zhu"></div>' +
      '<div class="faint mono" style="font-size:11px;letter-spacing:.16em;margin-bottom:8px">原文 · ' + (c.chars || 0).toLocaleString() + " 字</div>";
    (c.paras || []).forEach(function (p) {
      h += '<p class="sr-para">' + esc(p) + "</p>";
    });
    if (linked.length) {
      var shown = linked.slice(0, 30);
      h += '<div class="rule"></div><div class="sec"><div class="sec-h">相关讲坛 · ' + linked.length + " 集（回到主线）</div><div class=\"chips\">";
      shown.forEach(function (n) { h += '<span class="chip" data-lec="' + n + '">第 ' + n + " 集</span>"; });
      h += "</div>";
      if (linked.length > shown.length)
        h += '<div class="faint" style="font-size:12px;line-height:2">…另 ' + (linked.length - shown.length) + " 集亦引用本篇</div>";
      h += '<div class="faint" style="font-size:12px;line-height:2;margin-top:6px">这些讲坛集在叙事中引用了本篇史料，点击芯片回到《大风歌》对应集。</div>';
      h += "</div>";
    }
    h += "</div><div style='height:60px'></div></div>";
    return h;
  }

  /* ---------- 命令面板 ---------- */
  var pal = document.getElementById("palette"), palInput = document.getElementById("paletteInput"),
      palList = document.getElementById("paletteList");
  var palItems = [], palIdx = 0;

  var palProgressEl = document.getElementById("palProgress");
  function paintPalProgress() {
    if (!palProgressEl || !palList) return;
    var fill = palProgressEl.firstElementChild;
    var max = palList.scrollHeight - palList.clientHeight;
    var p = max > 4 ? Math.min(1, Math.max(0, palList.scrollTop / max)) : 1;
    if (fill) fill.style.transform = "scaleX(" + p + ")";
  }
  palList.addEventListener("scroll", paintPalProgress, { passive: true });
  function openPal() {
    pal.hidden = false; palInput.value = ""; renderPal(""); palInput.focus();
    paintPalProgress();                         // 重置检索进度条
    if (lenis && lenis.stop) lenis.stop();      // 冻结背景滚动，检索面板自成一层
  }
  function closePal() {
    pal.hidden = true;
    if (lenis && lenis.start) lenis.start();    // 恢复背景滚动
  }
  document.getElementById("btnSearch").addEventListener("click", openPal);
  pal.addEventListener("click", function (e) { if (e.target.dataset.close !== undefined) closePal(); });
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPal(); }
    if (e.key === "Escape") closePal();
    if (!pal.hidden && e.key === "ArrowDown") { e.preventDefault(); palIdx = Math.min(palIdx + 1, palItems.length - 1); paintPal(); }
    if (!pal.hidden && e.key === "ArrowUp") { e.preventDefault(); palIdx = Math.max(palIdx - 1, 0); paintPal(); }
    if (!pal.hidden && e.key === "Enter" && palItems[palIdx]) { palItems[palIdx].run(); closePal(); }
  });
  palInput.addEventListener("input", function () { renderPal(palInput.value.trim()); });

  function renderPal(q) {
    palItems = [];
    var groups = [];
    function push(label, arr) { if (arr.length) groups.push({ label: label, items: arr }); }
    if (!q) {
      push("进入", [
        { t: "六幕章节", s: "Act Select", run: function () { go("#/acts"); } },
        { t: "纪年时间线", s: "前 210 — 前 195", run: function () { go("#/timeline"); } },
        { t: "人物关系", s: "Relations", run: function () { go("#/relations"); } },
        { t: "讲坛 · 大风歌", s: "45 集", run: function () { go("#/lectures"); } },
        { t: "史料原文", s: "史记 · 资治通鉴", run: function () { go("#/sources"); } },
        { t: "刘邦总评", s: "自信 / 魅力 / 用人", run: function () { go("#/traits"); } }
      ]);
      push("关键人物", PERSONS.filter(function (p) { return p.tier === "S"; }).map(pItem));
      push("关键事件", EVENTS.filter(function (e) { return e.importance === "S"; }).slice(0, 8).map(eItem));
    } else {
      push("人物", PERSONS.filter(function (p) { return p.name.indexOf(q) >= 0; }).slice(0, 8).map(pItem));
      push("事件", EVENTS.filter(function (e) { return (e.title + (e.summary || "")).indexOf(q) >= 0; }).slice(0, 10).map(eItem));
      push("关系", RELS.filter(function (r) { return (r.a + r.b).indexOf(q) >= 0; }).slice(0, 8).map(rItem));
      push("讲坛", LECS.filter(function (l) {
        return l.title.indexOf(q) >= 0 || String(l.episode) === q || (l.summary || "").indexOf(q) >= 0;
      }).slice(0, 8).map(lItem));
      push("史料", (YS.chapters || []).filter(function (c) {
        return (c.title + c.book + (c.span || "")).indexOf(q) >= 0;
      }).slice(0, 8).map(srcItem));
    }
    groups.forEach(function (g) { g.items.forEach(function (i) { palItems.push(i); }); });
    palIdx = 0;
    paintPal(groups);
  }
  function pItem(p) { return { t: p.name, s: p.tier + " 级 · " + (p.role || "") + " · " + p.episodeCount + " 集", run: function () { go("#/person/" + encodeURIComponent(p.id)); } }; }
  function eItem(e) { return { t: e.title, s: (e.yearText || yText(e.year)) + " · " + e.importance + " 级", run: function () { go("#/event/" + encodeURIComponent(e.id)); } }; }
  function rItem(r) { return { t: r.a + " × " + r.b, s: r.phases.length + " 阶段", run: function () { go("#/rel/" + encodeURIComponent(r.id)); } }; }
  function lItem(l) { return { t: "第 " + l.episode + " 集　" + l.title, s: l.unit, run: function () { go("#/lecture/" + l.episode); } }; }
  function srcItem(c) { return { t: c.book + " · " + c.title, s: c.span || ("卷 " + c.juan), run: function () { go("#/source/" + c.id); } }; }

  function paintPal(groups) {
    if (!groups) {
      document.querySelectorAll(".pal-item").forEach(function (el, i) { el.classList.toggle("on", i === palIdx); });
      var on = document.querySelector(".pal-item.on");
      if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
      return;
    }
    var h = "";
    groups.forEach(function (g) {
      h += '<div class="pal-group">' + esc(g.label) + "</div>";
      g.items.forEach(function (it) { h += '<div class="pal-item"><b>' + esc(it.t) + "</b><span>" + esc(it.s) + "</span></div>"; });
    });
    if (!palItems.length) h = '<div class="pal-empty">没有匹配的人物、事件、关系或讲坛集</div>';
    palList.innerHTML = h;
    var palCount = document.getElementById("palCount");
    if (palCount) {
      palCount.innerHTML = palItems.length ? "<b>" + palItems.length + "</b> 条结果" : "无匹配";
    }
    palList.querySelectorAll(".pal-item").forEach(function (el, i) {
      el.addEventListener("click", function () { palItems[i].run(); closePal(); });
      el.addEventListener("mouseenter", function () { palIdx = i; paintPal(); });
    });
    paintPal();
  }

  /* ---------- 启动 ---------- */
  document.querySelector(".hud-mark").addEventListener("click", function () { go("#/"); });

  /* 先启动动效基础设施（Lenis 平滑滚动 + ScrollTrigger 注册），
     后续 render、顶栏收缩都依赖它 */
  initMotionBase();

  /* 顶栏滚动收缩：下滚超过 90px 后 HUD 变紧凑，回到顶部自动恢复 */
  (function () {
    var hud = document.getElementById("hud");
    if (!hud) return;
    var onScroll = function (y) { hud.classList.toggle("compact", y > 90); };
    if (lenis) lenis.on("scroll", function (e) { onScroll(e.scroll || 0); });
    else if (window.addEventListener) {
      window.addEventListener("scroll", function () {
        onScroll(window.pageYOffset || 0);
      }, { passive: true });
    }
  })();

  window.addEventListener("hashchange", render);
  render();
})();
