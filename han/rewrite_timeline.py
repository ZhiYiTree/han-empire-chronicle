# -*- coding: utf-8 -*-
"""
改造 1：纪年页重做为「单轴垂直时间线」（简洁 + 高级感）
改造 2：移除阵容 Roster 模块（视图 / 绑定 / 路由 / 导航 / 命令面板 / 返回入口）
用法：python rewrite_timeline.py
"""
import io, re, sys

APP = "site/assets/js/app.js"
src = io.open(APP, encoding="utf-8").read()

# ---------------------------------------------------------------- 新时间线代码
NEW_TIMELINE = r'''  /* ---------- 纪年 · 单轴时间线 ---------- */
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
    if (tlScroll) { window.removeEventListener("scroll", tlScroll); tlScroll = null; }
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

    /* 滚动入场：节点逐个点亮（IntersectionObserver，原生、无依赖） */
    var items = body.querySelectorAll(".tlx-ev");
    if ("IntersectionObserver" in window) {
      var ob = new IntersectionObserver(function (en) {
        en.forEach(function (x) {
          if (x.isIntersecting) { x.target.classList.add("in"); ob.unobserve(x.target); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      items.forEach(function (it) { ob.observe(it); });
    } else {
      items.forEach(function (it) { it.classList.add("in"); });
    }

    /* 轴线随滚动生长 */
    tlScroll = function () {
      if (!axis) return;
      var r = body.getBoundingClientRect();
      var p = (window.innerHeight * 0.45 - r.top) / r.height;
      axis.style.transform = "scaleY(" + Math.max(0, Math.min(1, p)) + ")";
    };
    tlScroll();
    window.addEventListener("scroll", tlScroll, { passive: true });
  }

'''

# ---------------------------------------------------------------- 执行替换
out = src

# 1) 时间线整块：tlEraForYear 开始 → 阵容注释之前
a = out.find("  function tlEraForYear(y) {")
b = out.find("  /* ---------- 阵容 Roster ---------- */")
if a < 0 or b < 0 or b < a:
    sys.exit("锚点定位失败：时间线区块 a=%s b=%s" % (a, b))
out = out[:a] + NEW_TIMELINE + out[b:]

# 2) 阵容整块：阵容注释 → 人物页注释（删除）
a = out.find("  /* ---------- 阵容 Roster ---------- */")
b = out.find("  /* ---------- 人物页 ---------- */")
if a < 0 or b < 0 or b < a:
    sys.exit("锚点定位失败：阵容区块 a=%s b=%s" % (a, b))
out = out[:a] + out[b:]

# 3) 引用点修正
reps = [
    # 路由
    ('    else if (r.name === "roster") html = viewRoster();\n', ""),
    # 绑定
    ("    bindRoster();\n", ""),
    # 六幕页的「按人物探索」改为「按关系探索」
    ('\'<span class="chip" data-goto="#/roster">按人物探索</span>\' +\n',
     '\'<span class="chip" data-goto="#/relations">按关系探索</span>\' +\n'),
    # 人物页返回入口
    ('\'<div class="back" data-goto="#/roster">返回阵容</div>\' +',
     '\'<div class="back" data-goto="#/acts">返回六幕</div>\' +'),
    # 命令面板
    ('        { t: "帝国阵容", s: "Roster", run: function () { go("#/roster"); } },\n', ""),
    # render 时清理滚动监听
    ("  function render() {\n    clearPageMotion();\n",
     "  function render() {\n    clearPageMotion();\n    clearTimelineScroll();\n"),
]
miss = []
for old, new in reps:
    if old in out:
        out = out.replace(old, new, 1)
    else:
        miss.append(old.strip()[:60])

io.open(APP, "w", encoding="utf-8").write(out)

print("改写完成：%s" % APP)
print("  原 %d 字 → 新 %d 字（净减 %d 字）" % (len(src), len(out), len(src) - len(out)))
if miss:
    print("  [未命中] 以下引用点需手工检查：")
    for m in miss:
        print("    -", m)
else:
    print("  全部引用点已修正")
