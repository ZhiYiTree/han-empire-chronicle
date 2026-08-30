# -*- coding: utf-8 -*-
"""
抓取「史料原文层」：
  《史记》   刘邦相关篇目 20 篇  → content/shiji/{slug}.txt
  《资治通鉴》秦末汉初卷 7—12   → content/zizhi/juan{no}.txt

来源：维基文库（zh.wikisource.org），开放授权、简体、分段清晰。
用途：网站内供阅读与对照，讲座仍是主线，史料为延伸补充。
"""
import io, os, re, ssl, time, json, urllib.parse, urllib.request
from opencc import OpenCC

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}
CC = OpenCC("t2s")

# (卷号, 篇名, 文件 slug)
SHIJI = [
    ("007", "项羽本纪", "xiang-yu-ben-ji"),
    ("008", "高祖本纪", "gao-zu-ben-ji"),
    ("009", "吕太后本纪", "lv-tai-hou-ben-ji"),
    ("048", "陈涉世家", "chen-she-shi-jia"),
    ("053", "萧相国世家", "xiao-xiang-guo-shi-jia"),
    ("054", "曹相国世家", "cao-xiang-guo-shi-jia"),
    ("055", "留侯世家", "liu-hou-shi-jia"),
    ("056", "陈丞相世家", "chen-cheng-xiang-shi-jia"),
    ("057", "绛侯周勃世家", "jiang-hou-zhou-bo-shi-jia"),
    ("090", "魏豹彭越列传", "wei-bao-peng-yue-lie-zhuan"),
    ("091", "黥布列传", "qing-bu-lie-zhuan"),
    ("092", "淮阴侯列传", "huai-yin-hou-lie-zhuan"),
    ("093", "韩信卢绾列传", "han-xin-lu-wan-lie-zhuan"),
    ("094", "田儋列传", "tian-dan-lie-zhuan"),
    ("095", "樊郦滕灌列传", "fan-li-teng-guan-lie-zhuan"),
    ("096", "张丞相列传", "zhang-cheng-xiang-lie-zhuan"),
    ("097", "郦生陆贾列传", "li-sheng-lu-jia-lie-zhuan"),
    ("099", "刘敬叔孙通列传", "liu-jing-shu-sun-tong-lie-zhuan"),
    ("100", "季布栾布列传", "ji-bu-luan-bu-lie-zhuan"),
    ("110", "匈奴列传", "xiong-nu-lie-zhuan"),
]

# (卷号, 纪名, 覆盖年份)
ZIZHI = [
    ("007", "秦纪二", "前 209 — 前 207"),
    ("008", "秦纪三", "前 207 — 前 206"),
    ("009", "汉纪一", "前 206 — 前 205"),
    ("010", "汉纪二", "前 204 — 前 203"),
    ("011", "汉纪三", "前 202 — 前 200"),
    ("012", "汉纪四", "前 199 — 前 195"),
]

MIN_KEEP = 800   # 少于此字数视为抓取失败


def fetch_page(title):
    """抓取维基文库页面，返回清理后的简体正文。"""
    url = "https://zh.wikisource.org/wiki/" + urllib.parse.quote(title)
    raw = urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=40, context=CTX).read()
    html = raw.decode("utf-8", "ignore")
    m = re.search(r'<div class="mw-parser-output">(.*?)<div class="printfooter"', html, re.S)
    body = m.group(1) if m else html
    paras = re.findall(r"<p>(.*?)</p>", body, re.S)
    out = []
    for p in paras:
        s = re.sub(r"<[^>]+>", "", p)
        s = re.sub(r"\[\d+\]", "", s)
        s = re.sub(r"&nbsp;?", " ", s)
        s = CC.convert(s).strip()
        if len(s) > 4:
            out.append(s)
    return "\n".join(out)


def main():
    os.makedirs("content/shiji", exist_ok=True)
    os.makedirs("content/zizhi", exist_ok=True)
    meta = {"shiji": [], "zizhi": []}
    ok = fail = 0

    print("=" * 56)
    print("《史记》篇目")
    print("=" * 56)
    for juan, name, slug in SHIJI:
        title = "史記/卷" + juan
        try:
            txt = fetch_page(title)
        except Exception as e:
            print("  ✗ %-16s %s" % (name, type(e).__name__))
            fail += 1
            continue
        if len(txt) < MIN_KEEP:
            print("  ✗ %-16s 内容过短(%d)，跳过" % (name, len(txt)))
            fail += 1
            continue
        path = "content/shiji/%s.txt" % slug
        io.open(path, "w", encoding="utf-8").write(txt)
        meta["shiji"].append({
            "id": "shiji-" + slug, "book": "史记", "juan": juan,
            "title": name, "slug": slug, "path": path, "chars": len(txt),
        })
        print("  ✓ %-16s 卷%-4s %6d 字" % (name, juan, len(txt)))
        ok += 1
        time.sleep(0.3)

    print()
    print("=" * 56)
    print("《资治通鉴》卷次")
    print("=" * 56)
    for juan, ji, span in ZIZHI:
        title = "資治通鑑/卷" + juan
        try:
            txt = fetch_page(title)
        except Exception as e:
            print("  ✗ %-10s %s" % (ji, type(e).__name__))
            fail += 1
            continue
        if len(txt) < MIN_KEEP:
            print("  ✗ %-10s 内容过短(%d)，跳过" % (ji, len(txt)))
            fail += 1
            continue
        path = "content/zizhi/juan%s.txt" % juan
        io.open(path, "w", encoding="utf-8").write(txt)
        meta["zizhi"].append({
            "id": "zizhi-juan" + juan, "book": "资治通鉴", "juan": juan,
            "title": ji, "slug": "juan" + juan, "span": span,
            "path": path, "chars": len(txt),
        })
        print("  ✓ %-10s 卷%-4s %6d 字  %s" % (ji, juan, len(txt), span))
        ok += 1
        time.sleep(0.3)

    io.open("content/yuanshi-meta.json", "w", encoding="utf-8").write(
        json.dumps(meta, ensure_ascii=False, indent=1))

    total = sum(x["chars"] for x in meta["shiji"]) + sum(x["chars"] for x in meta["zizhi"])
    print()
    print("完成：成功 %d / 失败 %d" % (ok, fail))
    print("《史记》%d 篇 %d 字　《资治通鉴》%d 卷 %d 字" % (
        len(meta["shiji"]), sum(x["chars"] for x in meta["shiji"]),
        len(meta["zizhi"]), sum(x["chars"] for x in meta["zizhi"])))
    print("合计 %d 字" % total)


if __name__ == "__main__":
    main()
