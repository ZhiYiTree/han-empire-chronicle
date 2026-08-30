# -*- coding: utf-8 -*-
"""生成「人物照片接入清单」：告诉用户照片怎么命名、放哪、优先放谁。"""
import json, io, os

P = "content/data/persons.json"
OUT = "docs/人物照片清单.md"
IMGDIR = "site/assets/img/people"

persons = json.load(io.open(P, encoding="utf-8"))
os.makedirs(IMGDIR, exist_ok=True)
os.makedirs("docs", exist_ok=True)


def tier_key(x):
    return {"S": 0, "A": 1, "B": 2}.get(x.get("tier", "B"), 3)


rows = sorted(persons, key=lambda x: (tier_key(x), -x.get("episodeCount", 0)))
groups = {"S": [], "A": [], "B": []}
for x in rows:
    groups.setdefault(x.get("tier", "B"), []).append(x)

L = []
L.append("# 人物照片接入清单")
L.append("")
L.append("> 本文件说明：如何把人物照片放进《汉 · 帝国纪事》网站。")
L.append("> 数据版本：人物 %d 位（S 级 %d / A 级 %d / B 级 %d）" %
         (len(persons), len(groups["S"]), len(groups["A"]), len(groups["B"])))
L.append("")
L.append("## 怎么用（三步）")
L.append("")
L.append("1. 把照片**命名为「姓名.jpg」**，例如 `刘邦.jpg`、`项羽.jpg`。")
L.append("2. 放进目录 `han/site/assets/img/people/`。")
L.append("3. 刷新网页即可。")
L.append("")
L.append("**没放照片的人物不会开天窗**——会自动回落到「姓名首字 + 帛书纹样」的程序化头像，")
L.append("所以可以只给重要人物配图，其余慢慢补。")
L.append("")
L.append("## 规格建议")
L.append("")
L.append("| 项 | 建议 |")
L.append("| --- | --- |")
L.append("| 比例 | 竖版 3:4（页面容器 132×172，原图建议 ≥ 600×800） |")
L.append("| 格式 | `.jpg`（扩展名小写） |")
L.append("| 构图 | 人物上半身居中，头部位于画面上 1/3 处 |")
L.append("| 风格 | 画像、剧照、AI 生成图均可；页面已做轻微去饱和，暗色调素材更协调 |")
L.append("| 命名 | 必须与下表的「姓名」**完全一致**（含异体字，如 `黥布.jpg`） |")
L.append("")
L.append("> 注意：史书无真实肖像传世，任何配图都属于**示意性形象**。")
L.append("> 若使用 AI 生成或影视剧照，建议在页脚或 README 注明来源。")
L.append("")

L.append("## 照片接入统计")
L.append("")
jpg_names = set(os.path.splitext(f)[0] for f in os.listdir(IMGDIR) if f.lower().endswith((".jpg", ".jpeg")))
person_names = set(x["name"] for x in persons)
ok = sorted(jpg_names & person_names)
extra = sorted(jpg_names - person_names)
missing = sorted(person_names - jpg_names)
L.append("- 已传入人物照片：**%d / %d 位（%.1f%%）**" % (len(ok), len(persons), len(ok) / len(persons) * 100))
L.append("- 本次传入 %d 张：%s" % (len(jpg_names), "、".join(sorted(jpg_names))))
if extra:
    L.append("- 数据外照片（尚未录入网站人物数据）：%s" % "、".join(extra))
L.append("- 待补充：%d 位，集中在 B 级" % len(missing))
L.append("")

TITLES = {
    "S": ("S 级 · 核心六人（建议优先配图）", "这六位是全站主线人物，出现集数最多。"),
    "A": ("A 级 · 重要十四人（建议第二批）", "功臣、宗室与主要对手，人物页访问量次高。"),
    "B": ("B 级 · 其余人物（按需补充）", "多为单集提及者，可先留空，程序化头像已能保证版面完整。"),
}

for t in ("S", "A", "B"):
    g = groups[t]
    if not g:
        continue
    title, note = TITLES[t]
    L.append("## " + title)
    L.append("")
    L.append(note)
    L.append("")
    L.append("| 姓名 | 阵营 | 职能 | 出现集数 | 照片状态 | 文件 |")
    L.append("| --- | --- | --- | --- | --- | --- |")
    for x in g:
        name = x.get("name", "")
        has = os.path.exists(os.path.join(IMGDIR, name + ".jpg"))
        L.append("| %s | %s | %s | %d | %s | `%s.jpg` |" % (
            name,
            x.get("faction", "") or "—",
            x.get("role", "") or "—",
            x.get("episodeCount", 0),
            "✅ 已传入" if has else "—",
            name,
        ))
    L.append("")

L.append("## 已存在的图片（关系图用，勿删）")
L.append("")
existing = sorted(f for f in os.listdir(IMGDIR) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")))
if existing:
    for f in existing:
        L.append("- `%s`" % f)
else:
    L.append("- （暂无）")
L.append("")
L.append("> 这四张是关系图的人物群像裁切底图，与人物页照片是两套东西，别覆盖。")
L.append("")

io.open(OUT, "w", encoding="utf-8").write("\n".join(L))
print("已生成", OUT)
print("  人物 %d 位：S %d / A %d / B %d" % (len(persons), len(groups["S"]), len(groups["A"]), len(groups["B"])))
print("  图片目录已就绪:", IMGDIR)
print("  目录内现有图片:", existing if existing else "无")
