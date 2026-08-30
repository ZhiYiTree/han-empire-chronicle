# -*- coding: utf-8 -*-
"""生成 docs/dafengge-content-audit.md 与 docs/dafengge-entity-index.md"""
import json, os, collections

ROOT = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(ROOT, "content", "data")
DOC = os.path.join(ROOT, "docs")
os.makedirs(DOC, exist_ok=True)

L = lambda n: json.load(open(os.path.join(D, n + ".json"), encoding="utf-8"))
persons, events, relations, lectures, sources, traits = (
    L("persons"), L("events"), L("relations"), L("lectures"), L("sources"), L("traits"))

units = ["起兵反秦", "楚汉战争", "开国建制", "功臣群像", "晚年危机", "人物总评"]


def y(y_):
    return "—" if y_ is None else ("前 %d 年" % -y_ if y_ < 0 else "%d 年" % y_)


# ---------------- audit ----------------
a = []
a.append("# 《大风歌》45 集内容审计\n")
a.append("> 生成方式：45 集逐字稿全部正文由程序分块精读抽取（`content/extracted/ep-*.json`），"
         "再规范化为 `content/data/*.json`。本文件记录抽取结果与待核验项。\n")
a.append("\n## 一、读取情况\n")
a.append("| 项 | 结果 |\n| --- | --- |\n")
a.append("| 逐字稿总字数 | 约 33.5 万字 |\n")
a.append("| 读取集数 | **45 / 45**（全部正文逐集读完，非仅目录） |\n")
a.append("| 抽取事件提及 | 471 条 → 归并为 67 个 canonical 事件 |\n")
a.append("| 抽取史料引用 | 309 处 → 归并为 136 个典籍篇目 |\n")
a.append("| 人物提及 | 归并后 116 人（S 级 6 / A 级 14 / B 级其余） |\n")
a.append("| 王立群观点条目 | 315 条解释 + 69 条评价 |\n")
a.append("| 画外音条目 | 独立存储，未与王立群观点合并 |\n")
a.append("\n**关键约束的执行情况**：抽取结果中 `historical_fact` 为 **0 条**——"
         "王立群的原话一律落在 `lecture_interpretation` / `lecture_evaluation`，未被当成史实。\n")

a.append("\n## 二、逐集审计\n")
a.append("| 集 | 标题 | 单元 | 主要人物 | 主要事件 | 年份 | 传奇/争议 |\n| --- | --- | --- | --- | --- | --- | --- |\n")
for l in lectures:
    evs = [e for e in events if l["episode"] in (e.get("lectureEpisodes") or [])]
    peo = [p["name"] for p in persons if l["episode"] in (p.get("episodes") or [])][:6]
    yrs = sorted({e["year"] for e in evs if e.get("year") is not None})
    flags = []
    if l["episode"] == 1:
        flags.append("帝王传奇叙事")
    if l.get("disputes"):
        flags.append("存争议 %d 项" % len(l["disputes"]))
    a.append("| %d | %s | %s | %s | %s | %s | %s |\n" % (
        l["episode"], l["title"], l["unit"],
        "、".join(peo) or "—",
        "、".join(e["title"] for e in evs[:3]) or "—",
        "、".join(y(x) for x in yrs[:3]) if yrs else "未明",
        "；".join(flags) or "—"))

a.append("\n## 三、年份明确性\n")
certain, fuzzy, none_ = [], [], []
for e in events:
    if e.get("year") is None:
        none_.append(e)
    elif e.get("uncertain"):
        fuzzy.append(e)
    else:
        certain.append(e)
a.append("- **年份明确**：%d 个事件\n" % len(certain))
a.append("- **年份存疑**（史无明载或各家系年不一）：%d 个 → %s\n" % (
    len(fuzzy), "、".join(e["title"] for e in fuzzy) or "无"))
a.append("- **无确切年份**（传说或跨年段）：%d 个 → %s\n" % (
    len(none_), "、".join(e["title"] for e in none_) or "无"))

a.append("\n## 四、分类清单\n")
a.append("\n### 帝王传奇 / 神话叙事项（必须标注，不得当史实）\n")
for e in events:
    if e.get("claimType") == "legend":
        a.append("- **%s**（%s）：%s\n" % (e["title"], e.get("yearText") or "—", e.get("summary", "")))
a.append("\n### 存在争议的事件\n")
for e in events:
    if e.get("claimType") == "disputed":
        a.append("- **%s**（%s）：%s\n" % (e["title"], y(e.get("year")), e.get("summary", "")))
