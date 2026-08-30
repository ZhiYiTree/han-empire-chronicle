# -*- coding: utf-8 -*-
"""抓取百家讲坛《大风歌》王立群讲座逐字稿（45集），输出 Markdown 全集。"""
import re, ssl, time, urllib.request, html, os

BASE = "http://www.yinbs.com"
BOOK = 8876
TOTAL = 45
OUT = "大风歌-王立群-逐字稿全集.md"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
H = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def get(url, retry=4):
    for k in range(retry):
        try:
            req = urllib.request.Request(url, headers=H)
            return urllib.request.urlopen(req, timeout=30, context=ctx).read().decode("utf-8", "ignore")
        except Exception as e:
            if k == retry - 1:
                raise
            time.sleep(1.5 * (k + 1))


def clean(inner: str) -> str:
    """把正文 HTML 片段转成干净的 Markdown 段落。"""
    s = inner
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</p\s*>", "\n\n", s, flags=re.I)
    s = re.sub(r"<p[^>]*>", "", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    lines = []
    for ln in s.split("\n"):
        ln = ln.replace("\u3000", "").replace("\xa0", " ").strip()
        if ln:
            lines.append(ln)
    return "\n\n".join(lines)


def main():
    chapters = []
    for i in range(1, TOTAL + 1):
        url = f"{BASE}/{BOOK}_R{i}.html"
        page = get(url)
        m_title = re.search(r"<h1>(.*?)</h1>", page, re.S)
        m_body = re.search(r'<div id="content">(.*?)</div>', page, re.S)
        if not m_body:
            print(f"[!] 第{i}集 正文缺失")
            chapters.append((i, m_title.group(1).strip() if m_title else f"第{i}集", ""))
            continue
        title = m_title.group(1).strip() if m_title else f"第{i}集"
        body = clean(m_body.group(1))
        chapters.append((i, title, body))
        print(f"[ok] {i:>2}/45  {title}  ({len(body)}字)")
        time.sleep(0.6)

    # ---- 组装 Markdown ----
    toc = ["# 百家讲坛《大风歌》· 王立群讲高祖刘邦｜逐字稿全集\n",
           "> **主讲**：王立群（河南大学文学院教授、中国古典文献学博士生导师）  \n"
           "> **节目**：CCTV-10《百家讲坛》「王立群读《史记》」系列  \n"
           "> **首播**：2011年2月24日 ｜ **集数**：45 集（另有 48 集分法，本稿按讲座正文 45 集编排）  \n"
           "> **性质**：讲座口语逐字稿，保留「王立群：」「画外音：」原标记  \n"
           "> **整理日期**：2026-08-29\n",
           "---\n",
           "## 目录\n"]
    for i, t, b in chapters:
        name = re.sub(r"^第\d+章\s*", "", t)
        toc.append(f"- 第 {i:02d} 集　{name}")
    toc.append("\n---\n")

    parts = list(toc)
    for i, t, b in chapters:
        name = re.sub(r"^第\d+章\s*", "", t).rstrip("：:")
        parts.append(f"\n## 第 {i:02d} 集　{name}\n")
        if not b:
            parts.append("> （本集正文抓取失败，待补）\n")
            continue
        # 发言人标记做加粗处理
        body = re.sub(r"^(王立群|画外音|主持人)[：:]\s*$", r"**\1：**", b, flags=re.M)
        parts.append(body + "\n")

    md = "\n".join(parts)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(md)
    total = sum(len(b) for _, _, b in chapters)
    print(f"\n完成：{OUT}　共 {len(chapters)} 集，正文约 {total} 字")


if __name__ == "__main__":
    main()
