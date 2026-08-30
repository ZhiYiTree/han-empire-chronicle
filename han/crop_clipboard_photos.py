# -*- coding: utf-8 -*-
"""把用户发来的 4 张 2x2 人物卡牌合并图裁成单张，
按网站约定命名为「{姓名}.jpg」存入 site/assets/img/people/。
"""
import glob, io, os, sys
from PIL import Image

INDIR = r"C:\Users\94232\.workbuddy\clipboard-images"
OUTDIR = r"C:\Users\94232\WorkBuddy\2026-08-29-19-23-54\han\site\assets\img\people"

NAMES = [
    # 本次剪贴板按修改时间降序取出的 4 张图，实际内容依次如下：
    ["刘邦", "萧何", "樊哙", "曹参"],          # 图1（mtime 最新）：汉营丰沛核心
    ["项羽", "范增", "吕后", "戚夫人"],        # 图2：楚营与宫廷
    ["卢绾", "娄敬", "黥布", "刘盈"],          # 图3：汉营重臣与宗亲
    ["张良", "韩信", "陈平", "周勃"],          # 图4：汉营途中加入
]


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    files = sorted(glob.glob(os.path.join(INDIR, "*.jpg")), key=os.path.getmtime, reverse=True)
    if len(files) < len(NAMES):
        print("图片数量不足：找到", len(files), "张，需要至少", len(NAMES), "张")
        sys.exit(1)

    print("找到图片", len(files), "张，取最近", len(NAMES), "张处理")
    written = []

    for idx, src in enumerate(files[:len(NAMES)]):
        img = Image.open(src)
        w, h = img.size
        print("  [%d] %s -> %dx%d" % (idx + 1, os.path.basename(src), w, h))
        cw, ch = w // 2, h // 2
        boxes = [
            (0, 0, cw, ch),      # 左上
            (cw, 0, w, ch),      # 右上
            (0, ch, cw, h),      # 左下
            (cw, ch, w, h),      # 右下
        ]
        for j, box in enumerate(boxes):
            crop = img.crop(box).convert("RGB")
            name = NAMES[idx][j]
            out = os.path.join(OUTDIR, name + ".jpg")
            crop.save(out, "JPEG", quality=92)
            written.append(out)
            print("     -> %s (%dx%d)" % (name, crop.width, crop.height))

    print("\n共裁剪 %d 张人物照片到 %s" % (len(written), OUTDIR))

    # 验证
    missing = [n for row in NAMES for n in row if not os.path.exists(os.path.join(OUTDIR, n + ".jpg"))]
    if missing:
        print("缺失：", missing)
        sys.exit(1)
    print("全部 16 张验证存在")


if __name__ == "__main__":
    main()