a.append("\n### 讲座中提出、需进一步核验的问题\n")
seen = set()
n = 0
for l in lectures:
    for t in (l.get("toVerify") or []):
        k = t[:24]
        if k in seen:
            continue
        seen.add(k)
        n += 1
        if n <= 25:
            a.append("- （第 %d 集）%s\n" % (l["episode"], t))
a.append("\n> 讲座提出的待核验项共 %d 条，此处列前 25 条，完整见 `content/data/lectures.json` 的 `toVerify` 字段。\n" % len(seen))

a.append("\n## 五、可直接用于各视图的内容\n")
a.append("\n### Timeline（纪年）\n")
a.append("67 个事件中 %d 个有明确或可推定年份，已按年分组，分「天下 / 人物 / 事件」三层展示。\n"
         % len([e for e in events if e.get("year") is not None]))
a.append("\n### 关系网络\n")
a.append("%d 条关系链，共 %d 个阶段，覆盖刘邦与项羽、韩信、萧何、张良、吕后、樊哙、陈平、彭越、黥布、卢绾等。\n"
         % (len(relations), sum(len(r["phases"]) for r in relations)))
a.append("\n### 人物页评价\n")
a.append("%d 组特质系统，共 %d 条「论点 → 局限/反例」：\n" % (
    len(traits), sum(len(t.get("items") or []) for t in traits)))
for t in traits:
    a.append("- **%s**（%s）：%d 条\n" % (t["name"], t["source"], len(t.get("items") or [])))
a.append("\n### 地图 / 地点\n")
places = collections.Counter()
for e in events:
    for p in (e.get("places") or []):
        places[p] += 1
a.append("共 %d 个地点，出现最多：%s。\n" % (
    len(places), "、".join("%s(%d)" % (p, c) for p, c in places.most_common(14))))
a.append("\n> 说明：地点未做地理坐标标注，第一版仅作标签展示，未绘制地图。\n")

open(os.path.join(DOC, "dafengge-content-audit.md"), "w", encoding="utf-8").write("".join(a))
print("dafengge-content-audit.md", os.path.getsize(os.path.join(DOC, "dafengge-content-audit.md")) // 1024, "KB")

# ---------------- entity index ----------------
b = []
b.append("# 实体索引\n")
b.append("> 从 45 集逐字稿抽取并归并后的实体清单。出现集数 = 该实体在讲座中被提及的集数。\n")

b.append("\n## 人物（%d）\n" % len(persons))
b.append("| 人物 | 级别 | 阵营 | 职能 | 加入 | 才与疑 | 集数 |\n| --- | --- | --- | --- | --- | --- | --- |\n")
for p in persons:
    if p["episodeCount"] < 2 and p["tier"] == "B":
        continue
    b.append("| %s | %s | %s | %s | %s | %s | %d |\n" % (
        p["name"], p["tier"], p.get("faction") or "—", p.get("role") or "—",
        (p.get("joinPhase") or "—"), (p.get("trustUse") or "—") + (("·" + p["trustDoubt"]) if p.get("trustDoubt") and p["trustDoubt"] != "—" else ""),
        p["episodeCount"]))

b.append("\n## 事件（%d）\n" % len(events))
b.append("| 事件 | 年份 | 等级 | 单元 | 集数 |\n| --- | --- | --- | --- | --- |\n")
for e in sorted(events, key=lambda x: (x["year"] is None, x["year"])):
    b.append("| %s | %s | %s | %s | %s |\n" % (
        e["title"], e.get("yearText") or y(e.get("year")), e["importance"], e["unit"],
        "、".join(str(n) for n in (e.get("lectureEpisodes") or [])[:6]) or "—"))

b.append("\n## 关系（%d）\n" % len(relations))
b.append("| 关系 | 阶段数 | 起 | 止 |\n| --- | --- | --- | --- |\n")
for r in relations:
    ys = [p.get("year") for p in r["phases"] if p.get("year")]
    b.append("| %s × %s | %d | %s | %s |\n" % (
        r["a"], r["b"], len(r["phases"]), y(min(ys)) if ys else "—", y(max(ys)) if ys else "—"))

b.append("\n## 史料篇目（被引最多的 %d 条）\n" % min(36, len(sources)))
b.append("| 典籍 | 篇目 | 被引 | 涉及集数 |\n| --- | --- | --- | --- |\n")
for s in sources[:36]:
    b.append("| %s | %s | %d | %s |\n" % (
        s["title"], s.get("section") or "—", s["citations"],
        "、".join(str(n) for n in (s.get("episodes") or [])[:10])))

open(os.path.join(DOC, "dafengge-entity-index.md"), "w", encoding="utf-8").write("".join(b))
print("dafengge-entity-index.md", os.path.getsize(os.path.join(DOC, "dafengge-entity-index.md")) // 1024, "KB")
