# -*- coding: utf-8 -*-
"""逐条核对 events_content.py 中的史书引文。

规则：
- 引文先去掉（某某曰：）之类括号前缀，再按「……」拆成若干片段，逐段核对
- 规范化：去标点；於→于（古今字差异）
- 输出：每段 PASS / FAIL，FAIL 时给出原文中应当采用的写法
"""
import os, re, sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import events_content as EC

ROOT = os.path.dirname(os.path.abspath(__file__))
SJ = os.path.join(ROOT, "content", "shiji")

SEC2FILE = {
    "高祖本纪": "gao-zu-ben-ji", "项羽本纪": "xiang-yu-ben-ji", "陈涉世家": "chen-she-shi-jia",
    "萧相国世家": "xiao-xiang-guo-shi-jia", "留侯世家": "liu-hou-shi-jia",
    "淮阴侯列传": "huai-yin-hou-lie-zhuan", "刘敬叔孙通列传": "liu-jing-shu-sun-tong-lie-zhuan",
    "魏豹彭越列传": "wei-bao-peng-yue-lie-zhuan", "黥布列传": "qing-bu-lie-zhuan",
    "樊郦滕灌列传": "fan-li-teng-guan-lie-zhuan", "季布栾布列传": "ji-bu-luan-bu-lie-zhuan",
    "田儋列传": "tian-dan-lie-zhuan", "韩信卢绾列传": "han-xin-lu-wan-lie-zhuan",
    "张丞相列传": "zhang-cheng-xiang-lie-zhuan", "匈奴列传": "xiong-nu-lie-zhuan",
}
PUNC = re.compile(r"[，。！？；：、（）「」『』《》〈〉\"'“”‘’·　 \n0-9a-zA-Z\[\]]")
PAREN = re.compile(r"[（(][^）)]*[）)]")

CACHE = {}


def norm(s):
    s = PUNC.sub("", s or "")
    return s.replace("於", "于").replace("饥", "饥")


def load(sec):
    slug = SEC2FILE.get(sec)
    if not slug:
        return None
    if slug not in CACHE:
        fp = os.path.join(SJ, slug + ".txt")
        CACHE[slug] = open(fp, encoding="utf-8").read() if os.path.exists(fp) else ""
    return CACHE[slug]


def segs_of(quote):
    q = PAREN.sub("", quote or "")
    parts = [p.strip() for p in re.split(r"……|\.\.\.\.", q) if p.strip()]
    return parts or ([q.strip()] if q.strip() else [])


def check(sec, quote):
    body = load(sec)
    if body is None:
        return "NOFILE", []
    nb = norm(body)
    res = []
    for seg in segs_of(quote):
        nq = norm(seg)
        if not nq:
            continue
        if nb.find(nq) >= 0:
            res.append((True, seg, ""))
        else:
            # 用前 8 字定位原文
            head = nq[:8]
            j = nb.find(head)
            if j >= 0:
                s = max(0, j - 20)
                res.append((False, seg, body[s:s + 90]))
            else:
                res.append((False, seg, ""))
    return "OK", res


def main():
    verified_total = ok = bad = pending = 0
    report = []
    for eid, c in EC.CONTENT.items():
        for s in (c.get("shiji") or []):
            if not s.get("verified"):
                pending += 1
                report.append(("PENDING", eid, s, []))
                continue
            verified_total += 1
            st, res = check(s.get("section", ""), s.get("quote", ""))
            if st == "NOFILE":
                report.append(("NOFILE", eid, s, []))
                bad += 1
                continue
            fails = [r for r in res if not r[0]]
            if fails:
                bad += 1
                report.append(("FAIL", eid, s, fails))
            else:
                ok += 1
                report.append(("PASS", eid, s, []))

    print(f"已核引文 {verified_total}｜全部片段吻合 {ok}｜存在问题 {bad}｜待核引文 {pending}\n")
    print("=" * 24 + " 需订正 " + "=" * 24)
    for st, eid, s, fails in report:
        if st != "FAIL":
            continue
        print(f"\n[{eid}] {s.get('book')}·{s.get('section')}")
        print(f"  现引文：{s.get('quote')}")
        for good, seg, ctx in fails:
            print(f"  ✗ 片段：{seg}")
            print(f"    原文：{ctx or '（未能在该篇找到）'}")
    print("\n" + "=" * 24 + " 缺原文文件 " + "=" * 24)
    for st, eid, s, _ in report:
        if st == "NOFILE":
            print(f"  [{eid}] {s.get('book')}·{s.get('section')}")
    print("\n" + "=" * 24 + " 待逐字核对 " + "=" * 24)
    for st, eid, s, _ in report:
        if st == "PENDING":
            print(f"  [{eid}] {s.get('book')}·{s.get('section')}")

    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
