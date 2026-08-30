/* 冒烟测试：用最小 DOM 桩执行 app.js，遍历所有路由，确认渲染不抛错。
   用法：node smoke.js */
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "site", "assets", "js");

function El(tag) {
  this.tag = tag || "div";
  this._html = "";
  this.style = {};
  this.dataset = {};
  this.hidden = false;
  this.value = "";
  this.offsetWidth = 0;
  this._handlers = {};
  const self = this;
  this.classList = {
    _s: new Set(),
    add(c) { self.classList._s.add(c); },
    remove(c) { self.classList._s.delete(c); },
    toggle(c, f) { if (f === undefined) f = !self.classList._s.has(c); f ? self.classList._s.add(c) : self.classList._s.delete(c); },
    contains(c) { return self.classList._s.has(c); }
  };
}
Object.defineProperty(El.prototype, "innerHTML", {
  get() { return this._html; },
  set(v) { this._html = String(v); }
});
El.prototype.addEventListener = function (type, fn) {
  (this._handlers[type] = this._handlers[type] || []).push(fn);
};
El.prototype.removeEventListener = function (type, fn) {
  this._handlers[type] = (this._handlers[type] || []).filter(h => h !== fn);
};
El.prototype.fire = function (type, event) {
  const e = Object.assign({
    target: this, metaKey: false, ctrlKey: false, key: "",
    preventDefault() {}, stopPropagation() {}
  }, event || {});
  (this._handlers[type] || []).forEach(fn => fn(e));
};
El.prototype.querySelectorAll = function () { return []; };
El.prototype.querySelector = function () { return null; };
El.prototype.closest = function () { return null; };
El.prototype.scrollIntoView = function () {};
El.prototype.appendChild = function () {};
El.prototype.focus = function () {};

const registry = {};
function getEl(id) {
  if (!registry[id]) registry[id] = new El("div");
  return registry[id];
}
getEl("palette").hidden = true;

global.window = {
  addEventListener: function (t, f) { (global.__handlers[t] = global.__handlers[t] || []).push(f); },
  removeEventListener: function (t, f) { global.__handlers[t] = (global.__handlers[t] || []).filter(h => h !== f); },
  innerHeight: 900,
  scrollTo: function () {},
  HAN_DATA: null
};
global.__handlers = {};
global.document = {
  _handlers: {},
  getElementById: getEl,
  querySelector: function () { return new El("div"); },
  querySelectorAll: function () { return []; },
  addEventListener: function (type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); },
  fire: function (type, event) { (this._handlers[type] || []).forEach(fn => fn(event)); },
  createElement: function (t) { return new El(t); }
};
global.location = { hash: "#/" };
global.requestAnimationFrame = function (f) { f(); };

// 加载数据与应用
eval(fs.readFileSync(path.join(dir, "data.js"), "utf8"));
let err = null;
try {
  eval(fs.readFileSync(path.join(dir, "app.js"), "utf8"));
} catch (e) { err = e; }

if (err) {
  console.log("✗ app.js 初始化抛错：", err.message, "\n", err.stack.split("\n").slice(0, 4).join("\n"));
  process.exit(1);
}
console.log("✓ app.js 初始化通过");

const D = global.window.HAN_DATA;
console.log(`✓ 数据：人物 ${D.persons.length} / 事件 ${D.events.length} / 关系 ${D.relations.length} / 讲坛 ${D.lectures.length} / 史料 ${D.sources.length} / 特质组 ${D.traits.length}`);

