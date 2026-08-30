# -*- coding: utf-8 -*-
"""把三批抽取结果规范化为网站数据层：persons / events / relations / lectures / sources / traits。"""
import json, os, re, collections, sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.abspath(__file__))
EX = os.path.join(ROOT, "content", "extracted")
OUT = os.path.join(ROOT, "content", "data")
os.makedirs(OUT, exist_ok=True)


def load_all():
    d = []
    for f in ("ep-01-15.json", "ep-16-30.json", "ep-31-45.json"):
        d += json.load(open(os.path.join(EX, f), encoding="utf-8"))
    return sorted(d, key=lambda x: x["episode"])


EPS = load_all()

# ---------------- 人物异名归一 ----------------
ALIAS = {
    "汉惠帝刘盈": "刘盈", "刘盈": "刘盈",
    "英布": "黥布", "黥布": "黥布", "黥布（英布）": "黥布",
    "吕雉": "吕后", "吕太后": "吕后", "吕后": "吕后",
    "项籍": "项羽", "项羽": "项羽",
    "子房": "张良", "留侯": "张良", "张良": "张良",
    "淮阴侯": "韩信", "齐王韩信": "韩信", "韩信": "韩信",
    "酂侯": "萧何", "萧何": "萧何",
    "曲逆侯": "陈平", "陈平": "陈平",
    "楚怀王": "楚怀王熊心", "楚怀王（熊心）": "楚怀王熊心",
    "义帝": "楚怀王熊心", "熊心": "楚怀王熊心",
    "嬴政": "秦始皇", "秦始皇": "秦始皇",
    "胡亥": "秦二世", "秦二世": "秦二世",
    "戚姬": "戚夫人", "戚夫人": "戚夫人",
    "武信君": "项梁", "项梁": "项梁",
    "雍王": "章邯", "章邯": "章邯",
    "郦生": "郦食其", "郦食其": "郦食其",
    "滕公": "夏侯婴", "夏侯婴": "夏侯婴", "夏侯婴（滕公）": "夏侯婴",
    "刘季": "刘邦", "沛公": "刘邦", "汉王": "刘邦", "高祖": "刘邦", "刘邦": "刘邦",
    "刘敬": "娄敬", "娄敬": "娄敬", "娄敬（刘敬）": "娄敬",
    "汉文帝刘恒": "刘恒",
    "刘太公": "太公",
    "赵王如意": "刘如意", "刘如意": "刘如意",
}


def norm_person(p):
    p = (p or "").strip()
    return ALIAS.get(p, p)


