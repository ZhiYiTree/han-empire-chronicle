# -*- coding: utf-8 -*-
"""
打包「史料原文层」并生成与百家讲坛的双向串联：

  讲座集 → 相关史料篇章     （lecMap）
  史料篇章 → 相关讲座集     （chapterMap）

串联依据（全部由已有数据推导，不人工臆断）：
  《史记》     通过事件的「史书层」引文反查，引文出自哪篇就关联哪篇
  《资治通鉴》 通过事件年份落入哪一卷的纪年范围来关联

输出：site/assets/js/yuanshi.js  →  window.HAN_YUANSHI
"""
import io, json, os

META = "content/yuanshi-meta.json"
EVENTS = "content/data/events.json"
OUT = "site/assets/js/yuanshi.js"

# 资治通鉴卷次覆盖的年份（公元前，用负数表示）
ZIZHI_RANGES = [
    (7, -209, -207), (8, -207, -206), (9, -206, -205),
    (10, -204, -203), (11, -202, -200), (12, -199, -195),
]


def zizhi_of_year(y):
    if y is None:
        return None
    for juan, lo, hi in ZIZHI_RANGES:
        if lo <= y <= hi:
            return "zizhi-juan%03d" % juan
    return None


def main():
    meta = json.load(io.open(META, encoding="utf-8"))
    events = json.load(io.open(EVENTS, encoding="utf-8"))

    # ---- 篇章正文 ----
    chapters = []
    for group in ("shiji", "zizhi"):
        for m in meta[group]:
            txt = io.open(m["path"], encoding="utf-8").read()
            # 过滤掉维基文库页脚的版权声明
            paras = []
            for line in txt.split("\n"):
                s = line.strip()
                if len(s) < 5:
                    continue
                if s.startswith("本作品原文") or s.startswith("另请参见") \
                        or s.startswith("Public domain") or s.startswith("此作品在全世界"):
                    continue
                paras.append(s)
            chapters.append({
                "id": m["id"],
                "book": m["book"],
                "juan": m["juan"],
                "title": m["title"],
                "span": m.get("span", ""),
                "chars": m["chars"],
                "paras": paras,
            })

    # ---- 史记：(书名, 篇名) → 篇章 id ----
    sec_index = {}
    for c in chapters:
        if c["book"] == "史记":
            sec_index[("史记", c["title"])] = c["id"]

    # ---- 讲座集 → 史料篇章（带命中次数） ----
    lec_hits = {}
    for e in events:
        hits = {}
        for s in (e.get("shiji") or []):
            cid = sec_index.get((s.get("book"), s.get("section")))
            if cid:
                hits[cid] = hits.get(cid, 0) + 1
        cid = zizhi_of_year(e.get("year"))
        if cid:
            hits[cid] = hits.get(cid, 0) + 1
        if not hits:
            continue
        for ep in (e.get("lectureEpisodes") or []):
            k = str(ep)
            lec_hits.setdefault(k, {})
            for c, n in hits.items():
                lec_hits[k][c] = lec_hits[k].get(c, 0) + n

    lec_map = {}
    for k, v in lec_hits.items():
        lec_map[k] = [c for c, _ in sorted(v.items(), key=lambda x: -x[1])]

    # ---- 史料篇章 → 讲座集 ----
    chapter_map = {}
    for k, arr in lec_map.items():
        for cid in arr:
            chapter_map.setdefault(cid, []).append(int(k))
    for k in chapter_map:
        chapter_map[k].sort()

    payload = {
        "chapters": chapters,
        "lecMap": lec_map,
        "chapterMap": chapter_map,
    }
    os.makedirs("site/assets/js", exist_ok=True)
    io.open(OUT, "w", encoding="utf-8").write(
        "window.HAN_YUANSHI = " + json.dumps(payload, ensure_ascii=False) + ";")

    size = os.path.getsize(OUT)
    print("已生成 %s（%.0f KB）" % (OUT, size / 1024.0))
    print("  篇章 %d 篇（史记 %d / 资治通鉴 %d）" % (
        len(chapters),
        sum(1 for c in chapters if c["book"] == "史记"),
        sum(1 for c in chapters if c["book"] == "资治通鉴")))
    print("  讲座→史料 覆盖 %d 集" % len(lec_map))
    print("  史料→讲座 覆盖 %d 篇" % len(chapter_map))
    no_src = [i for i in range(1, 46) if str(i) not in lec_map]
    if no_src:
        print("  未关联到史料的集：", no_src)


if __name__ == "__main__":
    main()
