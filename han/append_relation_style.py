# -*- coding: utf-8 -*-
"""关系网重构的配套样式：星图画布、分组着色连线、悬停聚焦、关系说明条。
同时把节点头像回退为统一的群像裁切。"""
import io

CSS = "site/assets/css/main.css"
BLOCK = """

/* ==================================================================
   关系网重构（2026-08-30 晚）
   让「关系的交织」真正看得见：连线成网 / 分组着色 / 悬停聚焦 / 关系读解
   ================================================================== */

/* ---------- 节点头像：回退为统一的群像裁切 ---------- */
.rg-portrait,.rg-dossier-avatar{
  background-image:var(--portrait);
  background-size:360% auto;
  background-position:var(--px) var(--py);
  background-repeat:no-repeat;
}

/* ---------- 画布：星图氛围（三处势力各自的光晕 + 细网格棋局） ---------- */
.rg-canvas{
  background:
    radial-gradient(circle at 49% 51%,rgba(168,137,79,.10),transparent 44%),
    radial-gradient(circle at 76% 28%,rgba(184,59,43,.06),transparent 38%),
    radial-gradient(circle at 88% 42%,rgba(141,129,137,.055),transparent 34%),
    #0b0908;
}
.rg-canvas::before{
  background-image:
    linear-gradient(rgba(216,205,187,.028) 1px,transparent 1px),
    linear-gradient(90deg,rgba(216,205,187,.028) 1px,transparent 1px);
  background-size:52px 52px;
}

/* ---------- 连线：按分组着色，区分亲疏与敌友 ---------- */
.rg-line{stroke-width:1.4;opacity:.62}
.rg-line.core{stroke:rgba(168,137,79,.54)}
.rg-line.ally{stroke:rgba(111,154,163,.48)}
.rg-line.rival{stroke:rgba(184,59,43,.52);stroke-dasharray:2.4 1.8}
.rg-line.kin{stroke:rgba(141,129,137,.48)}
/* 横向关系：更细的虚线，由 GSAP 缓慢流动 */
.rg-line.secondary{stroke-width:1;opacity:.52;stroke-dasharray:3 2.6}

/* ---------- 悬停聚焦：相关高亮，无关淡出 ---------- */
.rg-line{transition:opacity .4s var(--ease),stroke-width .4s var(--ease)}
.rg-line.dim{opacity:.06}
.rg-line.hot{opacity:1;stroke-width:2.4}
/* 被激活的主线转为流动虚线，表现「关系正在运转」 */
.rg-line.hot:not(.secondary){stroke-dasharray:7 3.5;animation:rgFlow 1.5s linear infinite}
@keyframes rgFlow{to{stroke-dashoffset:-21}}

.rg-node{transition:opacity .4s var(--ease)}
.rg-node.dim{opacity:.16}
.rg-node.hot .rg-portrait{
  box-shadow:0 0 0 3px #0b0908,0 0 0 7px color-mix(in srgb,var(--node-color) 70%,transparent),
             0 0 32px rgba(0,0,0,.6);
}

/* ---------- 关系说明条：画布底部的状态栏 ---------- */
.rg-hint{
  position:absolute;z-index:7;left:50%;right:auto;bottom:12px;
  transform:translateX(-50%);
  max-width:min(90%,880px);padding:5px 14px;
  background:rgba(11,9,8,.93);border:1px solid rgba(216,205,187,.1);
  font:9.5px/1.7 var(--mono);letter-spacing:.1em;color:var(--bo-faint);
  white-space:normal;text-align:center;min-height:1.7em;
  transition:color .3s var(--ease),border-color .3s var(--ease);
}
.rg-hint b{color:var(--jin);font-weight:400;letter-spacing:.12em}
.rg-focusing .rg-hint{color:var(--bo-dim);border-color:rgba(168,137,79,.28)}
/* 图例上移，给状态栏让出位置 */
.rg-legend{bottom:58px}
"""

with io.open(CSS, "a", encoding="utf-8") as f:
    f.write(BLOCK)

print("关系网样式已追加（+%d 字）" % len(BLOCK))
print("CSS 现共 %d 字" % len(io.open(CSS, encoding="utf-8").read()))