# ---------------- 人物档案 ----------------
# tier: S/A/B ；faction: 阵营 ；role: 职能 ；join: 加入阶段/途径
# trust: 王立群「才与疑」解释模型下的位置（非《史记》原生分类，UI 必须标注）
PERSON_META = {
    "刘邦": dict(tier="S", faction="汉", role="核心", joinPhase="—", joinPath="—",
                 specialty="识人用人 / 决断", trustUse="—", trustDoubt="—",
                 titles=["布衣", "泗水亭长", "沛公", "汉王", "皇帝"],
                 note="汉帝国开国皇帝，中国历史上第一位平民出身的皇帝。"),
    "项羽": dict(tier="S", faction="楚", role="军事", joinPhase="—", joinPath="—",
                 specialty="野战指挥", trustUse="—", trustDoubt="—",
                 titles=["楚将", "西楚霸王"],
                 note="楚国名将项燕之后，巨鹿之战破秦主力，最终垓下败亡。"),
    "吕后": dict(tier="S", faction="汉·外戚", role="政治", joinPhase="丰沛时期", joinPath="姻亲",
                 specialty="政治决断", trustUse="大用", trustDoubt="不疑（王立群指刘邦看不懂吕后）",
                 titles=["皇后", "皇太后"],
                 note="刘邦皇后，汉初政坛重要角色，刘邦晚年储位之争的核心一方。"),
    "萧何": dict(tier="S", faction="汉", role="政治", joinPhase="丰沛起兵", joinPath="丰沛故人",
                 specialty="治国 / 后勤 / 荐才", trustUse="大用", trustDoubt="小疑（三次受疑、一度下狱）",
                 titles=["沛县主吏掾", "丞相", "相国"],
                 note="汉初三杰之一，镇关中、荐韩信，功臣第一。"),
    "张良": dict(tier="S", faction="汉", role="谋臣", joinPhase="反秦途中", joinPath="途中加入",
                 specialty="战略谋划", trustUse="大用", trustDoubt="不疑",
                 titles=["韩国司徒", "留侯"],
                 note="汉初三杰之一，下邑画策、谏阻分封、定都长安之议。"),
    "韩信": dict(tier="S", faction="汉", role="军事", joinPhase="汉中时期", joinPath="敌营转投（自楚归汉）",
                 specialty="军事指挥", trustUse="大用", trustDoubt="大疑",
                 titles=["治粟都尉", "大将军", "齐王", "楚王", "淮阴侯"],
                 note="汉初三杰之一，还定三秦、北伐破魏赵燕齐、垓下合围。"),
    "曹参": dict(tier="A", faction="汉", role="军事/政治", joinPhase="丰沛起兵", joinPath="丰沛故人",
                 specialty="征战 / 萧规曹随", trustUse="重用", trustDoubt="不疑",
                 titles=["沛县狱掾", "齐相国", "丞相"],
                 note="继萧何为相，有「萧规曹随」之说。"),
    "樊哙": dict(tier="A", faction="汉", role="军事", joinPhase="丰沛起兵", joinPath="丰沛故人（连襟）",
                 specialty="猛将 / 鸿门护主", trustUse="大用", trustDoubt="不疑",
                 titles=["舍人", "左丞相", "舞阳侯"],
                 note="吕后妹夫，鸿门宴闯帐护刘邦。"),
    "夏侯婴": dict(tier="A", faction="汉", role="军事/近侍", joinPhase="丰沛起兵", joinPath="丰沛故人",
                 specialty="御车 / 救护", trustUse="重用", trustDoubt="不疑",
                 titles=["沛县厩司御", "太仆", "汝阴侯"],
                 note="彭城败后护载刘盈、鲁元，长期掌太仆。"),
    "陈平": dict(tier="A", faction="汉", role="谋臣", joinPhase="楚汉战争", joinPath="敌营转投（三易其主）",
                 specialty="奇谋 / 反间", trustUse="大用", trustDoubt="小疑（屡被谗「盗嫂受金」「反复无常」）",
                 titles=["都尉", "护军中尉", "丞相", "曲逆侯"],
                 note="六出奇计，荥阳离间范增、白登解围之说相关。"),
    "彭越": dict(tier="A", faction="汉（初为独立武装）", role="军事", joinPhase="反秦/楚汉", joinPath="途中加入（联盟）",
                 specialty="游击 / 断粮道", trustUse="用", trustDoubt="疑（以谋反罪名被诛）",
                 titles=["魏相国", "梁王"],
                 note="楚汉战争中骚扰项羽后方，汉初以谋反罪名被杀。"),
    "黥布": dict(tier="A", faction="汉（原为楚将）", role="军事", joinPhase="楚汉战争", joinPath="敌营转投（随何策反）",
                 specialty="野战", trustUse="用", trustDoubt="疑（终反）",
                 titles=["九江王", "淮南王"],
                 note="项羽部将，被随何策反归汉，汉初反叛被杀。"),
    "周勃": dict(tier="A", faction="汉", role="军事", joinPhase="丰沛起兵", joinPath="丰沛故人",
                 specialty="厚重 / 平叛", trustUse="重用", trustDoubt="小疑（王立群称其木强敦厚而被轻视）",
                 titles=["中涓", "太尉", "丞相", "绛侯"],
                 note="平定燕王臧荼、韩王信叛乱，后与陈平平诸吕。"),
    "卢绾": dict(tier="A", faction="汉", role="亲信/军事", joinPhase="丰沛起兵", joinPath="丰沛故人（同里同日生）",
                 specialty="亲信统兵", trustUse="大用", trustDoubt="终疑（逃入匈奴）",
                 titles=["将军", "太尉", "燕王"],
                 note="与刘邦同里同日生，最受亲信，终因猜惧而叛。"),
    "郦食其": dict(tier="A", faction="汉", role="外交", joinPhase="反秦途中", joinPath="途中自荐",
                   specialty="游说", trustUse="中用", trustDoubt="不疑",
                   titles=["广野君"],
                   note="献计取陈留，说齐王田广；后被韩信袭齐所误而被烹。"),
    "叔孙通": dict(tier="A", faction="汉", role="政治/礼制", joinPhase="楚汉战争", joinPath="敌营转投（六易其主）",
                   specialty="制礼作乐", trustUse="中用", trustDoubt="不疑",
                   titles=["博士", "太常", "太子太傅"],
                   note="为汉制朝仪，王立群称其「六易其主」而终受重用。"),
    "娄敬": dict(tier="A", faction="汉", role="谋臣/外交", joinPhase="汉初", joinPath="下层自荐（戍卒）",
                 specialty="战略判断 / 和亲之议", trustUse="中用", trustDoubt="不疑",
                 titles=["郎中", "奉春君", "建信侯"],
                 note="建议迁都长安，后主和亲；刘邦因其言而道歉封侯。"),
    "刘盈": dict(tier="A", faction="汉·宗室", role="宗室", joinPhase="—", joinPath="嫡子",
                 specialty="—", trustUse="—", trustDoubt="—",
                 titles=["太子", "汉惠帝"],
                 note="刘邦嫡子，储位之争中的太子，后即位为惠帝。"),
    "戚夫人": dict(tier="A", faction="汉·宗室", role="宗室", joinPhase="楚汉战争", joinPath="宠姬",
                   specialty="—", trustUse="—", trustDoubt="—",
                   titles=["夫人"],
                   note="刘邦宠姬，生赵王如意，夺储之争的另一方。"),
    "刘如意": dict(tier="A", faction="汉·宗室", role="宗室", joinPhase="—", joinPath="庶子",
                   specialty="—", trustUse="—", trustDoubt="—",
                   titles=["赵王"],
                   note="戚夫人所生，刘邦曾欲易太子立之，终被害。"),
    "王陵": dict(tier="B", faction="汉", role="政治", joinPhase="反秦后期", joinPath="途中加入（后封）",
                 specialty="耿直", trustUse="中用", trustDoubt="小疑（因善雍齿而后封）",
                 titles=["右丞相", "安国侯"],
                 note="与雍齿相善，刘邦临终安排其为第三任丞相。"),
    "灌婴": dict(tier="B", faction="汉", role="军事", joinPhase="反秦途中", joinPath="途中加入",
                 specialty="骑兵", trustUse="重用", trustDoubt="不疑",
                 titles=["中涓", "太尉", "丞相", "颍阴侯"],
                 note="与周勃并称「绛灌」，精锐骑兵统帅。"),
    "周昌": dict(tier="B", faction="汉", role="政治", joinPhase="丰沛起兵", joinPath="丰沛故人",
                 specialty="敢直谏", trustUse="中用", trustDoubt="不疑（刘邦笑而用之）",
                 titles=["御史大夫", "赵相"],
                 note="当面比刘邦为桀纣，坚决反对易储，受托保护赵王如意。"),
    "纪信": dict(tier="B", faction="汉", role="军事", joinPhase="丰沛起兵", joinPath="丰沛故人",
                 specialty="死节", trustUse="—", trustDoubt="—",
                 titles=["将军"],
                 note="荥阳之围中假扮刘邦出降而被项羽烧杀。"),
    "随何": dict(tier="B", faction="汉", role="外交", joinPhase="楚汉战争", joinPath="汉营谒者",
                 specialty="游说", trustUse="中用", trustDoubt="不疑",
                 titles=["谒者", "护军中尉"],
                 note="策反黥布的关键人物，当场反驳刘邦而得封。"),
    "雍齿": dict(tier="B", faction="汉（曾叛）", role="军事", joinPhase="丰沛起兵", joinPath="丰沛故人（后叛后归）",
                 specialty="—", trustUse="小用", trustDoubt="大疑（刘邦素所不快）",
                 titles=["什方侯"],
                 note="据丰叛刘邦，归汉后因张良之议首封为侯以安功臣。"),
    "陈豨": dict(tier="B", faction="汉（后反）", role="军事", joinPhase="汉初", joinPath="汉将",
                 specialty="统兵", trustUse="用", trustDoubt="疑（终反）",
                 titles=["阳夏侯", "代相国"],
                 note="汉初叛乱，刘邦亲征；王立群论其「不南据邯郸而阻漳水」。"),
    "楚怀王熊心": dict(tier="B", faction="楚", role="政治", joinPhase="反秦", joinPath="项梁所立",
                       specialty="名义领袖", trustUse="—", trustDoubt="—",
                       titles=["楚王", "义帝"],
                       note="项梁所立楚王，定「怀王之约」，后被项羽迁杀。"),
    "项梁": dict(tier="B", faction="楚", role="军事", joinPhase="反秦", joinPath="—",
                 specialty="军事领袖", trustUse="—", trustDoubt="—",
                 titles=["武信君"],
                 note="项燕之子，项羽叔父，定陶之战败死。"),
    "范增": dict(tier="B", faction="楚", role="谋臣", joinPhase="反秦", joinPath="—",
                 specialty="谋略", trustUse="—", trustDoubt="—",
                 titles=["亚父", "历阳侯"],
                 note="项羽谋士，鸿门宴主杀刘邦，后被反间而去。"),
    "项伯": dict(tier="B", faction="楚（亲汉）", role="政治", joinPhase="反秦", joinPath="—",
                 specialty="居中调停", trustUse="—", trustDoubt="—",
                 titles=["左尹", "射阳侯"],
                 note="项羽叔父，鸿门宴前夜通风报信，多次护刘邦。"),
    "章邯": dict(tier="B", faction="秦→雍", role="军事", joinPhase="—", joinPath="—",
                 specialty="秦末主将", trustUse="—", trustDoubt="—",
                 titles=["秦少府", "雍王"],
                 note="秦末名将，巨鹿之战败于项羽，后为三秦之一。"),
    "陈胜": dict(tier="B", faction="张楚", role="起义", joinPhase="—", joinPath="—",
                 specialty="首义", trustUse="—", trustDoubt="—",
                 titles=["陈王"],
                 note="大泽乡起义领袖，「王侯将相宁有种乎」。"),
    "秦始皇": dict(tier="B", faction="秦", role="—", joinPhase="—", joinPath="—",
                   specialty="—", trustUse="—", trustDoubt="—", titles=["始皇帝"],
                   note="秦帝国建立者，刘邦曾见其出巡而感叹「大丈夫当如此」。"),
    "秦二世": dict(tier="B", faction="秦", role="—", joinPhase="—", joinPath="—",
                   specialty="—", trustUse="—", trustDoubt="—", titles=["二世皇帝"],
                   note="赵高所立，后被赵高所杀。"),
    "赵高": dict(tier="B", faction="秦", role="政治", joinPhase="—", joinPath="—",
                 specialty="权谋", trustUse="—", trustDoubt="—", titles=["中丞相"],
                 note="弑秦二世，后被子婴所杀。"),
    "子婴": dict(tier="B", faction="秦", role="—", joinPhase="—", joinPath="—",
                 specialty="—", trustUse="—", trustDoubt="—", titles=["秦王"],
                 note="秦王子婴，降刘邦于轵道。"),
    "张耳": dict(tier="B", faction="诸侯", role="政治", joinPhase="—", joinPath="—",
                 specialty="—", trustUse="—", trustDoubt="—", titles=["常山王", "赵王"],
                 note="与陈馀初为刎颈交，后反目。"),
    "陈馀": dict(tier="B", faction="诸侯", role="军事", joinPhase="—", joinPath="—",
                 specialty="—", trustUse="—", trustDoubt="—", titles=["代王"],
                 note="与张耳由刎颈交至相攻。"),
    "韩王信": dict(tier="B", faction="汉（后叛）", role="军事", joinPhase="反秦", joinPath="韩国贵族",
                   specialty="统兵", trustUse="用", trustDoubt="疑（迁太原，终反匈奴）",
                   titles=["韩王", "太原王"],
                   note="战国韩襄王之后，汉初被迁太原，后降匈奴。"),
    "臧荼": dict(tier="B", faction="汉（后反）", role="军事", joinPhase="楚汉", joinPath="—",
                 specialty="—", trustUse="—", trustDoubt="疑（先封后反）", titles=["燕王"],
                 note="项羽所封燕王，归汉后反，被周勃平定。"),
    "审食其": dict(tier="B", faction="汉·外戚", role="政治", joinPhase="丰沛时期", joinPath="吕后亲信",
                   specialty="内廷", trustUse="中用", trustDoubt="不疑", titles=["左丞相", "辟阳侯"],
                   note="吕后亲信，长期侍奉太公与吕后。"),
    "吕泽": dict(tier="B", faction="汉·外戚", role="军事", joinPhase="丰沛起兵", joinPath="外戚",
                 specialty="统兵", trustUse="用", trustDoubt="—", titles=["周吕侯"],
                 note="吕后兄，刘邦起兵时的重要将领。"),
    "吕释之": dict(tier="B", faction="汉·外戚", role="政治", joinPhase="丰沛起兵", joinPath="外戚",
                   specialty="—", trustUse="用", trustDoubt="—", titles=["建成侯"],
                   note="吕后兄，商山四皓之议相关。"),
    "蒯通": dict(tier="B", faction="齐", role="谋臣", joinPhase="楚汉", joinPath="—",
                 specialty="游说", trustUse="—", trustDoubt="—", titles=["齐辩士"],
                 note="劝韩信三分天下，韩信不听。"),
    "刘太公": dict(tier="B", faction="汉·宗室", role="宗室", joinPhase="—", joinPath="父",
                   specialty="—", trustUse="—", trustDoubt="—", titles=["太上皇"],
                   note="刘邦之父，曾被项羽所执，后尊为太上皇。"),
}

