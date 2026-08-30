# -*- coding: utf-8 -*-
"""在已抓取的《史记》篇目中检索关键词，输出原文上下文。
用法：python query_shiji.py 关键词1 关键词2 ...
      python query_shiji.py -f keywords.txt
"""
import os, re, sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.abspath(__file__))
SJ = os.path.join(ROOT, "content", "shiji")
NAMES = {
    "gao-zu-ben-ji": "高祖本纪", "xiang-yu-ben-ji": "项羽本纪", "chen-she-shi-jia": "陈涉世家",
    "xiao-xiang-guo-shi-jia": "萧相国世家", "liu-hou-shi-jia": "留侯世家",
    "huai-yin-hou-lie-zhuan": "淮阴侯列传", "liu-jing-shu-sun-tong-lie-zhuan": "刘敬叔孙通列传",
    "wei-bao-peng-yue-lie-zhuan": "魏豹彭越列传", "qing-bu-lie-zhuan": "黥布列传",
    "fan-li-teng-guan-lie-zhuan": "樊郦滕灌列传", "ji-bu-luan-bu-lie-zhuan": "季布栾布列传",
    "tian-dan-lie-zhuan": "田儋列传", "han-xin-lu-wan-lie-zhuan": "韩信卢绾列传",
    "zhang-cheng-xiang-lie-zhuan": "张丞相列传", "xiong-nu-lie-zhuan": "匈奴列传",
}

CORPUS = {}
for f in sorted(os.listdir(SJ)):
    if f.endswith(".txt"):
        CORPUS[f[:-4]] = open(os.path.join(SJ, f), encoding="utf-8").read()


def search(kw, win=54, limit=2):
    hits = []
    for slug, body in CORPUS.items():
        idx, n = 0, 0
        while n < limit:
            i = body.find(kw, idx)
            if i < 0:
                break
            s = max(0, i - win // 2)
            hits.append((NAMES.get(slug, slug), body[s:i + win]))
            idx = i + len(kw)
            n += 1
    return hits


def main():
    args = sys.argv[1:]
    if args and args[0] == "-f":
        kws = [l.strip() for l in open(args[1], encoding="utf-8") if l.strip()]
    else:
        kws = args
    for kw in kws:
        hits = search(kw)
        print("\n■ " + kw + (f"　[{len(hits)} 处]" if hits else "　【未命中】"))
        for name, ctx in hits:
            print(f"   《{name}》…{ctx}…")


if __name__ == "__main__":
    main()
