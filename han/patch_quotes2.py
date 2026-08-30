# -*- coding: utf-8 -*-
"""
订正最后 7 条未核验引文（2026-08-30）
逐条对照已抓取的《史记》原文（content/shiji/*.txt），严格按原文录入，
去掉原先占位的括号推测与省略号，并把篇目订正到实际出处。
核验工具：query_shiji.py（关键词定位原文）
"""
import json, io

P = "content/data/events.json"

# id -> (book, section, quote)
PATCH = {
    "ev-mangdang": (
        "史记", "高祖本纪",
        "季所居上常有云气，故从往常得季。"
    ),
    "ev-yongchi": (
        "史记", "高祖本纪",
        "雍齿雅不欲属沛公，及魏招之，即反为魏守丰。沛公引兵攻丰，不能取。沛公病，还之沛。"
    ),
    "ev-tianheng": (
        "史记", "田儋列传",
        "横始与汉王俱南面称孤，今汉王为天子，而横乃为亡虏而北面事之，其耻固已甚矣……"
        "遂自刭，令客奉其头，从使者驰奏之高帝。……"
        "吾闻其余尚五百人在海中，使使召之。至则闻田横死，亦皆自杀。于是乃知田横兄弟能得士也。"
    ),
    # 原本标《高祖功臣侯者年表》，该篇为纯表格无可提取正文，
    # 改用《萧相国世家》记载封侯争议的原始段落（更贴合"军功封侯"主题）
    "ev-jungong-fenghou": (
        "史记", "萧相国世家",
        "汉五年，既杀项羽，定天下，论功行封。群臣争功，岁余功不决。高祖以萧何功最盛，封为酂侯，所食邑多。"
    ),
    "ev-chenxi": (
        "史记", "高祖本纪",
        "豨不南据邯郸而阻漳水，吾知其无能为也。"
    ),
    "ev-qingbu-fan": (
        "史记", "黥布列传",
        "遂西，与上兵遇蕲西，会甀。布兵精甚，上乃壁庸城，望布军置陈如项籍军，上恶之。"
        "与布相望见，遥谓布曰：「何苦而反？」布曰：「欲为帝耳。」"
    ),
    "ev-luwan-fan": (
        "史记", "韩信卢绾列传",
        "卢绾遂将其众亡入匈奴，匈奴以为东胡卢王。"
    ),
}


def main():
    ev = json.load(io.open(P, encoding="utf-8"))
    n = 0
    for e in ev:
        if e.get("id") in PATCH:
            book, sec, q = PATCH[e["id"]]
            shiji = e.get("shiji") or []
            if shiji:
                shiji[0]["book"] = book
                shiji[0]["section"] = sec
                shiji[0]["quote"] = q
                shiji[0]["verified"] = True
            else:
                e["shiji"] = [{"book": book, "section": sec, "quote": q, "verified": True}]
            n += 1
    json.dump(ev, io.open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # 复核
    tot = t = 0
    for e in ev:
        for s in (e.get("shiji") or []):
            tot += 1
            if s.get("verified"):
                t += 1
    print("已订正 %d 条" % n)
    print("史料引文：%d 条，已核 %d，未核 %d" % (tot, t, tot - t))


if __name__ == "__main__":
    main()