# ---------------- canonical 事件表 ----------------
# importance: S/A/B ；keywords 用于把 470 条抽取事件名归拢过来
EVENTS = [
    # ACT I 起兵反秦
    ("ev-legend-birth", "刘媪泽畔梦蛟龙而生邦", None, "传说", "B", "起兵反秦", ["刘邦"], [], ["梦", "蛟龙", "感生", "出生"], True),
    ("ev-sishui", "泗水亭长", None, "秦始皇晚年", "B", "起兵反秦", ["刘邦"], ["沛县"], ["泗水亭长", "亭长"]),
    ("ev-lv-marriage", "吕公相面嫁女", None, "秦始皇晚年", "B", "起兵反秦", ["刘邦", "吕后", "萧何"], ["沛县"], ["吕公", "贺钱万", "相面", "嫁女"]),
    ("ev-fengxi", "丰西泽纵徒", -211, "秦始皇晚年（年份有争议）", "A", "起兵反秦", ["刘邦"], ["丰西泽", "芒砀山"], ["丰西泽", "纵徒", "纵囚"], True),
    ("ev-legend-snake", "斩蛇与白帝子赤帝子", None, "传说", "B", "起兵反秦", ["刘邦"], ["芒砀山"], ["斩蛇", "白帝子", "赤帝子"], True),
    ("ev-mangdang", "亡匿芒砀山", -211, "秦末", "B", "起兵反秦", ["刘邦", "吕后"], ["芒砀山"], ["芒砀", "云气"]),
    ("ev-dazexiang", "大泽乡起义", -209, "秦二世元年七月", "S", "起兵反秦", ["陈胜", "吴广"], ["蕲县大泽乡"], ["大泽乡", "陈胜", "吴广"]),
    ("ev-peixian", "沛县起兵·刘邦被立为沛公", -209, "秦二世元年九月", "S", "起兵反秦", ["刘邦", "萧何", "曹参", "樊哙"], ["沛县"], ["沛县起兵", "沛公"]),
    ("ev-yongchi", "雍齿据丰叛·三攻丰邑", -209, "秦二世二年", "A", "起兵反秦", ["刘邦", "雍齿"], ["丰邑"], ["雍齿", "丰邑", "攻丰"]),
    ("ev-join-xiangliang", "刘邦投奔项梁", -208, "秦二世二年", "B", "起兵反秦", ["刘邦", "项梁"], ["薛"], ["项梁", "投奔", "景驹"]),
    ("ev-huaiwang-set", "项梁立楚怀王熊心", -208, "秦二世二年", "A", "起兵反秦", ["项梁", "楚怀王熊心"], ["盱眙"], ["楚怀王", "熊心", "立楚"]),
    ("ev-xiangliang-die", "项梁定陶战死", -208, "秦二世二年", "A", "起兵反秦", ["项梁", "项羽", "章邯"], ["定陶"], ["项梁战死", "定陶之战"]),
    ("ev-huaiwang-yue", "怀王之约：先入定关中者王之", -208, "秦二世二年后九月", "S", "起兵反秦", ["楚怀王熊心", "刘邦", "项羽"], ["彭城"], ["怀王之约", "先入定关中"]),
    ("ev-west-pass", "西入秦关：偷袭陈留·智取南阳", -207, "秦二世三年", "A", "起兵反秦", ["刘邦", "郦食其", "张良"], ["陈留", "南阳", "宛城"], ["陈留", "南阳", "宛", "西入秦关", "西征"]),
    ("ev-yaoguan", "峣关之战", -207, "秦二世三年", "B", "起兵反秦", ["刘邦", "张良"], ["峣关", "蓝田"], ["峣关", "蓝田"]),
    ("ev-ziying", "子婴投降·刘邦入咸阳", -206, "汉元年十月", "S", "起兵反秦", ["刘邦", "子婴", "赵高", "秦二世"], ["咸阳", "轵道"], ["子婴", "咸阳", "入关", "投降", "灭秦"]),
    ("ev-yuefasanzhang", "约法三章", -206, "汉元年", "A", "起兵反秦", ["刘邦"], ["咸阳", "霸上"], ["约法三章", "还军霸上", "霸上"]),
    ("ev-block-hangu", "刘邦封堵函谷关", -206, "汉元年", "A", "起兵反秦", ["刘邦", "项羽"], ["函谷关"], ["函谷关", "封堵"]),
    # ACT II 楚汉战争
    ("ev-hongmen", "鸿门宴", -206, "汉元年十二月", "S", "楚汉战争", ["刘邦", "项羽", "范增", "项伯", "张良", "樊哙"], ["鸿门", "新丰"], ["鸿门"]),
    ("ev-feng-hanwang", "项羽分封·刘邦屈封汉王", -206, "汉元年", "S", "楚汉战争", ["刘邦", "项羽", "张良"], ["戏下", "南郑", "汉中"], ["分封", "汉王", "巴蜀", "汉中", "屈就"]),
    ("ev-burn-road", "张良献策烧绝栈道", -206, "汉元年", "B", "楚汉战争", ["刘邦", "张良"], ["汉中"], ["栈道", "烧绝"]),
    ("ev-chase-hanxin", "萧何月下追韩信", -206, "汉元年", "S", "楚汉战争", ["萧何", "韩信", "刘邦"], ["南郑"], ["追韩信", "月下", "亡去"]),
    ("ev-appoint-general", "登坛拜将", -206, "汉元年", "S", "楚汉战争", ["刘邦", "韩信", "萧何"], ["南郑"], ["登坛", "拜将", "大将", "坛场"]),
    ("ev-huan-ding-sanqin", "还定三秦", -206, "汉元年八月—二年", "S", "楚汉战争", ["刘邦", "韩信", "章邯"], ["关中", "陈仓", "废丘"], ["还定三秦", "暗渡陈仓", "陈仓", "三秦"]),
    ("ev-pengcheng", "彭城之战", -205, "汉二年四月", "S", "楚汉战争", ["刘邦", "项羽", "刘太公", "吕后"], ["彭城"], ["彭城"]),
    ("ev-xiayi", "下邑画策", -205, "汉二年", "A", "楚汉战争", ["刘邦", "张良", "韩信", "彭越", "黥布"], ["下邑"], ["下邑"]),
    ("ev-hanxin-beifa", "韩信北伐：破魏·井陉破赵·降燕", -205, "汉二年—三年", "S", "楚汉战争", ["韩信", "刘邦", "张耳"], ["魏", "井陉", "赵", "燕"], ["北伐", "井陉", "灭赵", "破魏", "降燕", "背水"]),
    ("ev-xingyang", "荥阳拉锯战", -204, "汉三年—四年", "S", "楚汉战争", ["刘邦", "项羽", "纪信", "陈平", "范增"], ["荥阳", "成皋"], ["荥阳", "成皋", "纪信", "拉锯"]),
    ("ev-hanxin-qi", "韩信破齐", -203, "汉四年", "S", "楚汉战争", ["韩信", "郦食其", "刘邦"], ["齐", "临淄", "历下"], ["破齐", "袭齐", "郦食其"]),
    ("ev-qiwang", "韩信请封齐王", -203, "汉四年", "S", "楚汉战争", ["韩信", "刘邦", "张良", "陈平"], ["齐"], ["齐王", "请封", "假王"]),
    ("ev-honggou", "鸿沟议和", -203, "汉四年", "A", "楚汉战争", ["刘邦", "项羽"], ["鸿沟", "广武"], ["鸿沟", "议和"]),
    ("ev-gaxia", "垓下之战", -202, "汉五年", "S", "楚汉战争", ["刘邦", "韩信", "项羽", "彭越", "黥布"], ["垓下"], ["垓下"]),
    ("ev-xiangyu-die", "项羽之死", -202, "汉五年", "S", "楚汉战争", ["项羽", "刘邦"], ["乌江", "东城"], ["项羽之死", "乌江", "自刎", "霸王"]),
    # ACT III 开国建制
    ("ev-dingtao", "定陶称帝", -202, "汉五年二月", "S", "开国建制", ["刘邦"], ["定陶"], ["称帝", "登基", "定陶", "皇帝"]),
    ("ev-capital", "迁都长安", -202, "汉五年", "S", "开国建制", ["刘邦", "娄敬", "张良"], ["洛阳", "长安", "关中"], ["迁都", "定都", "长安", "洛阳"]),
    ("ev-shusuntong", "叔孙通制朝仪", -200, "汉初", "A", "开国建制", ["叔孙通", "刘邦"], ["长安"], ["朝仪", "叔孙通", "礼"]),
    ("ev-sanjie", "汉初三杰之论", -202, "汉初", "A", "开国建制", ["刘邦", "张良", "萧何", "韩信"], ["洛阳", "长安"], ["三杰"]),
    ("ev-fenfeng-yixing", "分封异姓诸侯王", -202, "汉初", "S", "开国建制", ["刘邦", "韩信", "彭越", "黥布", "臧荼", "卢绾"], ["长安"], ["异姓王", "分封诸侯", "封王"]),
    ("ev-tianheng", "田横五百士", -202, "汉初", "A", "开国建制", ["田横", "刘邦"], ["海岛", "洛阳"], ["田横", "五百士", "田家"]),
    ("ev-jibu-dinggong", "季布为奴·丁公被杀", -202, "汉初", "A", "开国建制", ["刘邦", "季布", "丁公", "钟离眜"], ["洛阳", "长安"], ["季布", "丁公", "钟离眜"]),
    ("ev-luwan-hanxin", "一升一降：卢绾封王·韩信降侯", -202, "汉初", "A", "开国建制", ["刘邦", "卢绾", "韩信"], ["长安"], ["卢绾", "降侯", "一升一降", "淮阴侯"]),
    # ACT IV 功臣群像
    ("ev-chenping-plan", "陈平奇谋", None, "楚汉—汉初", "A", "功臣群像", ["陈平", "刘邦"], ["荥阳", "长安", "白登"], ["奇谋", "陈平", "反间", "盗嫂受金"]),
    ("ev-jiangguan", "绛灌并峙：周勃与灌婴", None, "汉初", "B", "功臣群像", ["周勃", "灌婴", "陈平"], ["长安"], ["绛灌", "并峙"]),
    ("ev-lvshi", "吕氏英杰：吕泽与吕释之", None, "汉初", "B", "功臣群像", ["吕泽", "吕释之", "吕后"], ["长安"], ["吕氏", "吕泽", "吕释之"]),
    ("ev-zhangliang-feng", "张良受封留侯", -201, "汉六年", "B", "功臣群像", ["张良", "刘邦"], ["留", "长安"], ["留侯", "谋圣", "张良受封"]),
    ("ev-jungong-fenghou", "军功封侯", -201, "汉六年", "A", "功臣群像", ["刘邦", "曹参", "周勃", "灌婴", "樊哙", "夏侯婴"], ["长安"], ["封侯", "列侯", "军功"]),
    ("ev-xiaohe-first", "萧何位次第一", -201, "汉六年", "A", "功臣群像", ["萧何", "刘邦", "曹参"], ["长安"], ["第一功臣", "萧何", "位次", "功人功狗"]),
    ("ev-liuxing-fengwang", "刘姓封王", -201, "汉六年", "A", "功臣群像", ["刘邦", "刘交", "刘贾"], ["长安"], ["刘姓封王", "同姓王", "荆王", "楚王交"]),
    ("ev-taishang", "尊太公为太上皇帝", -201, "汉六年", "B", "功臣群像", ["刘邦", "刘太公"], ["长安", "栎阳"], ["太公", "太上皇", "家令"]),
    ("ev-baideng", "白登之围", -200, "汉七年", "S", "功臣群像", ["刘邦", "陈平", "娄敬", "韩王信"], ["平城", "白登", "代"], ["白登", "平城", "匈奴", "和亲"]),
    # ACT V 晚年危机
    ("ev-ruyi-wang", "刘如意封赵王", -198, "汉九年", "B", "晚年危机", ["刘邦", "刘如意", "戚夫人", "周昌"], ["邯郸", "赵"], ["爱子封王", "赵王", "如意"]),
    ("ev-duochu", "夺储之祸：欲易太子", -196, "汉十年前后", "S", "晚年危机", ["刘邦", "刘盈", "戚夫人", "吕后", "张良", "周昌", "叔孙通"], ["长安"], ["易储", "夺储", "太子", "商山四皓"]),
    ("ev-chenxi", "陈豨叛乱", -197, "汉十年", "A", "晚年危机", ["刘邦", "陈豨", "韩信", "彭越"], ["代", "邯郸", "漳水"], ["陈豨", "代", "邯郸", "漳水"]),
    ("ev-hanxin-die", "韩信之死", -196, "汉十一年", "S", "晚年危机", ["韩信", "吕后", "萧何", "刘邦", "陈豨"], ["长安", "长乐宫钟室"], ["韩信之死", "钟室", "成也萧何", "谋反"]),
    ("ev-pengyue-die", "彭越醢刑", -196, "汉十一年", "A", "晚年危机", ["彭越", "刘邦", "吕后"], ["洛阳", "郑"], ["彭越", "醢", "反乎冤乎"]),
    ("ev-qingbu-fan", "黥布反·刘邦亲征", -196, "汉十一年—十二年", "A", "晚年危机", ["黥布", "刘邦"], ["淮南", "蕲", "会稽"], ["黥布", "英布", "淮南", "亲征"]),
    ("ev-luwan-fan", "卢绾疑惧入匈奴", -195, "汉十二年", "A", "晚年危机", ["卢绾", "刘邦", "陈豨"], ["燕", "匈奴"], ["卢绾", "燕王", "匈奴"]),
    ("ev-xiaohe-jail", "萧何下狱", -195, "汉十二年", "B", "晚年危机", ["萧何", "刘邦"], ["长安"], ["萧何下狱", "上林苑", "王卫尉"]),
    ("ev-gaozu-huanxiang", "高祖还乡·作《大风歌》", -195, "汉十二年十月", "S", "晚年危机", ["刘邦", "英布"], ["沛县", "丰县"], ["还乡", "大风歌", "沛县", "击筑", "歌风台"]),
    ("ev-liubang-die", "刘邦去世", -195, "汉十二年四月", "S", "晚年危机", ["刘邦", "吕后", "刘盈"], ["长安", "长乐宫"], ["去世", "崩", "拒医", "命乃在天"]),
    # 补充事件
    ("ev-tianrong", "田荣之乱·项羽陷于齐地", -206, "汉元年—二年", "A", "楚汉战争",
     ["项羽", "田荣"], ["齐", "城阳"], ["田荣", "齐地叛", "救齐", "击齐"]),
    ("ev-kengxiang", "项羽坑杀秦降卒二十万", -206, "汉元年十一月", "A", "楚汉战争",
     ["项羽", "章邯"], ["新安"], ["坑杀", "二十万", "降卒", "新安"]),
    ("ev-yidi-fasang", "项羽杀义帝·刘邦为义帝发丧", -205, "汉二年", "A", "楚汉战争",
     ["项羽", "楚怀王熊心", "刘邦"], ["郴", "洛阳"], ["义帝", "发丧", "三老", "董公", "杀义帝"]),
    ("ev-guangwu", "广武对峙·伏弩射中刘邦", -203, "汉四年", "A", "楚汉战争",
     ["刘邦", "项羽"], ["广武"], ["伏弩", "广武", "射中", "中弩", "楼烦"]),
    ("ev-wushe", "武涉说韩信三分天下", -203, "汉四年", "A", "楚汉战争",
     ["韩信", "项羽", "刘邦", "蒯通"], ["齐"], ["武涉", "三分", "蒯通", "参分"]),
    ("ev-weihe", "潍水之战·龙且败死", -203, "汉四年", "A", "楚汉战争",
     ["韩信", "龙且", "项羽"], ["潍水"], ["潍水", "龙且"]),
    ("ev-shangshan", "商山四皓保太子", -196, "汉十年前后", "B", "晚年危机",
     ["刘邦", "刘盈", "吕后", "张良", "戚夫人"], ["长安"], ["四皓", "商山"]),
]

