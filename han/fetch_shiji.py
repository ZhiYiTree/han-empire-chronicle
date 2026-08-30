# -*- coding: utf-8 -*-
"""抓取《史记》相关篇目（中国哲学书电子化计划 ctext.org），繁转简后存为 content/shiji/*.txt"""
import urllib.request, ssl, re, os, time

try:
    from opencc import OpenCC
    CC = OpenCC("t2s")
except Exception:
    CC = None

ROOT = os.path.dirname(os.path.abspath(__file__))
OUTD = os.path.join(ROOT, "content", "shiji")
os.makedirs(OUTD, exist_ok=True)

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}

# slug -> 篇名
BOOKS = {
    "gao-zu-ben-ji": "高祖本纪",
    "xiang-yu-ben-ji": "项羽本纪",
    "chen-she-shi-jia": "陈涉世家",
    "xiao-xiang-guo-shi-jia": "萧相国世家",
    "liu-hou-shi-jia": "留侯世家",
    "huai-yin-hou-lie-zhuan": "淮阴侯列传",
    "liu-jing-shu-sun-tong-lie-zhuan": "刘敬叔孙通列传",
    "wei-bao-peng-yue-lie-zhuan": "魏豹彭越列传",
    "qing-bu-lie-zhuan": "黥布列传",
    "fan-li-teng-guan-lie-zhuan": "樊郦滕灌列传",
    "ji-bu-luan-bu-lie-zhuan": "季布栾布列传",
    "tian-dan-lie-zhuan": "田儋列传",
    "han-xin-lu-wan-lie-zhuan": "韩信卢绾列传",
    "zhang-cheng-xiang-lie-zhuan": "张丞相列传",
    "xiong-nu-lie-zhuan": "匈奴列传",
    "xiang-yu-ben-ji": "项羽本纪",
}


def fetch(slug):
    url = f"https://ctext.org/shiji/{slug}/zh"
    raw = urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=40, context=ctx).read()
    t = raw.decode("utf-8", "ignore")
    paras = re.findall(r'<td class="ctext"[^>]*>(.*?)</td>', t, re.S)
    if not paras:
        paras = re.findall(r'<div class="ctext"[^>]*>(.*?)</div>', t, re.S)
    txt = []
    for p in paras:
        s = re.sub(r"<[^>]+>", "", p)
        s = s.replace("&nbsp;", " ").replace("&amp;", "&")
        s = re.sub(r"\s+", "", s)
        if s:
            txt.append(s)
    body = "\n".join(txt)
    if CC:
        body = CC.convert(body)
    return body


def main():
    for slug, name in BOOKS.items():
        fp = os.path.join(OUTD, slug + ".txt")
        if os.path.exists(fp) and os.path.getsize(fp) > 3000:
            print(f"[skip] {name}  已存在 {os.path.getsize(fp)//1024} KB")
            continue
        try:
            b = fetch(slug)
            open(fp, "w", encoding="utf-8").write(b)
            print(f"[ok]   {name:<12} {len(b):>7} 字  -> {slug}.txt")
        except Exception as e:
            print(f"[ERR]  {name:<12} {type(e).__name__} {getattr(e,'code',e)}")
        time.sleep(1.2)


if __name__ == "__main__":
    main()
