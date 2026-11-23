#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""数据自检：跑在 CI 与本地提交前，防止改坏 recipes.normalized.json。

检查项：
1. 条数、id 唯一且连续；必填字段非空。
2. 所有派生 id（症状 / 证型 / 偏性 / 人群）都能在顶层字典里找到定义。
3. 风险层级、证型来源的取值合法。
4. 至少有 N 条能被自测命中的方剂（防止关键词表被改坏导致结果页空白）。

用法：python tools/validate.py   （失败时退出码 1）
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "recipes.normalized.json"

REQUIRED = ["name", "chapter_name", "page", "ingredients", "method", "effect"]
LEVELS = {"A", "B", "C"}
SOURCES = {"text", "inferred", "none"}


def main():
    if not DATA.exists():
        print("缺少 data/recipes.normalized.json，先跑 tools/build-data.py")
        return 1
    d = json.loads(DATA.read_text(encoding="utf-8"))
    recipes = d["recipes"]
    symptoms = {s["id"] for s in d["symptoms"]}
    patterns = {p["id"] for p in d["patterns"]}
    classes = set(d.get("contra_classes", {}))
    audiences = {a["id"] for a in d.get("audiences", [])}

    errors = []
    ids = []
    for r in recipes:
        ids.append(r["id"])
        tag = f"#{r['id']} {r.get('name', '?')}"
        for k in REQUIRED:
            if not str(r.get(k) or "").strip():
                errors.append(f"{tag}: 字段 {k} 为空")
        if r["risk"]["level"] not in LEVELS:
            errors.append(f"{tag}: 风险层级非法 {r['risk']['level']}")
        if r.get("pattern_source") not in SOURCES:
            errors.append(f"{tag}: pattern_source 非法 {r.get('pattern_source')}")
        for s in r["symptoms"]:
            if s not in symptoms:
                errors.append(f"{tag}: 未知症状 id {s}")
        for p in r["patterns"]:
            if p not in patterns:
                errors.append(f"{tag}: 未知证型 id {p}")
        for c in r.get("contra", {}).get("classes", []):
            if c not in classes:
                errors.append(f"{tag}: 未知偏性 {c}")
        for a in r.get("contra", {}).get("audiences", []):
            if a not in audiences:
                errors.append(f"{tag}: 未知人群 {a}")

    if len(set(ids)) != len(ids):
        errors.append("id 有重复")
    if ids != list(range(1, len(ids) + 1)):
        errors.append("id 不是 1..N 连续")

    matchable = sum(1 for r in recipes if r["symptoms"] and r["risk"]["level"] in {"A", "B"})
    if matchable < 200:
        errors.append(f"可被自测命中的方剂只有 {matchable} 条，关键词表可能被改坏")

    print(f"方剂 {len(recipes)} 条 / 症状 {len(symptoms)} / 证型 {len(patterns)} / 偏性 {len(classes)} / 人群 {len(audiences)}")
    print(f"可被自测命中：{matchable} 条（甲乙层且有症状标签）")
    if errors:
        print(f"\n发现 {len(errors)} 个问题：")
        for e in errors[:40]:
            print("  -", e)
        return 1
    print("自检通过。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