# ---------------- 关系链 ----------------
RELATIONS = [
    dict(id="rel-liubang-hanxin", a="刘邦", b="韩信",
         summary="从登坛拜将到钟室之祸：中国历史上最典型的「大用大疑」。",
         phases=[
             dict(year=-206, title="初见·未奇", type="初识", desc="韩信自楚归汉，仅任连敖、治粟都尉，未被刘邦看重。", events=["ev-feng-hanwang"]),
             dict(year=-206, title="萧何追回", type="荐举", desc="韩信亡去，萧何月下追回，力荐于刘邦。", events=["ev-chase-hanxin"]),
             dict(year=-206, title="登坛拜将", type="重用", desc="刘邦择日斋戒设坛，拜韩信为大将，全军皆惊。", events=["ev-appoint-general"]),
             dict(year=-205, title="军事倚重", type="依赖", desc="还定三秦、破魏破赵降燕、破齐，刘邦的北方战线几乎全交韩信。", events=["ev-huan-ding-sanqin", "ev-hanxin-beifa", "ev-hanxin-qi"]),
             dict(year=-203, title="齐王之请", type="嫌隙", desc="韩信请为「假王」，刘邦怒而止于张良、陈平之谏，终封齐王——裂痕已生。", events=["ev-qiwang"]),
             dict(year=-202, title="垓下之后徙楚王", type="收权", desc="垓下战后刘邦即驰入韩信军收其兵，徙封楚王。", events=["ev-gaxia"]),
             dict(year=-201, title="降为淮阴侯", type="削权", desc="有人告其谋反，刘邦伪游云梦擒之，降为淮阴侯，居长安而不得之国。", events=["ev-luwan-hanxin"]),
             dict(year=-196, title="钟室之祸", type="终结", desc="陈豨叛，韩信称病不从；吕后与萧何设计，斩于长乐宫钟室。", events=["ev-hanxin-die", "ev-chenxi"]),
         ]),
    dict(id="rel-liubang-xiangyu", a="刘邦", b="项羽",
         summary="从并肩反秦到楚汉对峙，七年之内由盟友转为死敌。",
         phases=[
             dict(year=-208, title="同列楚军", type="同盟", desc="项梁立楚怀王，刘邦归项梁麾下，与项羽同为楚将。", events=["ev-join-xiangliang"]),
             dict(year=-208, title="怀王之约", type="竞争", desc="约定「先入定关中者王之」，二人分兵西进与北上救赵。", events=["ev-huaiwang-yue"]),
             dict(year=-206, title="鸿门宴", type="危机", desc="刘邦先入关中又封函谷关，项羽欲击之，鸿门宴成为生死关。", events=["ev-block-hangu", "ev-hongmen"]),
             dict(year=-206, title="分封与屈就", type="压制", desc="项羽分封天下，改封刘邦为汉王，王巴蜀汉中。", events=["ev-feng-hanwang"]),
             dict(year=-205, title="彭城与荥阳", type="战争", desc="彭城大败，此后五年荥阳、成皋拉锯，屡败屡战。", events=["ev-pengcheng", "ev-xingyang"]),
             dict(year=-203, title="鸿沟议和", type="暂和", desc="中分天下，既而刘邦负约追击。", events=["ev-honggou"]),
             dict(year=-202, title="垓下与乌江", type="终结", desc="合围垓下，项羽自刎乌江。", events=["ev-gaxia", "ev-xiangyu-die"]),
         ]),
    dict(id="rel-liubang-xiaohe", a="刘邦", b="萧何",
         summary="「大用小疑」：最可靠的后方，也三次被猜忌。",
         phases=[
             dict(year=-209, title="沛县同起", type="故旧", desc="萧何为沛县主吏掾，与刘邦相善，共举沛县起兵。", events=["ev-peixian"]),
             dict(year=-206, title="追韩信", type="倚重", desc="萧何追回韩信，促成拜将；此后镇关中、给馈饷。", events=["ev-chase-hanxin"]),
             dict(year=-201, title="功臣第一", type="荣宠", desc="刘邦定萧何位次第一，赐剑履上殿。", events=["ev-xiaohe-first"]),
             dict(year=-196, title="三次受疑", type="猜忌", desc="汉十一年前后屡遭猜忌，汉十二年请开放上林苑触怒，被下狱械系。", events=["ev-xiaohe-jail"]),
             dict(year=-195, title="相国至终", type="复位", desc="王卫尉进言后被赦，刘邦临终仍以其为相国安排后事。", events=[]),
         ]),
    dict(id="rel-liubang-zhangliang", a="刘邦", b="张良",
         summary="「大用不疑」：谋而不居功，是唯一几乎未被猜忌的核心人物。",
         phases=[
             dict(year=-208, title="道遇归汉", type="相遇", desc="张良率众归刘邦，刘邦任其为厩将，言听计从。", events=["ev-west-pass"]),
             dict(year=-206, title="鸿门前后", type="定策", desc="结项伯、谏入秦宫、鸿门护主，多赖张良。", events=["ev-hongmen"]),
             dict(year=-205, title="下邑画策", type="战略", desc="提出以韩信、彭越、黥布三方并力破楚的总体规划。", events=["ev-xiayi"]),
             dict(year=-201, title="自请留侯", type="退身", desc="辞三万户，请封于留，渐退于权力中心。", events=["ev-zhangliang-feng"]),
             dict(year=-196, title="护太子", type="定储", desc="献计请商山四皓，稳固刘盈太子之位。", events=["ev-duochu"]),
         ]),
    dict(id="rel-liubang-lvhou", a="刘邦", b="吕后",
         summary="从结发到共治，王立群称刘邦「看懂男人而看不懂女人」。",
         phases=[
             dict(year=None, title="结发", type="婚姻", desc="吕公相面而嫁女，吕雉为刘邦生刘盈、鲁元公主。", events=["ev-lv-marriage"]),
             dict(year=None, title="望气寻夫", type="传奇", desc="传说吕后能凭云气找到芒砀山中的刘邦——王立群认为不可信。", events=["ev-mangdang"]),
             dict(year=-205, title="彭城被俘", type="共患难", desc="彭城败后吕后与太公为项羽所执，羁押二年余。", events=["ev-pengcheng"]),
             dict(year=-196, title="诛韩信", type="共谋", desc="韩信之死由吕后与萧何定计执行，刘邦归而「且喜且怜」。", events=["ev-hanxin-die"]),
             dict(year=-195, title="身后之局", type="托付", desc="刘邦临终定相国次序，吕后自此掌汉初朝政。", events=["ev-liubang-die"]),
         ]),
    dict(id="rel-liubang-fankuai", a="刘邦", b="樊哙",
         summary="连襟与猛将，鸿门护主，晚年几被刘邦所杀。",
         phases=[
             dict(year=-209, title="沛县从起", type="故旧", desc="樊哙以屠狗为业，随刘邦起兵，娶吕后之妹。", events=["ev-peixian"]),
             dict(year=-206, title="鸿门闯帐", type="护主", desc="带剑拥盾入军门，慷慨陈词，助刘邦脱身。", events=["ev-hongmen"]),
             dict(year=-206, title="还定三秦", type="征战", desc="屡为先登，赐爵列侯。", events=["ev-huan-ding-sanqin"]),
             dict(year=-195, title="几遭诛杀", type="猜忌", desc="樊哙以相国将兵讨燕，刘邦病中听谗命陈平、周勃即军中斩之，因刘邦崩而未果。", events=[]),
         ]),
    dict(id="rel-liubang-chenping", a="刘邦", b="陈平",
         summary="「不计易主」的代表：三易其主而终受重用。",
         phases=[
             dict(year=-205, title="自楚归汉", type="归附", desc="陈平由项羽部下投刘邦，被任为都尉，诸将譁然。", events=[]),
             dict(year=-204, title="反间范增", type="奇计", desc="以黄金行反间，项羽疑范增，范增愤而归乡道死。", events=["ev-xingyang"]),
             dict(year=-203, title="蹑足封齐", type="定策", desc="与张良同在榻旁蹑刘邦足，劝立韩信为齐王。", events=["ev-qiwang"]),
             dict(year=-200, title="白登解围", type="奇计", desc="白登被围七日，传说用陈平秘计得脱，其法史称「秘而不宣」。", events=["ev-baideng"]),
             dict(year=-195, title="奉命斩哙", type="执行", desc="与周勃同受命斩樊哙，见刘邦已崩而自免。", events=[]),
         ]),
    dict(id="rel-liubang-pengyue", a="刘邦", b="彭越",
         summary="联盟者而终被诛：游击断粮道之功与「反乎冤乎」之问。",
         phases=[
             dict(year=-205, title="结盟", type="联盟", desc="彭越以独立武装归汉，受封魏相国，专事断楚粮道。", events=["ev-xiayi"]),
             dict(year=-202, title="垓下会师", type="合围", desc="彭越、韩信如期不至，张良建议许以封地，遂会垓下。", events=["ev-gaxia"]),
             dict(year=-202, title="封梁王", type="封赏", desc="汉五年封为梁王，都定陶。", events=["ev-fenfeng-yixing"]),
             dict(year=-196, title="醢刑", type="终结", desc="以谋反罪被捕，赦为庶人徙蜀，吕后劝刘邦杀之，遂被醢。", events=["ev-pengyue-die"]),
         ]),
    dict(id="rel-liubang-qingbu", a="刘邦", b="黥布",
         summary="由楚将而汉王，由功臣而叛臣。",
         phases=[
             dict(year=None, title="楚之九江王", type="敌对阵营", desc="黥布为项羽封九江王，与项氏有隙。", events=[]),
             dict(year=-203, title="随何策反", type="归汉", desc="随何说黥布叛楚归汉，刘邦初见时倨傲而后厚遇。", events=["ev-xiayi"]),
             dict(year=-202, title="封淮南王", type="封赏", desc="垓下之后封淮南王。", events=["ev-fenfeng-yixing"]),
             dict(year=-196, title="反叛", type="终结", desc="韩信、彭越相继被诛，黥布惧而起兵，刘邦亲征，黥布败死。", events=["ev-qingbu-fan"]),
         ]),
    dict(id="rel-liubang-luwan", a="刘邦", b="卢绾",
         summary="最亲密的故人，最彻底的背叛——卢绾是刘邦信任体系崩塌的终点。",
         phases=[
             dict(year=None, title="同里同日生", type="故旧", desc="卢绾与刘邦同里、同日生，两家相善，自幼相亲。", events=["ev-peixian"]),
             dict(year=-206, title="汉中为太尉", type="亲信", desc="入汉中为将军，常侍中，出入卧内，他人莫能比。", events=["ev-feng-hanwang"]),
             dict(year=-202, title="封燕王", type="封赏", desc="臧荼反诛之后，卢绾被封燕王，群臣皆知其受宠。", events=["ev-luwan-hanxin"]),
             dict(year=-195, title="疑惧入胡", type="背叛", desc="陈豨事连及卢绾，刘邦召之不来，卢绾惧而亡入匈奴。", events=["ev-luwan-fan"]),
         ]),
    dict(id="rel-xiaohe-hanxin", a="萧何", b="韩信",
         summary="「成也萧何，败也萧何」——荐才者与执行者。",
         phases=[
             dict(year=-206, title="月下追信", type="知遇", desc="萧何独具慧眼，追回亡去的韩信并力荐。", events=["ev-chase-hanxin"]),
             dict(year=-206, title="促成拜将", type="推举", desc="萧何力劝刘邦设坛拜将，韩信由此登台。", events=["ev-appoint-general"]),
             dict(year=-196, title="诳入钟室", type="终结", desc="吕后欲诛韩信，萧何设计诳其入长乐宫，遂被杀。", events=["ev-hanxin-die"]),
         ]),
    dict(id="rel-xiangyu-hanxin", a="项羽", b="韩信",
         summary="执戟郎中的起点：项羽不用韩信，是用人史上最大的一次失手。",
         phases=[
             dict(year=None, title="执戟郎中", type="未用", desc="韩信在项羽麾下为郎中，数以策干项羽，羽不用。", events=[]),
             dict(year=-206, title="亡楚归汉", type="转投", desc="韩信亡楚归汉，最终成为击败项羽的军事主力。", events=["ev-chase-hanxin"]),
             dict(year=-205, title="武涉游说", type="拉拢", desc="项羽遣武涉说韩信反汉与楚三分天下，韩信不听。", events=[]),
             dict(year=-202, title="垓下合围", type="对决", desc="韩信将三十万军当之，十面埋伏，项羽败走。", events=["ev-gaxia"]),
         ]),
    dict(id="rel-xiangyu-fanzeng", a="项羽", b="范增",
         summary="亚父之信与反间之疑：项羽唯一顶级谋士的离场。",
         phases=[
             dict(year=-208, title="尊为亚父", type="信任", desc="范增为项羽谋主，年七十而辅项氏。", events=[]),
             dict(year=-206, title="鸿门主杀", type="主张", desc="范增力主击杀刘邦，项羽不用，范增叹「竖子不足与谋」。", events=["ev-hongmen"]),
             dict(year=-204, title="反间而去", type="离场", desc="陈平行反间，项羽疑范增，范增请归，未至彭城而死。", events=["ev-xingyang"]),
         ]),
    dict(id="rel-lvhou-hanxin", a="吕后", b="韩信",
         summary="执行者与被执行者：韩信之死的直接主导。",
         phases=[
             dict(year=-196, title="设计诛信", type="执行", desc="刘邦出征陈豨，吕后与萧何谋，诈称陈豨已破，诳韩信入贺而斩之。", events=["ev-hanxin-die"]),
         ]),
    dict(id="rel-lvhou-qifuren", a="吕后", b="戚夫人",
         summary="夺储之争的对立面，结局最惨烈的一段汉初宫廷史。",
         phases=[
             dict(year=None, title="宠衰而争", type="对立", desc="戚夫人得宠，吕后留守关中，渐疏远。", events=[]),
             dict(year=-196, title="易储之争", type="决战", desc="刘邦欲废刘盈立刘如意，赖张良、周昌、叔孙通等力争而止。", events=["ev-duochu"]),
             dict(year=-195, title="人彘之祸", type="报复", desc="刘邦崩后，吕后囚戚夫人、鸩杀赵王如意，为「人彘」之事。", events=[]),
         ]),
    dict(id="rel-lvhou-ruyi", a="吕后", b="刘如意",
         summary="从被护到被害：周昌之护终究敌不过吕后之怨。",
         phases=[
             dict(year=-198, title="封赵王", type="封王", desc="刘邦封戚夫人子如意为赵王。", events=["ev-ruyi-wang"]),
             dict(year=-195, title="周昌护赵", type="保护", desc="刘邦徙周昌为赵相以护之，吕后怨戚氏，周昌亦不能救。", events=["ev-liubang-die"]),
         ]),
    dict(id="rel-liubang-loujing", a="刘邦", b="娄敬",
         summary="一个戍卒改变国都位置——「一对好耳朵」的最佳注脚。",
         phases=[
             dict(year=-202, title="戍卒上书", type="进言", desc="娄敬以戍卒身份求见，建议都关中，张良赞成，刘邦即日西都。", events=["ev-capital"]),
             dict(year=-200, title="谏阻击匈奴", type="直谏", desc="白登之围前娄敬劝阻，刘邦不听，被械系广武；围解后刘邦道歉封侯。", events=["ev-baideng"]),
         ]),
]

