# -*- coding: utf-8 -*-
"""统一视觉：进度条融入 HUD、全站滚动条统一、检索面板增强、关系图换真实照片。"""
import io

CSS = "site/assets/css/main.css"
BLOCK = """

/* ==================================================================
   统一视觉（2026-08-30 晚）
   1 阅读进度融入 HUD 底边　2 滚动条统一　3 检索面板　4 关系图真实照片
   ================================================================== */

/* ---------- 1. 阅读进度：贴在 HUD 底边，与顶栏一体（不再悬浮于页面顶部） ---------- */
.scroll-progress{position:absolute;top:auto;bottom:0;left:0;right:0;height:2px;
  pointer-events:none;background:rgba(216,205,187,.05);overflow:hidden;z-index:2}
.scroll-progress>i{display:block;height:100%;transform:scaleX(0);transform-origin:left center;
  background:linear-gradient(90deg,var(--jin),var(--zhu));
  box-shadow:0 0 10px rgba(184,59,43,.5)}

/* ---------- 2. 滚动条：暗色细条，替换系统默认亮色粗条 ---------- */
*{scrollbar-width:thin;scrollbar-color:rgba(168,137,79,.4) transparent}
::-webkit-scrollbar{width:9px;height:9px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(168,137,79,.26);border-radius:99px;
  border:2px solid transparent;background-clip:content-box}
::-webkit-scrollbar-thumb:hover{background:rgba(184,59,43,.48);background-clip:content-box}
::-webkit-scrollbar-thumb:active{background:rgba(184,59,43,.68);background-clip:content-box}
::-webkit-scrollbar-corner{background:transparent}
/* 这些容器本就隐藏滚动条，保持隐藏 */
.hud-nav,.ct-cell,.chrono-eras,.rg-canvas-scroll{scrollbar-width:none}
.hud-nav::-webkit-scrollbar,.ct-cell::-webkit-scrollbar,
.chrono-eras::-webkit-scrollbar,.rg-canvas-scroll::-webkit-scrollbar{width:0;height:0}

/* ---------- 3. 检索面板 ---------- */
.palette-list{max-height:50vh;overflow-y:auto;padding:4px 0 8px}
/* 分组标题吸顶，长列表滚动时始终知道当前在哪一类 */
.pal-group{position:sticky;top:0;z-index:2;background:rgba(17,14,12,.97);
  backdrop-filter:blur(8px);padding:11px 18px 7px;border-bottom:1px solid rgba(216,205,187,.06)}
.pal-item{transition:background .2s var(--ease),border-left-color .2s var(--ease)}
.pal-item.on{background:rgba(184,59,43,.11)}
/* 底部状态条：结果数 + 快捷键 */
.palette-foot{display:flex;align-items:center;justify-content:space-between;gap:14px;
  padding:9px 18px;border-top:1px solid var(--line);
  font:10px/1 var(--mono);letter-spacing:.12em;color:var(--bo-faint)}
.palette-foot b{color:var(--jin);font-weight:400}
.palette-foot .pal-keys{opacity:.75}

/* ---------- 4. 关系图节点：优先真实照片，缺失时回落到群像裁切 ----------
   多层背景：照片在上层，加载失败时该层不绘制，自动露出下层的群像裁切。 */
.rg-portrait,.rg-dossier-avatar{
  background-image:var(--photo,none),var(--portrait);
  background-size:cover,360% auto;
  background-position:center 12%,var(--px) var(--py);
  background-repeat:no-repeat,no-repeat}
.rg-portrait{transition:box-shadow .45s var(--ease)}
.rg-node:hover .rg-portrait{
  box-shadow:0 0 0 3px #0b0908,0 0 0 6px rgba(168,137,79,.5),0 12px 30px rgba(0,0,0,.6)}
"""

with io.open(CSS, "a", encoding="utf-8") as f:
    f.write(BLOCK)

print("统一视觉样式已追加（+%d 字）" % len(BLOCK))
print("CSS 现共 %d 字" % len(io.open(CSS, encoding="utf-8").read()))
