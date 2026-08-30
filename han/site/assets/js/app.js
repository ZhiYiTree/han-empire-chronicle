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

  /* ---------- 人物 × 讲坛 × 史料：证据链 ---------- */
  var SOURCE_TRANSLATIONS = {
    "汉王怒，欲谋攻项羽": "汉王刘邦大怒，打算发兵攻打项羽。",
    "虽王汉中之恶，不犹愈于死乎": "虽然被封到汉中并不理想，但总比白白送死强。",
    "天予不取，反受其咎": "上天给你的机会若不把握，反而会受到惩罚。",
    "王何不烧绝所过栈道，示天下无还心，以固项王意": "大王何不烧掉走过的栈道，向天下表示无意东归，从而让项羽放心。",
    "上不欲就天下乎，何为斩壮士": "汉王不是想夺取天下吗？为什么反而要杀掉壮士？",
    "诸将易得耳，至如信者，国士无双": "一般将领容易得到，像韩信这样的天下奇才却独一无二。",
    "大风起兮云飞扬，威加海内兮归故乡，安得猛士兮守四方": "大风卷起、云气飞扬；我威震天下后回到故乡，却仍忧虑到哪里才能得到勇士守卫四方。",
    "彼可取而代也": "那个人的帝位，是可以夺来取代的。",
    "先发制人，后则为人所制": "抢先行动就能控制别人，迟一步便会被别人控制。",
    "楚虽三户，亡秦必楚": "楚国即使只剩很少的人，最终灭亡秦国的也一定是楚人。",
    "吾入关，秋豪不敢有所近，籍吏民，封府库，而待将军": "我进入关中后丝毫不敢侵占财物，只登记百姓、封存府库，等待将军到来。",
    "项庄舞剑，意在沛公": "项庄表面舞剑，真正的目标却是刺杀沛公刘邦。",
    "竖子不足与谋": "这个小子不值得共同谋划大事。",
    "夫运筹策帷帐之中，决胜于千里之外，吾不如子房": "论在营帐中筹划而在千里之外取胜，我比不上张良。",
    "镇国家，抚百姓，给馈饷，不绝粮道，吾不如萧何": "论安定国家、抚慰百姓、供应军粮并保证粮道，我比不上萧何。",
    "连百万之军，战必胜，攻必取，吾不如韩信": "论统率百万大军、战必胜而攻必取，我比不上韩信。",
    "此三者，皆人杰也，吾能用之，此吾所以取天下也": "这三位都是人中豪杰；我能够任用他们，这就是我取得天下的原因。",
    "狡兔死，良狗亨；高鸟尽，良弓藏；敌国破，谋臣亡": "狡兔死尽，猎狗就被烹杀；飞鸟射尽，良弓便被收藏；敌国破灭，谋臣也将遭殃。",
    "天下已定，我固当烹": "天下已经平定，我本来就会落得被诛杀的结局。",
    "生我者父母，知我者鲍子也": "生我的是父母，真正了解我的却是鲍叔牙。",
    "吾以布衣提三尺取天下，此非天命乎": "我以平民身份仗剑取得天下，这难道不是天命吗？"
  };

  function cleanQuote(q) {
    return String(q || "").replace(/[“”‘’「」『』]/g, "").trim();
  }
  function citationTranslation(s) {
    var q = cleanQuote(s && s.quote);
    if (SOURCE_TRANSLATIONS[q]) return { text: SOURCE_TRANSLATIONS[q], exact: true };
    var topic = String(s && s.topic || "").replace(/^(记载|说明|用于说明|讲述|引述|表现|反映|对应)/, "");
    return {
      text: topic ? "这段史料主要讲的是：" + topic.replace(/[。；;]+$/, "") + "。" : "该段需要结合上下文阅读，本站暂未提供可靠的逐字今译。",
      exact: false
    };
  }
  function citationPeople(s, claim) {
    var hay = String((s && s.quote) || "") + String((s && s.topic) || "") + String((claim && claim.text) || "");
    return PERSONS.filter(function (p) { return hay.indexOf(p.name) >= 0; }).map(function (p) { return p.name; }).slice(0, 6);
  }
  function textAffinity(a, b) {
    a = String(a || ""); b = String(b || "");
    var score = 0, seen = {};
    for (var i = 0; i < a.length - 1; i++) {
      var k = a.slice(i, i + 2);
      if (!seen[k] && b.indexOf(k) >= 0) { score++; seen[k] = true; }
    }
    return score;
  }
  function bestClaimForCitation(l, s, personName) {
    var rows = (l.claims || []).concat(l.evaluations || []);
    var best = null, bestScore = -1;
    rows.forEach(function (c) {
      var people = (c.people || []).concat(c.target ? [c.target] : []);
      var score = textAffinity((s.topic || "") + (s.quote || ""), c.text || "");
      if (personName && people.indexOf(personName) >= 0) score += 5;
      if (score > bestScore) { best = c; bestScore = score; }
    });
    return best;
  }
  function normalizeSection(s) {
    return String(s || "").replace(/[（(].*?[）)]/g, "").replace(/本集|讲次|引述|引/g, "").trim();
  }
  function citationMatchesChapter(s, c) {
    if (!s || !c || s.book !== c.book) return false;
    var section = normalizeSection(s.section), title = normalizeSection(c.title);
    return !!section && !!title && (section.indexOf(title) >= 0 || title.indexOf(section) >= 0);
  }
  function chapterForCitation(s, episode) {
    var candidates = (YS.lecMap[String(episode)] || []).map(srcChapterById).filter(Boolean);
    var exact = candidates.filter(function (c) { return citationMatchesChapter(s, c); })[0];
    if (exact) return exact;
    return candidates.filter(function (c) { return c.book === s.book; })[0] || null;
  }
  function evidenceSourceCard(s, l, personName, compact) {
    var translation = citationTranslation(s), claim = bestClaimForCitation(l, s, personName);
    var people = citationPeople(s, claim), chapter = chapterForCitation(s, l.episode);
    var h = '<article class="ev-source-card" data-evidence-people="|' + esc(people.join("|")) + '|">' +
      '<header><span>' + esc(s.book || "史料") + '</span><b>' + esc(s.section || "篇目未标") + '</b></header>' +
      (s.quote ? '<blockquote>' + esc(s.quote) + '</blockquote>' : '') +
      '<div class="ev-translation"><em>' + (translation.exact ? "白话翻译" : "白话译意 · 据本集语境") + '</em><p>' + esc(translation.text) + '</p></div>';
    if (!compact && claim && claim.text) h += '<div class="ev-interpret"><em>讲坛解释</em><p>' + esc(claim.text) + '</p></div>';
    if (people.length) {
      h += '<div class="ev-source-people">';
      people.forEach(function (name) { h += '<button data-person="' + esc(name) + '">' + esc(name) + '</button>'; });
      h += '</div>';
    }
    h += '<footer><button data-lec="' + l.episode + '">第 ' + l.episode + ' 集</button>' +
      (chapter ? '<button data-src="' + esc(chapter.id) + '">通读《' + esc(chapter.title) + '》</button>' : '<span>暂无全文映射</span>') + '</footer></article>';
    return h;
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
  function currentScrollY() {
    return Math.max(0, window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0);
  }
  var supportsHistory = !!(window.history && window.history.pushState && window.history.replaceState);
  function go(hash) {
    if (!hash || hash === location.hash) return;
    if (!supportsHistory) { location.hash = hash; return; }
    var oldState = window.history.state || {};
    window.history.replaceState(Object.assign({}, oldState, { hanRoute: true, scrollY: currentScrollY() }), "", location.href);
    window.history.pushState({ hanRoute: true, hasPrevious: true, scrollY: 0 }, "", hash);
    render({ restoreScroll: 0 });
  }
  function goBack(fallback) {
    if (supportsHistory && window.history.state && window.history.state.hasPrevious) {
      window.history.back();
    } else {
      go(fallback || "#/acts");
    }
  }
  function parse() {
    var h = (location.hash || "#/").replace(/^#\/?/, "");
    var p = h.split("/").filter(Boolean);
    return { name: p[0] || "opening", arg: p[1] ? decodeURIComponent(p[1]) : null };
  }

  function render(options) {
    options = options || {};
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
    if (options.preserveScroll) {
      // 关系图切换选中人物时不让画布跳回页面顶端。
    } else if (options.restoreScroll > 0) {
      requestAnimationFrame(function () {
        if (lenis) lenis.scrollTo(options.restoreScroll, { immediate: true });
        else window.scrollTo(0, options.restoreScroll);
      });
    } else scrollToTop();
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
    app.querySelectorAll("[data-back]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        goBack(el.dataset.back);
      });
    });
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
    bindScrollLayers();
    bindPersonEvidence();
    bindLectureEvidence();
    bindSourceReader();
    bindLayers();
    bindTraits();
    filterLectures();
  }

  /* ---------- 滚动层级 ----------
     页面、浮动档案、工具列表各自使用不同视觉轨道；这里仅负责给
     可滚动容器标记当前位置，让粘性抬头在内容从其下方经过时产生深度。 */
  function bindScrollLayers() {
    var scrollers = document.querySelectorAll(
      ".rg-dossier,.palette-list,.ct-tab-content,.chrono-scroll,.chrono-filters,.river-tools,.rg-canvas-scroll"
    );
    scrollers.forEach(function (el) {
      function paintScrollLayer() {
        var vertical = el.scrollHeight > el.clientHeight + 2;
        var horizontal = el.scrollWidth > el.clientWidth + 2;
        el.classList.toggle("has-scroll", vertical || horizontal);
        el.classList.toggle("is-scrolled", el.scrollTop > 6 || el.scrollLeft > 6);
        el.classList.toggle("is-at-end",
          (!vertical || el.scrollTop + el.clientHeight >= el.scrollHeight - 6) &&
          (!horizontal || el.scrollLeft + el.clientWidth >= el.scrollWidth - 6));
      }
      paintScrollLayer();
      el.addEventListener("scroll", paintScrollLayer, { passive: true });
    });
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
      '<button class="back" data-back="#/acts">返回上一页</button>' +
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

  function personEvidenceLectures(name) {
    return lecsOfPerson(name).map(function (l) {
      var judgments = (l.claims || []).filter(function (c) { return (c.people || []).indexOf(name) >= 0; })
        .concat((l.evaluations || []).filter(function (e) { return e.target === name || (e.people || []).indexOf(name) >= 0; }));
      var quoted = (l.sources || []).filter(function (s) { return !!s.quote; });
      return { lecture: l, judgments: judgments, sources: quoted, score: judgments.length * 4 + Math.min(quoted.length, 4) };
    }).filter(function (x) { return x.judgments.length || x.sources.length; })
      .sort(function (a, b) { return b.score - a.score || a.lecture.episode - b.lecture.episode; }).slice(0, 10);
  }

  function personEvidenceHtml(p) {
    var chains = personEvidenceLectures(p.name);
    if (!chains.length) return "";
    var h = '<section class="sec rv evidence-workbench person-evidence" id="personEvidence">' +
      '<div class="evidence-kicker"><span>人物</span><i>→</i><span>讲坛观点</span><i>→</i><span>史料证据</span></div>' +
      '<div class="sec-h">' + esc(p.name) + '的证据链</div>' +
      '<p class="evidence-intro">选择一集，连续阅读王立群如何评价此人、依据了哪条史料，以及这段古文的白话译意。</p>' +
      '<div class="person-evidence-nav" role="tablist">';
    chains.forEach(function (x, i) {
      h += '<button role="tab" aria-selected="' + (i === 0 ? "true" : "false") + '" class="' + (i === 0 ? "on" : "") +
        '" data-pe-episode="' + x.lecture.episode + '"><b>' + ("0" + x.lecture.episode).slice(-2) + '</b><span>' + esc(x.lecture.title) + '</span></button>';
    });
    h += '</div><div class="person-evidence-panels">';
    chains.forEach(function (x, i) {
      var l = x.lecture;
      h += '<div class="person-evidence-panel' + (i === 0 ? " on" : "") + '" data-pe-panel="' + l.episode + '">' +
        '<div class="pe-judgments"><h3>讲坛中的判断</h3>';
      x.judgments.slice(0, 3).forEach(function (j) {
        h += '<article><b>' + esc(j.trait || (j.type === "lecture_evaluation" ? "人物评价" : "核心观点")) + '</b><p>' + esc(j.text || "") + '</p>' +
          (j.limit ? '<small>边界　' + esc(j.limit) + '</small>' : '') + '</article>';
      });
      if (!x.judgments.length) h += '<p class="evidence-empty">本集涉及此人，但尚未拆出独立评价。</p>';
      h += '</div><div class="pe-sources"><h3>对应史料与译解</h3>';
      var named = x.sources.filter(function (s) { return (s.quote + s.topic).indexOf(p.name) >= 0; });
      var chosen = (named.length ? named : x.sources).slice(0, 2);
      chosen.forEach(function (s) { h += evidenceSourceCard(s, l, p.name, true); });
      if (!chosen.length) h += '<p class="evidence-empty">本集暂无可逐句对照的史料摘录。</p>';
      h += '</div><button class="pe-open-lecture" data-lec="' + l.episode + '">进入第 ' + l.episode + ' 集完整讲坛档案　›</button></div>';
    });
    h += '</div></section>';
    return h;
  }

  function bindPersonEvidence() {
    var root = document.getElementById("personEvidence");
    if (!root) return;
    root.querySelectorAll("[data-pe-episode]").forEach(function (button) {
      button.addEventListener("click", function () {
        var episode = button.dataset.peEpisode;
        root.querySelectorAll("[data-pe-episode]").forEach(function (b) {
          var on = b === button; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false");
        });
        root.querySelectorAll("[data-pe-panel]").forEach(function (panel) { panel.classList.toggle("on", panel.dataset.pePanel === episode); });
        if (window.gsap && !prefersReduced) {
          window.gsap.fromTo(root.querySelector('[data-pe-panel="' + episode + '"]'), { autoAlpha: 0, y: 10 },
            { autoAlpha: 1, y: 0, duration: .36, ease: "power2.out", clearProps: "opacity,visibility,transform" });
        }
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
    var focus = personPhotoFocus(p.name);
    var h = '<div class="wrap-narrow person-page"><div style="padding:60px 0 0" class="rv">' +
      '<button class="back" data-back="#/relations">返回上一页</button>' +
      '<div class="p-head">' +
        '<figure class="p-portrait tier-' + esc(p.tier) + '" style="--photo-x:' + focus[0] + ';--photo-y:' + focus[1] + '">' +
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

    h += personEvidenceHtml(p);

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
  var PERSON_PHOTO_FOCUS = {
    "刘邦": ["53%", "31%"], "萧何": ["53%", "32%"], "樊哙": ["51%", "34%"], "曹参": ["53%", "32%"],
    "张良": ["54%", "32%"], "韩信": ["58%", "34%"], "陈平": ["54%", "32%"], "周勃": ["52%", "33%"],
    "卢绾": ["48%", "34%"], "娄敬": ["54%", "31%"], "黥布": ["48%", "34%"], "刘盈": ["52%", "34%"],
    "项羽": ["50%", "31%"], "范增": ["52%", "29%"], "吕后": ["51%", "30%"], "戚夫人": ["53%", "30%"]
  };

  function personPhotoFocus(name) { return PERSON_PHOTO_FOCUS[name] || ["50%", "32%"]; }

  function graphAvatarStyle(name) {
    var focus = personPhotoFocus(name);
    return "--portrait:url('../img/people/" + encodeURIComponent(name) + ".jpg');--px:" + focus[0] + ";--py:" + focus[1];
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
      '<div class="rg-canvas-scroll" data-lenis-prevent><section class="rg-canvas rv" aria-label="主要人物关系思维导图">' +
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
      '<div class="rg-hint">悬停查看路径　·　单击选择人物　·　再次点击进入人物志</div></section></div>';

    h += '<aside class="rg-dossier rv" tabindex="0" data-lenis-prevent aria-label="' + esc(selected.name) + '人物档案，可滚动阅读"><div class="rg-dossier-top"><span class="rg-dossier-avatar" style="' + graphAvatarStyle(selected.name) + '"></span><div><h2>' + esc(selected.name) + '</h2>' +
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
      el.addEventListener("click", function () {
        var p = personByName(el.dataset.graphPerson);
        if (!p) return;
        if (graphSelected === p.name) {
          go("#/person/" + encodeURIComponent(p.id));
          return;
        }
        graphSelected = p.name;
        render({ preserveScroll: true });
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
          : (name ? "该人物暂未收录横向关系说明" : "悬停查看关系　·　单击选择人物　·　再次点击进入人物志");
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
      gsap.from(root.querySelector(".rg-dossier"), {
        x: 20, y: 8, scale: .982, autoAlpha: 0, duration: .58,
        transformOrigin: "right center", ease: "power3.out", clearProps: "transform,opacity,visibility"
      });
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
      '<button class="back" data-back="#/relations">返回上一页</button>' +
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
      '<button class="back" data-back="#/timeline">返回上一页</button>' +
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

  function bindLectureEvidence() {
    var root = document.getElementById("lectureEvidence");
    if (!root) return;
    var buttons = root.querySelectorAll("[data-evidence-person]");
    var status = root.querySelector(".lecture-lens-status");
    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var name = button.dataset.evidencePerson;
        buttons.forEach(function (b) {
          var on = b === button; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        var visible = 0;
        root.querySelectorAll(".evidence-filterable,.ev-source-card").forEach(function (item) {
          var people = item.dataset.evidencePeople || "";
          var show = name === "all" || people.indexOf("|" + name + "|") >= 0;
          item.classList.toggle("evidence-hidden", !show);
          if (show) visible++;
        });
        if (status) status.textContent = name === "all" ? "正在显示本集全部证据" : "正在以“" + name + "”为人物透镜，显示 " + visible + " 条直接证据";
      });
    });
  }

  function viewLecture(n) {
    var l = byId(LECS, "lec-" + ("0" + n).slice(-2)) || LECS[parseInt(n, 10) - 1];
    if (!l) return '<div class="wrap"><div style="padding:80px 0">未找到该集</div></div>';
    var claims = (l.claims || []).filter(function (c) { return c.type === "lecture_interpretation" || c.type === "lecture_evaluation" || c.type === "legend" || c.type === "disputed"; });
    var focusPeople = [];
    (l.claims || []).concat(l.evaluations || []).forEach(function (c) {
      (c.people || []).concat(c.target ? [c.target] : []).forEach(function (name) {
        if (personByName(name) && focusPeople.indexOf(name) < 0) focusPeople.push(name);
      });
    });
    focusPeople = focusPeople.slice(0, 10);
    var h = '<div class="wrap-narrow"><div class="lec-detail rv" id="lectureEvidence">' +
      '<button class="back" data-back="#/lectures">返回上一页</button>' +
      '<div class="eyebrow" style="margin-top:24px">Lecture ' + ("0" + l.episode).slice(-2) + " · " + esc(l.unit) + "</div>" +
      '<h1 class="h-big" style="font-size:40px">' + esc(l.title) + "</h1>" +
      '<div class="rule-zhu"></div>' +
      '<p class="lec-body">' + esc(l.summary || "") + "</p>";

    if (focusPeople.length) {
      h += '<section class="lecture-lens"><div class="evidence-kicker"><span>讲坛</span><i>→</i><span>人物透镜</span><i>→</i><span>史料译解</span></div>' +
        '<h2>从谁的视角理解本集？</h2><p>选择人物后，下方只保留与他直接相关的讲坛判断与史料摘录。</p>' +
        '<div class="lecture-lens-people"><button class="on" data-evidence-person="all" aria-pressed="true">全部证据</button>';
      focusPeople.forEach(function (name) {
        h += '<button data-evidence-person="' + esc(name) + '" aria-pressed="false"><span style="' + graphAvatarStyle(name) + '"></span>' + esc(name) + '</button>';
      });
      h += '</div><div class="lecture-lens-status" aria-live="polite">正在显示本集全部证据</div></section>';
    }

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
        var claimPeople = (c.people || []).concat(c.target ? [c.target] : []);
        h += '<div class="claim evidence-filterable ' + esc(c.type) + '" data-evidence-people="|' + esc(claimPeople.join("|")) + '|">' + esc(c.text) +
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
      h += '<div class="sec lecture-source-evidence"><div class="sec-h">史料出处 · 原文 / 白话 / 解释</div>' +
        '<p class="evidence-intro">白话翻译仅在已有可靠对应时作逐句翻译；其余标为“据本集语境的译意”，并与王立群的解释分栏呈现。</p>';
      l.sources.slice(0, 14).forEach(function (s) {
        h += evidenceSourceCard(s, l, null, false);
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
      var explained = sourceCitationRows(c).length;
      return '<div class="sr-chap rv" data-src="' + esc(c.id) + '">' +
        '<div class="sr-chap-top">' + srcBookBadge(c.book) + '<span class="sr-vol">卷 ' + esc(c.juan) + "</span></div>" +
        '<div class="sr-chap-t">' + esc(c.title) + "</div>" +
        '<div class="sr-chap-meta"><span>' + (c.chars || 0).toLocaleString() + " 字</span>" +
        (linked ? '<span class="sr-link">关联 ' + linked + " 集讲坛</span>" : "") +
        (explained ? '<span class="sr-explained">讲坛引文 ' + explained + " 条</span>" : "") + "</div>" +
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

  function sourceCitationRows(c) {
    var out = [], seen = {};
    LECS.forEach(function (l) {
      (l.sources || []).forEach(function (s) {
        var q = cleanQuote(s.quote);
        if (q.length < 4 || !citationMatchesChapter(s, c)) return;
        var key = q + "|" + l.episode;
        if (seen[key]) return;
        seen[key] = true;
        var claim = bestClaimForCitation(l, s, null);
        out.push({ lecture: l, source: s, claim: claim, people: citationPeople(s, claim) });
      });
    });
    return out.sort(function (a, b) { return a.lecture.episode - b.lecture.episode; });
  }

  function sourceAssistHtml(row) {
    var tr = citationTranslation(row.source), h = '<aside class="sr-assist">' +
      '<div class="sr-assist-col translation"><em>' + (tr.exact ? "白话翻译" : "白话译意 · 据讲坛语境") + '</em><p>' + esc(tr.text) + '</p></div>' +
      '<div class="sr-assist-col interpretation"><em>讲坛解释</em><p>' + esc((row.claim && row.claim.text) || row.source.topic || "本集将此处作为叙事依据。") + '</p></div>' +
      '<footer><button data-lec="' + row.lecture.episode + '">第 ' + row.lecture.episode + ' 集《' + esc(row.lecture.title) + '》</button>';
    row.people.slice(0, 5).forEach(function (name) { h += '<button data-person="' + esc(name) + '">' + esc(name) + '</button>'; });
    return h + '</footer></aside>';
  }

  function bindSourceReader() {
    var reader = document.getElementById("sourceReader");
    if (!reader) return;
    var body = reader.querySelector(".sr-compare-body"), status = reader.querySelector(".sr-mode-status");
    reader.querySelectorAll("[data-source-mode]").forEach(function (button) {
      button.addEventListener("click", function () {
        var mode = button.dataset.sourceMode;
        reader.querySelectorAll("[data-source-mode]").forEach(function (b) {
          var on = b === button; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        body.className = "sr-compare-body mode-" + mode;
        if (status) status.textContent = mode === "original" ? "正在通读全部原文" :
          mode === "evidence" ? "仅显示被《大风歌》实际引用并可译解的段落" : "原文与现有白话译解对照显示";
        var target = mode === "evidence" ? body.querySelector(".sr-passage.has-evidence") : body.querySelector(".sr-passage");
        if (target) {
          requestAnimationFrame(function () {
            if (lenis) lenis.scrollTo(target, { offset: -82, duration: prefersReduced ? 0 : .55 });
            else target.scrollIntoView({ block: "start", behavior: prefersReduced ? "auto" : "smooth" });
          });
        }
      });
    });
  }

  /* 单篇史料正文阅读 */
  function viewSource(id) {
    var c = srcChapterById(id);
    if (!c) return '<div class="wrap"><div style="padding:80px 0">未找到该史料篇章</div></div>';
    var linked = (YS.chapterMap[id] || []).slice().sort(function (a, b) { return a - b; });
    var citations = sourceCitationRows(c), matchedCount = 0, evidencePeople = [];
    citations.forEach(function (row) { row.people.forEach(function (name) { if (evidencePeople.indexOf(name) < 0) evidencePeople.push(name); }); });
    var h = '<div class="wrap-narrow"><div class="sr-read rv" id="sourceReader">' +
      '<button class="back" data-back="#/sources">返回上一页</button>' +
      '<div class="sr-read-head">' + srcBookBadge(c.book) +
      '<span class="sr-vol">卷 ' + esc(c.juan) + "</span></div>" +
      '<h1 class="h-big" style="font-size:34px">' + esc(c.title) + "</h1>" +
      (c.span ? '<div class="sr-chap-span">' + esc(c.span) + "</div>" : "") +
      '<div class="rule-zhu"></div>' +
      '<section class="sr-reading-console"><div class="evidence-kicker"><span>史料原文</span><i>→</i><span>白话译意</span><i>→</i><span>讲坛解释</span></div>' +
      '<div class="sr-reading-stats"><b>' + (c.chars || 0).toLocaleString() + '</b><span>原文字数</span><b>' + citations.length + '</b><span>讲坛引文</span></div>' +
      '<div class="sr-mode-switch"><button data-source-mode="original" aria-pressed="false">原文通读</button>' +
      '<button class="on" data-source-mode="compare" aria-pressed="true">译解对照</button>' +
      '<button data-source-mode="evidence" aria-pressed="false">只看讲坛证据</button></div>' +
      '<p class="sr-mode-status" aria-live="polite">原文与现有白话译解对照显示</p>';
    if (evidencePeople.length) {
      h += '<div class="sr-evidence-people"><span>本篇证据涉及</span>';
      evidencePeople.slice(0, 12).forEach(function (name) { h += '<button data-person="' + esc(name) + '">' + esc(name) + '</button>'; });
      h += '</div>';
    }
    h += '</section><div class="sr-compare-body mode-compare">';
    (c.paras || []).forEach(function (p, index) {
      var clean = cleanQuote(p), row = null, matches = [];
      for (var i = 0; i < citations.length; i++) {
        var q = cleanQuote(citations[i].source.quote);
        if (q.length >= 4 && clean.indexOf(q) >= 0) matches.push(citations[i]);
      }
      row = matches.filter(function (x) { return citationTranslation(x.source).exact; })[0] || matches[0] || null;
      if (row) matchedCount++;
      h += '<article class="sr-passage' + (row ? " has-evidence" : "") + '" data-passage="' + (index + 1) + '">' +
        '<div class="sr-passage-no">' + ("000" + (index + 1)).slice(-3) + (row ? '<span>讲坛引用</span>' : '') + '</div>' +
        '<p class="sr-para">' + esc(p) + '</p>' + (row ? sourceAssistHtml(row) : '') + '</article>';
    });
    h += '</div>';
    if (citations.length && !matchedCount) {
      h += '<div class="sr-note"><b>译解覆盖说明：</b>本篇虽被讲坛引用，但现有摘录未能与全文逐字定位，因此不强行挂接到具体段落。</div>';
    }
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

  if (supportsHistory) {
    var firstState = window.history.state || {};
    window.history.replaceState(Object.assign({}, firstState, {
      hanRoute: true,
      hasPrevious: firstState.hanRoute ? !!firstState.hasPrevious : false,
      scrollY: firstState.scrollY || currentScrollY()
    }), "", location.href);
    window.addEventListener("popstate", function (event) {
      var state = event.state || {};
      render({ restoreScroll: state.scrollY || 0 });
    });
    document.querySelectorAll('.hud-nav a[href^="#/"]').forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        go(link.getAttribute("href"));
      });
    });
  } else {
    window.addEventListener("hashchange", render);
  }
  render();
})();
