#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把原始 jsonl 规范化成前端可直接消费的 recipes.normalized.json。

派生字段全部是「规则抽取 + 可人工覆写」的思路：
- symptoms / patterns 由关键词表命中，命中不到就留空，不做猜测；
- risk 按成分表分级，宁严勿松；
- 原始文本（原料/制作/用法/功效/注意）一字不改，只做结构化，便于回溯。

用法：python tools/build-data.py
输出：data/recipes.normalized.json + data/quality-report.md
"""

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "释永信房中补肾秘方.jsonl"
OUT_JSON = ROOT / "data" / "recipes.normalized.json"
OUT_REPORT = ROOT / "data" / "quality-report.md"
SAFETY_PATH = ROOT / "tools" / "herb-safety.json"
SAFETY = json.loads(SAFETY_PATH.read_text(encoding="utf-8"))
SAFETY_CLASSES = SAFETY["classes"]
SAFETY_HERBS = SAFETY["herbs"]
AUDIENCES = SAFETY["audiences"]

# ---------------------------------------------------------------- 症状词表
# primary：原书 14 章的病名，用于「自测第一层」的归类
PRIMARY = [
    ("yang_wei", "阳痿", ["阳痿", "阳萎", "阳事不举", "痿而不举", "起痿", "坚而不久"]),
    ("yi_jing", "遗精", ["遗精", "滑精", "梦遗", "精泄无度"]),
    ("zao_xie", "早泄", ["早泄"]),
    ("yao_tong", "肾虚腰痛", ["腰痛", "腰膝酸", "腰酸", "腰膝无力", "腰膝冷痛", "腰脊酸痛", "腰膝疼痛"]),
    ("xing_jian", "性功能减退", ["性功能", "性欲减退", "性欲低下", "性欲淡漠", "性生活淡漠", "性欲不振"]),
    ("jing_ye", "精液异常", ["精液", "精少", "精薄", "精冷", "血精", "精子", "精中带血", "精不液化"]),
    ("bu_yu", "不育", ["不育", "无子", "嗣育"]),
    ("zao_shuai", "早衰", ["早衰", "衰老", "防衰", "须发早白", "白发", "延年", "益寿"]),
    ("geng_nian", "更年期", ["更年期"]),
    ("fang_lao", "房劳过度", ["房劳", "虚劳", "虚痨", "房事过度", "房室劳伤"]),
    ("gao_wan_fa_yu", "睾丸发育不良", ["睾丸发育", "睾丸偏小", "睾丸偏坠", "睾丸萎缩"]),
    ("yin_jing", "阴茎短小", ["阴茎短小", "阴茎发育不良", "玉茎短小"]),
    ("bu_she_jing", "不射精", ["不射精", "射精不能", "射精无力", "射精疼痛"]),
    ("gao_wan_yan", "睾丸炎", ["睾丸炎", "睾丸肿痛", "睾丸疼痛", "阴囊红肿", "子痈"]),
]

# secondary：兼症，用于「自测第二层」的寒热虚实判断
SECONDARY = [
    ("tou_yun", "头晕耳鸣", ["头晕", "头昏", "眩晕", "耳鸣", "耳聋", "视物昏花"]),
    ("pi_lao", "神疲乏力", ["倦怠", "疲乏", "乏力", "精神不振", "神疲", "体虚", "气短", "气不接续", "精神疲乏"]),
    ("wei_han", "畏寒肢冷", ["畏寒", "肢冷", "手足不温", "四肢不温", "怕冷", "形寒"]),
    ("shi_mian", "心悸失眠", ["失眠", "心烦", "多梦", "心悸", "心神不宁"]),
    ("dao_han", "潮热盗汗", ["潮热", "盗汗", "五心烦热", "手足心热", "骨蒸"]),
    ("kou_gan", "口干咽燥", ["口干", "咽干", "口渴", "干咳", "咯血", "咳嗽"]),
    ("pi_wei", "食少便溏", ["便溏", "腹泻", "纳差", "食少", "食欲不振", "腹胀", "脾虚"]),
    ("niao_pin", "小便频数", ["尿频", "小便频", "夜尿", "小便清长", "小便余沥"]),
    ("shi_re_zheng", "口苦尿黄", ["口苦", "尿黄", "阴囊潮湿", "苔黄腻", "小便黄"]),
    ("shou_ruo", "形体消瘦", ["消瘦", "形体消瘦", "赢瘦", "羸瘦"]),
]

# ---------------------------------------------------------------- 证型规则
# 只从「治法 + 适用于」文本里命中，命中不到标 unrated，不做推断
PATTERNS = [
    ("shen_yang", "肾阳虚", ["肾阳", "阳虚", "命门火衰", "温肾", "壮阳", "暖腰膝", "温补下元"]),
    ("shen_yin", "肾阴虚", ["肾阴", "阴虚", "滋阴", "养阴", "滋肾"]),
    ("jing_kui", "肾精亏", ["肾精", "精血亏", "精血不足", "益精", "填精", "生精", "补精髓",
                            "肝肾虚损", "肝肾不足"]),
    ("shen_qi", "肾气虚", ["肾气", "肾气不固", "固精", "补肾气", "益气固肾"]),
    ("fei_shen_yin", "肺肾阴虚", ["肺肾阴", "润肺", "养肺"]),
    ("pi_shen_yang", "脾肾阳虚", ["脾肾阳", "温脾", "健脾", "补脾"]),
    ("shi_re", "湿热下注", ["湿热", "清热", "利湿", "渗湿"]),
    ("qi_xue_yu", "气滞血瘀", ["血瘀", "行气", "活血", "散结", "化瘀"]),
    ("qi_xue_liang", "气血两虚", ["气血", "补气养血", "大补元气", "益气养血"]),
]

# ---------------------------------------------------------------- 风险成分
TOXIC = ["附子", "川乌", "草乌", "马钱子", "硫黄", "朱砂", "水蛭", "蜈蚣", "全蝎", "斑蝥", "阳起石", "钟乳石", "罂粟壳"]
# 药酒/酒剂：真的以酒为溶媒，属于 C 层
WINE_SOAK = ["泡酒", "浸酒", "酒浸", "药酒", "酒剂", "酒服"]
# 烹饪用酒：汤里加黄酒/绍酒去腥，酒精基本挥发，只做提示不降级
COOK_WINE = ["黄酒", "绍酒", "料酒", "米酒", "白酒"]
ANIMAL = ["鹿鞭", "牛鞭", "狗肾", "羊外肾", "海马", "蛤蚧", "紫河车", "鹿尾", "驴鞭", "虎鞭", "鹿茸"]
WARM_DRY = ["鹿茸", "鹿鞭", "鹿尾", "海马", "蛤蚧", "仙茅", "淫羊藿", "仙灵脾", "肉桂", "附子",
            "牛鞭", "狗肾", "羊肾", "锁阳", "巴戟天", "补骨脂", "蛇床子", "韭子", "阳起石", "钟乳石"]
# 中药材入膳（非药食同源），成分表出现任一即归 B 层
HERBS = ["鹿茸", "鹿鞭", "鹿尾", "鹿角胶", "鹿角霜", "海马", "蛤蚧", "紫河车", "淫羊藿", "仙灵脾", "仙茅",
         "巴戟天", "肉苁蓉", "锁阳", "菟丝子", "杜仲", "续断", "狗脊", "补骨脂", "蛇床子", "益智仁",
         "沙苑子", "冬虫夏草", "熟地黄", "熟地", "山茱萸", "何首乌", "黄精", "人参", "西洋参", "黄芪",
         "当归", "川芎", "白芍", "肉桂", "附子", "党参", "五味子", "覆盆子", "女贞子", "桑螵蛸",
         "韭子", "韭菜子", "阳起石", "钟乳石", "龟甲", "鳖甲", "阿胶", "天冬", "麦冬", "牛膝",
         "柴胡", "车前子", "黄柏", "知母", "川楝子", "水蛭", "蜈蚣", "全蝎", "马钱子", "硫黄",
         "牛鞭", "狗肾", "羊外肾", "驴鞭", "香附"]

APPLY_RE = re.compile(r"适用于(.+?)(?:。|$)")

# ------------------------------------------------------------ 禁忌规则
# 治法 → 证型的兜底推断（仅用于原文没写证型的 40 方，结果标记为 inferred）
INFER = [
    ("shen_yang", ["温肾", "温补", "壮阳", "助阳", "补火", "暖腰", "暖肾"]),
    ("shen_yin", ["滋阴", "养阴", "生津", "润燥", "清虚热"]),
    ("jing_kui", ["生精", "填精", "益精", "补髓", "种子"]),
    ("shen_qi", ["固精", "涩精", "止遗", "固摄", "补肾气", "缩尿"]),
    ("pi_shen_yang", ["健脾", "补脾", "和胃", "温脾"]),
    ("qi_xue_liang", ["养血", "补血", "益气", "补气", "大补"]),
    ("shi_re", ["清热", "利湿", "渗湿", "解毒", "导湿"]),
    ("qi_xue_yu", ["活血", "行气", "散结", "化瘀", "通络"]),
]

# 参与「与你的寒热虚实是否相冲」判断的核心偏性；
# 辛温香燥、含酒、高糖高脂、内脏、补气、动物药多为调味或次要因素，只展示不参与冲突判定
CORE_CLASSES = ["toxic", "warm_dry", "rich", "blood_move", "astringent", "cold"]

_HERB_RE = re.compile("|".join(sorted((re.escape(h) for h in SAFETY_HERBS), key=len, reverse=True)))


def match_herbs(text):
    """按最长匹配抓出原料里出现的已知药材，保持出现顺序、去重。"""
    if not text:
        return []
    text = text.replace("香附子", "香附")
    out = []
    for m in _HERB_RE.finditer(text):
        h = m.group(0)
        if h not in out:
            out.append(h)
    return out


def build_contraindications(ingredients):
    """由原料里的药材偏性推出注意事项。规则性提示，不是临床判断。"""
    herbs = match_herbs(ingredients)
    classes, audiences = [], []
    for h in herbs:
        for c in SAFETY_HERBS[h].get("classes", []):
            if c in SAFETY_CLASSES and c not in classes:
                classes.append(c)
            if c not in CORE_CLASSES:
                continue
            for a in SAFETY_CLASSES.get(c, {}).get("audiences", []):
                if a not in audiences:
                    audiences.append(a)
    notes = [{"herb": h, "note": SAFETY_HERBS[h]["note"]} for h in herbs if SAFETY_HERBS[h].get("note")]
    return {"classes": classes, "audiences": audiences, "herbs": herbs, "notes": notes}


def infer_patterns(effect):
    for pid, words in INFER:
        if any(w in effect for w in words):
            return [pid]
    return []



def hits(text, words):
    # 「香附子」是香附，不是附子，先归一避免误判为乌头类毒性药
    text = text.replace("香附子", "香附")
    return [w for w in words if w in text]


def build_symptoms(text):
    out = []
    for sid, name, words in PRIMARY + SECONDARY:
        if hits(text, words):
            out.append(sid)
    return out


def build_patterns(text):
    out = []
    for pid, _, words in PATTERNS:
        if hits(text, words):
            out.append(pid)
    return out


def classify_risk(ingredients, method, usage):
    ing = ingredients or ""
    io = ing + (method or "") + (usage or "")
    tags = []
    level = "A"

    if hits(ing, TOXIC):
        level = "C"
        tags.append("有毒药材")
    if hits(io, WINE_SOAK):
        level = "C"
        tags.append("药酒")
    if hits(ing, COOK_WINE):
        tags.append("含酒(烹饪)")
    if hits(ing, HERBS):
        if level != "C":
            level = "B"
    if hits(ing, ANIMAL):
        tags.append("动物生殖器")
        if level == "A":
            level = "B"
    if hits(ing, WARM_DRY):
        tags.append("温燥")
    if hits(ing, ["附子", "川乌", "草乌"]):
        tags.append("需久煎")
    return {"level": level, "tags": tags}


def main():
    raw = [json.loads(line) for line in SRC.read_text(encoding="utf-8").splitlines() if line.strip()]

    symptom_names = {sid: sname for sid, sname, _ in PRIMARY + SECONDARY}
    pattern_names = {pid: pname for pid, pname, _ in PATTERNS}
    primary_ids = {pid for pid, _, _ in PRIMARY}

    recipes = []
    for r in raw:
        effect = r.get("effect") or ""
        ingredients = r.get("ingredients") or ""
        # 症状/证型同时看「治法+适用于」，因为「阳痿」这类词常只出现在功效后半句
        scope = effect
        symptoms = build_symptoms(scope)
        patterns = build_patterns(scope)
        if patterns:
            pattern_source = "text"
        else:
            patterns = infer_patterns(effect)
            pattern_source = "inferred" if patterns else "none"
        m = APPLY_RE.search(effect)
        contra = build_contraindications(ingredients)
        recipes.append({
            "id": r["id"],
            "name": r["name"],
            "chapter": r["category"],
            "chapter_name": r["category"].split("、", 1)[-1],
            "page": r["page"],
            "ingredients": ingredients,
            "method": r.get("method") or "",
            "usage": r.get("usage") or "",
            "effect": effect,
            "caution": r.get("caution") or "",
            "therapies": effect.split("适用于")[0].strip("。 ").split("，"),
            "indications": m.group(1).strip("。 ") if m else "",
            "symptoms": symptoms,
            "patterns": patterns,
            "pattern_source": pattern_source,
            "risk": classify_risk(ingredients, r.get("method"), r.get("usage")),
            "contra": contra,
        })

    payload = {
        "meta": {
            "source": "释永信房中补肾秘方.pdf（199 页，OCR 后逐页核对重录）",
            "count": len(recipes),
            "chapters": len(Counter(r["chapter"] for r in recipes)),
            "disclaimer": "本项目仅供学习与娱乐，内容为中医药膳知识整理，不构成医疗建议，不能替代面诊。",
            "built_by": "tools/build-data.py",
            "contra_rules": "tools/herb-safety.json",
        },
        "audiences": [{"id": k, "label": v["label"], "from": v.get("from", [])} for k, v in AUDIENCES.items()],
        "contra_classes": {k: {"label": v["label"], "text": v["text"], "audiences": v.get("audiences", [])}
                           for k, v in SAFETY_CLASSES.items()},
        "symptoms": [{"id": sid, "name": name, "level": "primary"} for sid, name, _ in PRIMARY]
                  + [{"id": sid, "name": name, "level": "secondary"} for sid, name, _ in SECONDARY],
        "patterns": [{"id": pid, "name": name} for pid, name, _ in PATTERNS],
        "recipes": recipes,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    # ------------------------------------------------------------ 质量报告
    total = len(recipes)
    per_symptom = Counter(s for r in recipes for s in r["symptoms"])
    per_pattern = Counter(p for r in recipes for p in r["patterns"])
    risk = Counter(r["risk"]["level"] for r in recipes)
    no_primary = [r for r in recipes if not (set(r["symptoms"]) & primary_ids)]
    unrated = [r for r in recipes if not r["patterns"]]
    inferred = [r for r in recipes if r["pattern_source"] == "inferred"]
    tag = Counter(t for r in recipes for t in r["risk"]["tags"])
    contra_any = [r for r in recipes if r["contra"]["audiences"]]
    contra_cls = Counter(c for r in recipes for c in r["contra"]["classes"])
    contra_aud = Counter(a for r in recipes for a in r["contra"]["audiences"])

    lines = [
        "# 数据质量报告",
        "",
        f"- 方剂总数：**{total}**",
        f"- 章节数：{payload['meta']['chapters']}",
        f"- 带症状标签：{total - len(no_primary)} / {total}（{(total-len(no_primary))*100//total}%）",
        f"- 证型：原文明确 {total - len(unrated)} 条，据治法推断 {len(inferred)} 条，"
        f"仍无 {len(unrated)} 条（{len(unrated)*100//total}%）",
        f"- 原文「宜忌」：{sum(1 for r in recipes if r['caution'])} / {total}",
        f"- 按成分推出的注意事项：{len(contra_any)} / {total}（{len(contra_any)*100//total}%）",
        "",
        "## 风险分层",
        "",
        f"| 层级 | 方数 | 含义 |",
        f"| --- | --- | --- |",
        f"| A | {risk.get('A',0)} | 药食同源为主，可展示完整配方 |",
        f"| B | {risk.get('B',0)} | 含中药材，需标注证型与禁忌 |",
        f"| C | {risk.get('C',0)} | 有毒药材/含酒/动物生殖器，仅作知识展示 |",
        "",
        "标签分布：" + "、".join(f"{k} {v}" for k, v in tag.most_common()),
        "",
        "## 注意事项（按成分规则推出）",
        "",
        "| 偏性 | 涉及方数 |",
        "| --- | --- |",
    ]
    for c in contra_cls.most_common():
        lines.append(f"| {SAFETY_CLASSES[c[0]]['label'] if c[0] in SAFETY_CLASSES else c[0]} | {c[1]} |")
    lines += ["", "| 需提醒的人群 | 涉及方数 |", "| --- | --- |"]
    for a, n in contra_aud.most_common():
        lines.append(f"| {AUDIENCES[a]['label'] if a in AUDIENCES else a} | {n} |")
    lines += [
        "",
        "## 症状 → 候选方数量（多对多）",
        "",
        "| 症状 | 候选方数 |",
        "| --- | --- |",
    ]
    for sid, name, _ in PRIMARY:
        lines.append(f"| {name} | {per_symptom.get(sid, 0)} |")
    lines += ["", "## 证型覆盖", "", "| 证型 | 命中方数 | 来源 |", "| --- | --- | --- |"]
    for pid, name, _ in PATTERNS:
        src_inf = sum(1 for r in recipes if r["pattern_source"] == "inferred" and pid in r["patterns"])
        lines.append(f"| {name} | {per_pattern.get(pid, 0)} | 原文 {per_pattern.get(pid, 0) - src_inf} / 推断 {src_inf} |")
    lines += [
        "",
        "## 已知缺口",
        "",
        f"1. 仍有 {len(unrated)} 方既无证型描述、也无法从治法推断，自测只能按症状命中，不给证型强度。",
        f"2. {len(inferred)} 方的证型是据治法推的（非原文），结果页会标「推断」。",
        f"3. 原文「宜忌」只有 {sum(1 for r in recipes if r['caution'])} 条，其余靠 tools/herb-safety.json 的规则推导；"
        "规则表由人工整理，覆盖 100 余味常见药材，罕见药材可能漏标，需中医复核。",
        "4. 症状标签由关键词命中，存在漏标（同义表述未收录），需人工抽检。",
        "5. 不做药物相互作用、不做与西药同服的判断，也不做剂量安全评估。",
    ]
    OUT_REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"已生成 {OUT_JSON.relative_to(ROOT)}（{OUT_JSON.stat().st_size/1024:.0f} KB）")
    print(f"已生成 {OUT_REPORT.relative_to(ROOT)}")
    print("风险分布", dict(risk), "| 无证型", len(unrated), "| 无主症", len(no_primary))


if __name__ == "__main__":
    main()
