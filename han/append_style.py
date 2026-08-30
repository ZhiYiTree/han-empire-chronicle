# -*- coding: utf-8 -*-
"""为新时间线（.tlx-*）与人物页头像（.p-*）追加样式。"""
import io

CSS = "site/assets/css/main.css"
BLOCK = """

/* ==================================================================
   纪年 · 单轴时间线（.tlx）——2026-08-30 重做
   设计：一条细轴 + 大量留白 + 滚动点亮，替代原横向「河流」视图
   ================================================================== */
.tlx{padding:0 0 80px}
.tlx-head{display:flex;align-items:flex-end;justify-content:space-between;gap:40px;padding:70px 0 40px;border-bottom:1px solid var(--line)}
.tlx-eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.42em;color:var(--jin);margin-bottom:18px}
.tlx-head h1{margin:0;font:400 40px/1.25 var(--serif);letter-spacing:.1em;color:var(--bo)}
.tlx-head p{margin:13px 0 0;font:12.5px/1.7 var(--sans);letter-spacing:.1em;color:var(--bo-faint)}
.tlx-tools{display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:flex-end}
.tlx-filter{display:flex;gap:7px;flex-wrap:wrap}
.tlx-filter button{padding:6px 13px;border:1px solid var(--line);border-radius:1px;
  font:11px var(--sans);letter-spacing:.14em;color:var(--bo-faint);transition:.35s var(--ease)}
.tlx-filter button:hover{color:var(--bo);border-color:var(--line-2)}
.tlx-filter button.on{color:var(--ink);background:var(--bo);border-color:var(--bo)}
.tlx-imp button.on{color:#fff;background:var(--zhu);border-color:var(--zhu)}

/* 轴 */
.tlx-body{position:relative;padding:52px 0 10px}
.tlx-axis{position:absolute;left:150px;top:0;bottom:0;width:1px;background:var(--line)}
.tlx-axis-fill{position:absolute;inset:0;transform-origin:top center;transform:scaleY(0);
  background:linear-gradient(180deg,var(--jin) 0%,var(--zhu) 100%);transition:transform .15s linear}

/* 年份分组 */
.tlx-year{position:relative;display:grid;grid-template-columns:150px 1fr;padding-bottom:34px}
.tlx-year.hid{display:none}
.tlx-year-side{padding:2px 32px 0 0;text-align:right}
.tlx-year-side b{display:block;font:400 20px/1 var(--mono);letter-spacing:.05em;color:var(--jin)}
.tlx-year-side span{display:block;margin-top:7px;font:10px var(--sans);letter-spacing:.2em;color:var(--bo-faint)}

/* 事件节点 */
.tlx-events{position:relative;padding-left:44px}
.tlx-ev{position:relative;padding-bottom:28px;cursor:pointer;
  opacity:0;transform:translateY(20px);
  transition:opacity .75s var(--ease),transform .75s var(--ease)}
.tlx-ev.in{opacity:1;transform:none}
.tlx-ev.hid{display:none}
.tlx-dot{position:absolute;left:-44px;top:9px;width:7px;height:7px;border-radius:50%;
  background:var(--bo-faint);transform:translateX(-50%);
  box-shadow:0 0 0 5px var(--ink);transition:.4s var(--ease)}
.tlx-ev.imp-A .tlx-dot{width:8px;height:8px;background:var(--jin)}
.tlx-ev.imp-S .tlx-dot{width:12px;height:12px;background:var(--zhu);
  box-shadow:0 0 0 5px var(--ink),0 0 16px rgba(184,59,43,.5)}
.tlx-card{padding-left:18px;border-left:1px solid var(--line);transition:.45s var(--ease)}
.tlx-ev:hover .tlx-card{border-left-color:var(--zhu);transform:translateX(5px)}
.tlx-ev:hover .tlx-dot{background:var(--zhu)}
.tlx-card h3{margin:0 0 8px;font:400 19px/1.55 var(--serif);letter-spacing:.05em;color:var(--bo);transition:.35s var(--ease)}
.tlx-ev:hover .tlx-card h3{color:#fff}
.tlx-card p{margin:0;max-width:660px;font:12.5px/1.85 var(--sans);letter-spacing:.04em;color:var(--bo-dim)}
.tlx-meta{display:flex;gap:18px;margin-top:10px;font:10px var(--mono);letter-spacing:.16em;color:var(--bo-faint)}
.tlx-meta .tlx-who{color:var(--hud)}
.tlx-foot{display:flex;justify-content:space-between;gap:20px;padding:24px 0 0;
  border-top:1px solid var(--line);font:10.5px var(--sans);letter-spacing:.14em;color:var(--bo-faint)}
.tlx-foot b{color:var(--jin);font-weight:400}

@media(max-width:900px){
  .tlx-head{flex-direction:column;align-items:flex-start;padding-top:44px;gap:24px}
  .tlx-tools{justify-content:flex-start}
  .tlx-axis{left:0}
  .tlx-year{grid-template-columns:1fr;padding-left:26px}
  .tlx-year-side{text-align:left;padding:0 0 14px}
  .tlx-events{padding-left:0}
  .tlx-dot{left:-26px}
  .tlx-card{padding-left:16px}
}

/* ==================================================================
   人物页 · 头像（.p-head / .p-portrait）
   照片放 assets/img/people/{姓名}.jpg，缺失时回落到姓名首字帛书头像
   ================================================================== */
.p-head{display:flex;gap:34px;align-items:flex-start;margin-top:28px}
.p-portrait{position:relative;flex:none;width:132px;height:172px;margin:0;overflow:hidden;
  background:linear-gradient(160deg,#1c1816,#100e0d);border:1px solid var(--line-2)}
.p-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  filter:saturate(.88) contrast(1.04);transition:.6s var(--ease)}
.p-photo.broken{display:none}
.p-portrait:hover .p-photo{filter:saturate(1) contrast(1.08)}
.p-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font:400 52px/1 var(--serif);color:rgba(168,137,79,.42);
  background:radial-gradient(circle at 50% 36%,rgba(168,137,79,.14),transparent 64%)}
.p-badge{position:absolute;right:0;bottom:0;padding:3px 9px;background:var(--zhu);color:#fff;
  font:400 10px/1.6 var(--mono);letter-spacing:.14em}
.p-portrait.tier-A .p-badge{background:var(--jin);color:var(--ink)}
.p-portrait.tier-B .p-badge{background:#443d36}
.p-portrait.tier-S{box-shadow:0 0 0 1px rgba(184,59,43,.28)}
.p-head-txt{flex:1;min-width:0}
.p-name{font-size:44px}

@media(max-width:760px){
  .p-head{flex-direction:column;gap:20px}
  .p-portrait{width:112px;height:146px}
  .p-name{font-size:34px}
}
"""

with io.open(CSS, "a", encoding="utf-8") as f:
    f.write(BLOCK)

print("样式已追加至 %s（+%d 字）" % (CSS, len(BLOCK)))
print("CSS 现共 %d 字" % len(io.open(CSS, encoding="utf-8").read()))