// 命令面板开关回归：按钮打开、ESC 关闭、遮罩/关闭按钮关闭。
let paletteFail = 0;
const palette = getEl("palette");
getEl("btnSearch").fire("click");
if (palette.hidden) { paletteFail++; console.log("  ✗ 点击检索后面板没有打开"); }
global.document.fire("keydown", { key: "Escape", metaKey: false, ctrlKey: false, preventDefault() {} });
if (!palette.hidden) { paletteFail++; console.log("  ✗ 按 ESC 后面板没有关闭"); }
getEl("btnSearch").fire("click");
palette.fire("click", { target: { dataset: { close: "" } } });
if (!palette.hidden) { paletteFail++; console.log("  ✗ 点击关闭控件后面板没有关闭"); }
const css = fs.readFileSync(path.join(__dirname, "site", "assets", "css", "main.css"), "utf8");
if (!/\.palette-wrap\[hidden\]\s*\{\s*display\s*:\s*none/.test(css)) {
  paletteFail++; console.log("  ✗ CSS 没有强制隐藏带 hidden 属性的检索面板");
}
console.log(`检索面板开关｜${paletteFail === 0 ? "通过" : "失败 " + paletteFail + " 项"}`);

// 构造路由列表
const routes = ["", "#/acts"];
D.lectures.forEach(l => routes.push("#/lecture/" + l.episode));
D.events.forEach(e => routes.push("#/event/" + encodeURIComponent(e.id)));
D.persons.forEach(p => routes.push("#/person/" + encodeURIComponent(p.id)));
D.relations.forEach(r => routes.push("#/rel/" + encodeURIComponent(r.id)));
["起兵反秦", "楚汉战争", "开国建制", "功臣群像", "晚年危机", "人物总评"].forEach(u => routes.push("#/unit/" + encodeURIComponent(u)));
routes.push("#/timeline", "#/relations", "#/lectures", "#/traits", "#/sources");

const fire = global.__handlers["hashchange"] || [];
let fail = 0, empty = 0;
for (const r of routes) {
  try {
    global.location.hash = r || "#/";
    fire.forEach(f => f());
    const html = getEl("app").innerHTML;
    if (!html || html.length < 60) { empty++; console.log("  ⚠ 内容过短:", r || "#/", html.length); }
    if (/undefined|NaN|\[object Object\]/.test(html)) {
      const m = html.match(/.{0,40}(undefined|NaN|\[object Object\]).{0,40}/);
      fail++; console.log("  ✗ 渲染含异常值:", r, "→", m && m[0]);
    }
  } catch (e) {
    fail++;
    console.log("  ✗ 抛错:", r, "→", e.message);
    if (fail <= 3) console.log("     ", e.stack.split("\n").slice(1, 4).join("\n     "));
  }
}
console.log(`路由总数 ${routes.length}｜抛错 ${fail}｜内容过短 ${empty}`);

// 纪年 · 单轴时间线结构回归：轴线、年份分组、事件节点、筛选器
global.location.hash = "#/timeline";
fire.forEach(f => f());
const timelineHtml = getEl("app").innerHTML;
const datedEvents = D.events.filter(e => e.year != null);
let timelineFail = 0;
[
  [timelineHtml.includes("帝国纪年"), "缺少纪年主标题"],
  [timelineHtml.includes('class="tlx-body"'), "缺少时间线主体"],
  [timelineHtml.includes('class="tlx-axis-fill"'), "缺少随滚动生长的轴线"],
  [(timelineHtml.match(/class="tlx-year"/g) || []).length > 0, "缺少年份分组"],
  [(timelineHtml.match(/class="tlx-ev /g) || []).length === datedEvents.length,
    "事件节点数与已定年事件数不符（期望 " + datedEvents.length + "）"],
  [timelineHtml.includes('id="tlxFilter"') && timelineHtml.includes('id="tlxImp"'), "缺少人物/级别筛选器"],
  [datedEvents.every(e => timelineHtml.includes("#/event/" + encodeURIComponent(e.id))), "有已定年事件没有进入时间线"]
].forEach(([ok, message]) => { if (!ok) { timelineFail++; console.log("  ✗", message); } });
console.log(`单轴时间线结构｜${timelineFail === 0 ? "通过" : "失败 " + timelineFail + " 项"}`);

// 人物页头像回归：照片位 + 缺图兜底
global.location.hash = "#/person/" + encodeURIComponent(D.persons[0].id);
fire.forEach(f => f());
const personHtml = getEl("app").innerHTML;
let personFail = 0;
[
  [personHtml.includes('class="p-portrait'), "人物页缺少头像容器"],
  [personHtml.includes('class="p-photo"'), "人物页缺少照片元素"],
  [personHtml.includes('class="p-fallback"'), "人物页缺少缺图兜底头像"],
  [personHtml.includes("assets/img/people/"), "照片路径不正确"]
].forEach(([ok, message]) => { if (!ok) { personFail++; console.log("  ✗", message); } });
console.log(`人物页头像｜${personFail === 0 ? "通过" : "失败 " + personFail + " 项"}`);

// 数据完整性检查
let warn = 0;
function duplicateValues(rows, key) {
  const seen = new Set(), dup = new Set();
  rows.forEach(row => {
    const value = row[key];
    if (seen.has(value)) dup.add(value);
    seen.add(value);
  });
  return [...dup];
}

[
  ["人物", D.persons], ["事件", D.events], ["关系", D.relations],
  ["讲坛", D.lectures], ["史料", D.sources], ["特质", D.traits]
].forEach(([label, rows]) => {
  duplicateValues(rows, "id").forEach(id => {
    warn++; console.log(`  ✗ ${label}存在重复 ID:`, id);
  });
});
duplicateValues(D.persons, "name").forEach(name => {
  warn++; console.log("  ✗ 人物存在重复名称:", name);
});

const personNames = new Set(D.persons.map(p => p.name));
const eventIds = new Set(D.events.map(e => e.id));
const lectureEpisodes = new Set(D.lectures.map(l => l.episode));
D.events.forEach(e => {
  if (!e.summary) { warn++; console.log("  ⚠ 事件缺 summary:", e.id); }
  if (!e.lectureEpisodes || !e.lectureEpisodes.length) { warn++; console.log("  ⚠ 事件未关联集数:", e.id); }
  (e.people || []).forEach(name => {
    if (!personNames.has(name)) { warn++; console.log("  ✗ 事件引用了不存在的人物:", e.id, name); }
  });
  (e.lectureEpisodes || []).forEach(episode => {
    if (!lectureEpisodes.has(episode)) { warn++; console.log("  ✗ 事件引用了不存在的讲坛集:", e.id, episode); }
  });
});
D.relations.forEach(r => {
  [r.a, r.b].forEach(name => {
    if (!personNames.has(name)) { warn++; console.log("  ✗ 关系引用了不存在的人物:", r.id, name); }
  });
  r.phases.forEach(p => {
    (p.events || []).forEach(eid => {
      if (!eventIds.has(eid)) { warn++; console.log("  ✗ 关系引用了不存在的事件:", r.id, eid); }
    });
  });
});
const S = D.events.filter(e => e.importance === "S").length;
const withShiji = D.events.filter(e => (e.shiji || []).length).length;
console.log(`S 级事件 ${S}｜含史书原文的 event ${withShiji}｜数据告警 ${warn}`);
console.log(fail === 0 && warn === 0 && paletteFail === 0 && timelineFail === 0 && personFail === 0 ? "\n✔ 冒烟通过" : "\n⚠ 存在问题，见上");
if (fail || warn || paletteFail || timelineFail || personFail) process.exit(1);
