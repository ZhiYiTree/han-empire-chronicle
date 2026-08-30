# -*- coding: utf-8 -*-
"""动效增强的配套样式：进度条、顶栏收缩、年份高亮、局部微交互、减少动效降级。"""
import io

CSS = "site/assets/css/main.css"
BLOCK = """

/* ==================================================================
   动效增强（2026-08-30）
   依赖：Lenis（平滑滚动）+ GSAP ScrollTrigger（滚动驱动）
   ================================================================== */

/* 顶部阅读进度条 */
.scroll-progress{position:fixed;top:0;left:0;right:0;height:2px;z-index:70;pointer-events:none;
  background:rgba(216,205,187,.06)}
.scroll-progress>i{display:block;height:100%;transform:scaleX(0);transform-origin:left center;
  background:linear-gradient(90deg,var(--jin),var(--zhu));
  box-shadow:0 0 12px rgba(184,59,43,.45)}

/* 顶栏：下滚后收缩变紧凑 */
.hud{transition:height .45s var(--ease),background .45s var(--ease)}
.hud.compact{height:48px;background:rgba(13,11,10,.94);backdrop-filter:blur(16px)}

/* 时间线：当前年份高亮 */
.tlx-year-side b,.tlx-year-side span{transition:color .5s var(--ease)}
.tlx-year.active .tlx-year-side b{color:#cba863;text-shadow:0 0 16px rgba(168,137,79,.32)}
.tlx-year.active .tlx-year-side span{color:var(--bo-dim)}

/* 时间线卡片：按下轻微下沉（用 .tlx-card 而非 .tlx-ev，避免与 GSAP 的 transform 打架） */
.tlx-card{transition:border-left-color .45s var(--ease),transform .45s var(--ease)}
.tlx-ev:active .tlx-card{transform:translateX(2px) scale(.996)}

/* 人物头像：hover 轻微上浮 + 投影 */
.p-portrait{transition:transform .6s var(--ease),box-shadow .6s var(--ease),border-color .6s var(--ease)}
.p-portrait:hover{transform:translateY(-3px);border-color:rgba(168,137,79,.5);
  box-shadow:0 12px 32px rgba(0,0,0,.55)}

/* 尊重系统「减少动效」偏好：关闭全部过渡，内容直接可见 */
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{
    animation-duration:.01ms !important;
    animation-iteration-count:1 !important;
    transition-duration:.01ms !important;
    scroll-behavior:auto !important;
  }
  .tlx-ev{opacity:1 !important;transform:none !important}
  .tlx-axis-fill{transform:scaleY(1) !important}
}
"""

with io.open(CSS, "a", encoding="utf-8") as f:
    f.write(BLOCK)

print("动效样式已追加（+%d 字）" % len(BLOCK))
print("CSS 现共 %d 字" % len(io.open(CSS, encoding="utf-8").read()))