# ---------------- 构造 persons ----------------
def build_persons():
    cnt = collections.Counter()
    eps_map = collections.defaultdict(list)
    for e in EPS:
        for p in e.get("people", []):
            n = norm_person(p)
            if not n:
                continue
            cnt[n] += 1
            if e["episode"] not in eps_map[n]:
                eps_map[n].append(e["episode"])

    # 只保留：在人物档案表中的，或出现集数 >= 2 的（过滤一次性提及的琐碎人名）
    names = set(cnt) | set(PERSON_META)
    out = []
    for n in sorted(names, key=lambda x: (-cnt.get(x, 0), x)):
        if n not in PERSON_META and cnt.get(n, 0) < 2:
            continue
        m = PERSON_META.get(n, {})
        out.append(dict(
            id="p-" + re.sub(r"[^\w\u4e00-\u9fff]", "", n),
            name=n,
            tier=m.get("tier", "B"),
            faction=m.get("faction", ""),
            role=m.get("role", ""),
            joinPhase=m.get("joinPhase", ""),
            joinPath=m.get("joinPath", ""),
            specialty=m.get("specialty", ""),
            trustUse=m.get("trustUse", ""),
            trustDoubt=m.get("trustDoubt", ""),
            titles=m.get("titles", []),
            note=m.get("note", ""),
            episodeCount=cnt.get(n, 0),
            episodes=sorted(eps_map.get(n, [])),
        ))
    return out


# ---------------- 构造 events ----------------
def build_events():
    # 收集抽取的原始事件名，按关键词归拢到 canonical
    raw = collections.defaultdict(set)
    for e in EPS:
        for x in e.get("events", []):
            nm = (x.get("name") or "").strip()
            if not nm:
                continue
            y = x.get("year")
            raw[nm].add(e["episode"])
    raw_eps = {k: sorted(v) for k, v in raw.items()}

    out = []
    used = set()
    for eid, title, year, yearText, imp, unit, people, places, kws, *rest in EVENTS:
        uncertain = bool(rest[0]) if rest else False
        hit_eps = set()
        aliases = []
        for nm, eps in raw_eps.items():
            if any(k in nm for k in kws):
                hit_eps |= set(eps)
                aliases.append(nm)
                used.add(nm)
        out.append(dict(
            id=eid, title=title, year=year, yearText=yearText,
            importance=imp, unit=unit,
            people=[norm_person(p) for p in people],
            places=places,
            uncertain=uncertain,
            lectureEpisodes=sorted(hit_eps),
            mentions=aliases[:12],
            summary="",
        ))
    # 未被归拢的事件，作为 B/C 级补充（只保留较关键的）
    rest_items = [(nm, eps) for nm, eps in raw_eps.items() if nm not in used]
    return out, rest_items, raw_eps


def build_sources():
    src = collections.Counter()
    detail = {}
    for e in EPS:
        for s in e.get("sources", []):
            b = (s.get("book") or "").strip()
            sec = (s.get("section") or "").strip()
            if not b:
                continue
            key = (b, sec)
            src[key] += 1
            detail.setdefault(key, {"episodes": set(), "topics": []})
            detail[key]["episodes"].add(e["episode"])
            if s.get("topic"):
                detail[key]["topics"].append(s["topic"][:60])
    out = []
    TYPE = {
        "史记": "primary_history", "汉书": "primary_history", "资治通鉴": "chronicle",
        "左传": "primary_history", "新唐书": "primary_history", "旧唐书": "primary_history",
    }
    for (b, sec), c in sorted(src.items(), key=lambda kv: -kv[1]):
        d = detail[(b, sec)]
        out.append(dict(
            id="src-" + re.sub(r"[^\w\u4e00-\u9fff]", "", b + sec),
            type=TYPE.get(b, "primary_history" if b in ("史记", "汉书") else "lecture" if "大风歌" in b else "modern_research"),
            title=b, section=sec, author="", url="",
            citations=c,
            episodes=sorted(d["episodes"]),
            topics=d["topics"][:4],
            reliabilityNote="",
        ))
    return out


def build_lectures():
    out = []
    for e in EPS:
        out.append(dict(
            id=f"lec-{e['episode']:02d}",
            episode=e["episode"],
            title=e["title"],
            unit=e["unit"],
            summary=e.get("summary", ""),
            people=sorted({norm_person(p) for p in e.get("people", []) if p}),
            events=[x.get("name") for x in e.get("events", [])],
            places=e.get("places", []),
            identityChanges=e.get("identityChanges", []),
            claims=e.get("claims", []),
            evaluations=e.get("evaluations", []),
            narration=e.get("narration", []),
            sources=e.get("sources", []),
            disputes=e.get("disputes", []),
            toVerify=e.get("toVerify", []),
            viz=e.get("viz", []),
        ))
    return out


def build_traits():
    """从 43/44/45 集 evaluations 构建刘邦特质系统。"""
    groups = {
        43: dict(id="trait-confidence", name="自信 / 韧性", episode=43, source="《大风歌》第 43 集《自信人生》",
                 desc="王立群认为刘邦一生极强的自信与韧性是他走出低谷的根本。但自信不等于永远判断正确——它也数次转化为盲目、冒进与过度乐观。"),
        44: dict(id="trait-charm", name="个人魅力 / 容人的雅量", episode=44, source="《大风歌》第 44 集《魅力四射》",
                 desc="敢于担当、共享成果、容人的雅量。王立群把它拆成四个「不计」：不计前嫌、不计易主、不计言语冲撞、不计来自何方。"),
        45: dict(id="trait-talent", name="用人", episode=45, source="《大风歌》第 45 集《用人有道》",
                 desc="王立群概括为五个维度：一双好眼睛、一对好耳朵、一副好头脑、一支好队伍、一个好心态。"),
    }
    out = []
    for ep, g in groups.items():
        e = [x for x in EPS if x["episode"] == ep][0]
        items = []
        for ev in e.get("evaluations", []):
            items.append(dict(
                label=ev.get("trait", ""),
                text=ev.get("text", ""),
                limit=ev.get("limit", ""),
                people=[norm_person(p) for p in (ev.get("people") or [])],
            ))
        g = dict(g)
        g["items"] = items
        g["count"] = len(items)
        out.append(g)
    return out


def main():
    persons = build_persons()
    events, rest_items, raw_eps = build_events()
    sources = build_sources()
    lectures = build_lectures()
    traits = build_traits()

    def dump(name, obj):
        p = os.path.join(OUT, name)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=1)
        print(f"{name:<18} {os.path.getsize(p)//1024:>4} KB")

    dump("persons.json", persons)
    dump("events.json", events)
    dump("relations.json", RELATIONS)
    dump("lectures.json", lectures)
    dump("sources.json", sources)
    dump("traits.json", traits)
    # 未归拢事件留档，供审计
    dump("events-unmerged.json", [{"name": n, "episodes": e} for n, e in rest_items])

    print(f"\n人物 {len(persons)} ｜ canonical 事件 {len(events)} ｜ 关系 {len(RELATIONS)} ｜ 讲座 {len(lectures)} ｜ 史料 {len(sources)} ｜ 特质组 {len(traits)}")
    print("未归拢原始事件名:", len(rest_items))
    miss = [e["title"] for e in events if not e["lectureEpisodes"]]
    print("未匹配到集数的 canonical 事件:", miss)


if __name__ == "__main__":
    main()
