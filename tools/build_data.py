# -*- coding: utf-8 -*-
"""识字课程数据构建脚本。

功能：
1. 依据《通用规范汉字表》一级字表 + 清华字频表，筛选出 3000 个常用字；
2. 合并人工编排的“启蒙认字 / 字族与结构”课程，其余字按字频分层、按部首归组；
3. 为每个字生成拼音、部首、笔画数、组词（含拼音与解释）、例句；
4. 将笔顺数据（hanzi-writer-data）按 Unicode 码点复制到 ``data/strokes``；
5. 输出 ``data/chars.json`` 与 ``data/curriculum.json`` 供网页读取。

用法（在项目根目录执行）::

    python tools\\build_data.py
"""

from __future__ import annotations

import json
import math
import os
import re
import shutil
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import jieba
from pypinyin import Style, lazy_pinyin, pinyin

sys.path.insert(0, str(Path(__file__).parent))
from curated_groups import STAGE1_GROUPS, STAGE2_GROUPS  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
CACHE = TOOLS / "_cache"
DATA_OUT = ROOT / "data"
TOTAL_CHARS = 3000

RAW = "https://raw.githubusercontent.com"
SOURCES = {
    "word.json": f"{RAW}/pwxcoo/chinese-xinhua/master/data/word.json",
    "ci.json": f"{RAW}/pwxcoo/chinese-xinhua/master/data/ci.json",
    "tygf.txt": f"{RAW}/lunatao/chinese_character/master/character.txt",
    "freq6763.txt": (
        f"{RAW}/sxei/pinyinjs/master/other/"
        "%E5%B8%B8%E7%94%A86763%E4%B8%AA%E6%B1%89%E5%AD%97"
        "%E4%BD%BF%E7%94%A8%E9%A2%91%E7%8E%87%E8%A1%A8.txt"
    ),
}

# 部首：名称 -> 含义提示（只有这些部首会被用来“按偏旁归组”）
RADICALS: Dict[str, Tuple[str, str]] = {
    "氵": ("三点水", "和水有关"),
    "扌": ("提手旁", "和手的动作有关"),
    "木": ("木字旁", "和树木、木头有关"),
    "口": ("口字旁", "和嘴巴、说话、吃喝有关"),
    "亻": ("单人旁", "和人有关"),
    "艹": ("草字头", "和花草植物有关"),
    "月": ("月字旁", "多和身体有关（肉月旁）"),
    "纟": ("绞丝旁", "和丝线、布有关"),
    "土": ("土字旁", "和泥土、地方有关"),
    "辶": ("走之底", "和走路、行动有关"),
    "讠": ("言字旁", "和说话有关"),
    "日": ("日字旁", "和太阳、时间、光亮有关"),
    "忄": ("竖心旁", "和心情、想法有关"),
    "阝": ("耳刀旁", "和山丘、城镇有关"),
    "女": ("女字旁", "和女性有关"),
    "宀": ("宝盖头", "和房屋有关"),
    "钅": ("金字旁", "和金属有关"),
    "贝": ("贝字旁", "和钱财有关"),
    "心": ("心字底", "和心思、感情有关"),
    "火": ("火字旁", "和火有关"),
    "石": ("石字旁", "和石头有关"),
    "禾": ("禾木旁", "和庄稼、粮食有关"),
    "刂": ("立刀旁", "和刀、切割有关"),
    "目": ("目字旁", "和眼睛、看有关"),
    "竹": ("竹字头", "和竹子有关"),
    "王": ("王字旁", "和玉石有关"),
    "虫": ("虫字旁", "和昆虫、小动物有关"),
    "广": ("广字头", "和房屋有关"),
    "页": ("页字旁", "和头部有关"),
    "山": ("山字旁", "和山有关"),
    "大": ("大字头", "和大、人的姿势有关"),
    "巾": ("巾字旁", "和布、毛巾有关"),
    "力": ("力字旁", "和力气有关"),
    "车": ("车字旁", "和车有关"),
    "足": ("足字旁", "和脚、走路有关"),
    "尸": ("尸字头", "和身体、房屋有关"),
    "攵": ("反文旁", "和动作、敲打有关"),
    "彳": ("双人旁", "和行走、道路有关"),
    "田": ("田字旁", "和田地有关"),
    "米": ("米字旁", "和粮食有关"),
    "马": ("马字旁", "和马有关"),
    "疒": ("病字旁", "和生病有关"),
    "犭": ("反犬旁", "和动物有关"),
    "门": ("门字框", "和门有关"),
    "冫": ("两点水", "和冰、冷有关"),
    "灬": ("四点底", "和火、热有关"),
    "穴": ("穴宝盖", "和洞穴有关"),
    "酉": ("酉字旁", "和酒有关"),
    "耳": ("耳字旁", "和耳朵、听有关"),
    "衤": ("衣字旁", "和衣服有关"),
    "饣": ("食字旁", "和吃的东西有关"),
    "雨": ("雨字头", "和下雨、天气有关"),
    "鸟": ("鸟字旁", "和鸟有关"),
    "羽": ("羽字旁", "和羽毛、飞有关"),
    "礻": ("示字旁", "和祭祀、祝福有关"),
    "弓": ("弓字旁", "和弓箭、弯曲有关"),
    "囗": ("国字框", "和围起来的地方有关"),
    "皿": ("皿字底", "和器皿有关"),
    "戈": ("戈字旁", "和兵器有关"),
    "走": ("走字旁", "和走路有关"),
    "欠": ("欠字旁", "和张口、呼吸有关"),
    "隹": ("隹字旁", "和鸟有关"),
    "糸": ("绞丝底", "和丝线有关"),
    "子": ("子字旁", "和孩子有关"),
    "衣": ("衣字旁", "和衣服有关"),
    "寸": ("寸字旁", "和手、法度有关"),
    "厂": ("厂字头", "和山崖、房屋有关"),
    "又": ("又字旁", "和手有关"),
    "儿": ("儿字底", "和人有关"),
}

# 常见多音字：只有这些字才会在页面上提示“还读 ××”，避免显示生僻读音
POLYPHONES = set(
    "了的地得和都还行长重好会为着给背分数只种没看觉乐差中少干假弄倒便发转传角降空率"
    "号切调称单薄将朝处间量应相教处省斗曲场冲创供几恶更观合夹结卷咳累模拗宁骨"
    "率载藏曾盛哪么什为扎折解兴曝参调"
)

STAGES_AUTO = [
    (3, "基础识字", "🌿", "最常用的高频字，按偏旁分组，认一认同一家族的字。", 0.23),
    (4, "进阶识字", "🌳", "常见字继续扩展，同偏旁的字一起学，举一反三。", 0.27),
    (5, "提高识字", "🚀", "阅读课外书常遇到的字，一点点积累。", 0.27),
    (6, "拓展识字", "🏆", "最后一段旅程，学完就能认识常用三千字啦！", 0.23),
]


# ---------------------------------------------------------------------------
# 数据下载与读取
# ---------------------------------------------------------------------------
def ensure_sources() -> None:
    """确保原始数据已缓存到 ``tools/_cache``，缺失则自动下载。"""
    CACHE.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        path = CACHE / name
        if path.exists() and path.stat().st_size > 0:
            continue
        print(f"下载 {name} ...")
        urllib.request.urlretrieve(url, path)


def load_char_pool() -> Tuple[List[str], Dict[str, int]]:
    """读取一级字表与字频表，返回 (一级字表, 字->频率名次)。"""
    lines = (CACHE / "tygf.txt").read_text(encoding="utf-8").split("\n")
    level1 = [ln.split()[1] for ln in lines if re.match(r"^\d{4} ", ln)][:3500]
    freq_text = (CACHE / "freq6763.txt").read_text(encoding="utf-8")
    freq_str = re.search(r'hanzipinlv\s*=\s*"([^"]+)"', freq_text).group(1)
    rank = {c: i for i, c in enumerate(freq_str)}
    # 字频表缺失但非常常用的字，手工补一个名次
    for ch, r in {"省": 400, "零": 900}.items():
        rank.setdefault(ch, r)
    return level1, rank


# ---------------------------------------------------------------------------
# 词语：jieba 词频 + 新华词典解释
# ---------------------------------------------------------------------------
class WordBank:
    """组词查询器：按词频挑选适合儿童的常用词，并配上拼音与解释。"""

    PROPER_POS = {"nr", "ns", "nt", "nz", "nrt", "nrfg", "eng"}
    BAD_POS = {"m", "mq", "x"}

    def __init__(self, level1: set[str]) -> None:
        self.level1 = level1
        self.index: Dict[str, List[Tuple[str, int]]] = defaultdict(list)
        self.fallback: Dict[str, List[Tuple[str, int]]] = defaultdict(list)
        self._load_jieba()
        self.ci = self._load_ci()
        self.notes = self._load_notes()

    @staticmethod
    def _load_notes() -> Dict[str, str]:
        """读取人工审核的词语解释 ``tools/word_notes.txt``。"""
        notes: Dict[str, str] = {}
        path = TOOLS / "word_notes.txt"
        if path.exists():
            for ln in path.read_text(encoding="utf-8").splitlines():
                if ln.strip() and not ln.startswith("#") and "|" in ln:
                    word, exp = ln.split("|", 1)
                    notes[word.strip()] = exp.strip()
        return notes

    def _load_jieba(self) -> None:
        dict_path = Path(jieba.__file__).parent / "dict.txt"
        with open(dict_path, encoding="utf-8") as fh:
            for line in fh:
                parts = line.split()
                if len(parts) < 3:
                    continue
                word, freq, pos = parts[0], int(parts[1]), parts[2]
                if not 2 <= len(word) <= 3 or pos in self.PROPER_POS:
                    continue
                if freq < 30 or not all(ch in self.level1 for ch in word):
                    continue
                # 数词、量词、符号类词放入备用索引，仅在没有其他词时使用
                target = self.fallback if pos in self.BAD_POS else self.index
                for ch in set(word):
                    target[ch].append((word, freq))
        for idx in (self.index, self.fallback):
            for ch in idx:
                idx[ch].sort(key=lambda x: -x[1])

    @staticmethod
    def _load_ci() -> Dict[str, str]:
        items = json.load(open(CACHE / "ci.json", encoding="utf-8"))
        return {it["ci"]: it["explanation"] for it in items}

    @staticmethod
    def clean_explanation(text: str) -> str:
        """清洗词典解释：只保留第一个义项，去掉编号与过长内容。"""
        t = text.replace("\n", "").replace("﹑", "、").replace("\u3000", "")
        t = re.split(r"\s*(?:\d{1,2}\s*[\.．、]|[①②③④⑤⑥])\s*(?=\S)", t.strip())
        t = [s for s in t if s.strip()]
        if not t:
            return ""
        first = t[0].strip().replace("﹐", "，").replace("﹔", "；")
        # 词典里的举例用 ～ / ㄧ / ｜ 分隔，只保留它们之前的释义
        first = re.split(r"[～ㄧ｜|]", first)[0]
        first = re.sub(r"[〈《(（\[].{0,30}?[〉》)）\]]", "", first)
        first = re.sub(r"^[a-zA-Z\s·]+", "", first)
        if re.search(
            r"亦作|亦称|亦|犹|同[\"“”]|见[\"“”]|见。|旧指|〈|篇名|复姓|诗歌|古代|古时|旧时|"
            r"迷信|传之|又称|又名|谓|古指|山名|姓|某某",
            first,
        ):
            return ""
        # 过长则按句号截取
        if len(first) > 34:
            first = first.split("。")[0]
        first = first.strip("；;，, ")
        if len(first) > 40 or len(first) < 2:
            return ""
        if first and first[-1] not in "。！？":
            first += "。"
        return first

    def pick(self, ch: str, limit: int = 3) -> List[List[str]]:
        """为单个字挑选组词，返回 [[词, 拼音, 解释], ...]。"""
        cands = self.index.get(ch) or self.fallback.get(ch, [])
        with_exp: List[Tuple[str, str]] = []
        without: List[str] = []
        for word, _freq in cands[:40]:
            exp = self.notes.get(word) or self.clean_explanation(self.ci.get(word, ""))
            if exp:
                with_exp.append((word, exp))
            else:
                without.append(word)
        chosen: List[Tuple[str, str]] = []
        used_tail = set()
        for word, exp in with_exp:
            key = word.replace(ch, "")
            if key in used_tail or any(word in w or w in word for w, _ in chosen):
                continue
            used_tail.add(key)
            chosen.append((word, exp))
            if len(chosen) >= limit:
                break
        for word in without:
            if len(chosen) >= limit:
                break
            if any(word in w or w in word for w, _ in chosen):
                continue
            chosen.append((word, ""))
        return [
            [w, " ".join(lazy_pinyin(w, style=Style.TONE)), exp] for w, exp in chosen
        ]


# ---------------------------------------------------------------------------
# 人工内容
# ---------------------------------------------------------------------------
def load_curated_details() -> Dict[str, Tuple[str, List[str], str]]:
    """读取 ``curated_details*.txt``，返回 字 -> (释义, 词列表, 例句)。"""
    result: Dict[str, Tuple[str, List[str], str]] = {}
    for path in sorted(TOOLS.glob("curated_details*.txt")):
        for ln in path.read_text(encoding="utf-8").splitlines():
            ln = ln.strip()
            if not ln or ln.startswith("#"):
                continue
            parts = ln.split("|")
            if len(parts) < 4 or len(parts[0]) != 1:
                print(f"[警告] 无法解析行：{ln[:30]}")
                continue
            result[parts[0]] = (parts[1], parts[2].split(), parts[3])
    return result


# ---------------------------------------------------------------------------
# 课程编排
# ---------------------------------------------------------------------------
def split_balanced(items: List[str], max_size: int) -> List[List[str]]:
    """把列表均匀切成每块不超过 ``max_size`` 的若干块。"""
    n_chunks = max(1, math.ceil(len(items) / max_size))
    size = math.ceil(len(items) / n_chunks)
    return [items[i : i + size] for i in range(0, len(items), size)]


def build_auto_groups(
    chars: List[str],
    rank: Dict[str, int],
    radical_of: Dict[str, str],
    strokes_of: Dict[str, int],
) -> List[dict]:
    """把一批字按部首归组，返回分组列表（尚未编号）。"""
    by_rad: Dict[str, List[str]] = defaultdict(list)
    misc: List[str] = []
    for c in chars:
        rad = radical_of.get(c, "")
        by_rad[rad].append(c) if rad in RADICALS else misc.append(c)

    groups: List[dict] = []
    for rad, lst in by_rad.items():
        if len(lst) < 4:
            misc.extend(lst)
            continue
        lst.sort(key=lambda c: rank[c])
        name, meaning = RADICALS[rad]
        chunks = split_balanced(lst, 8)
        for i, chunk in enumerate(chunks):
            chunk.sort(key=lambda c: (strokes_of[c], rank[c]))
            suffix = f"（{i + 1}）" if len(chunks) > 1 else ""
            groups.append(
                {
                    "title": f"{name}家族{suffix}",
                    "emoji": "🧩",
                    "tip": f"这些字都带“{rad}”（{name}），{meaning}。",
                    "chars": "".join(chunk),
                }
            )

    misc.sort(key=lambda c: (strokes_of[c], rank[c]))
    if len(misc) < 3 and groups:
        # 太少的零散字并入最小的一组，避免出现只有 1~2 个字的分组
        smallest = min(groups, key=lambda g: len(g["chars"]))
        smallest["chars"] += "".join(misc)
        misc = []
    for chunk in split_balanced(misc, 6) if misc else []:
        lo, hi = strokes_of[chunk[0]], strokes_of[chunk[-1]]
        span = f"{lo}画" if lo == hi else f"{lo}到{hi}画"
        groups.append(
            {
                "title": f"数笔画（{span}）",
                "emoji": "✍️",
                "tip": "这几个字的笔画数差不多，一边读一边数一数笔画吧。",
                "chars": "".join(chunk),
            }
        )
    groups.sort(key=lambda g: sum(rank[c] for c in g["chars"]) / len(g["chars"]))
    return groups


def main() -> None:
    """构建全部数据文件。"""
    ensure_sources()
    level1, rank = load_char_pool()
    level1_set = set(level1)
    words_db = {
        w["word"]: w
        for w in json.load(open(CACHE / "word.json", encoding="utf-8"))
    }
    details = load_curated_details()

    # ---- 1. 确定 3000 字 ----
    curated_groups = [(1, g) for g in STAGE1_GROUPS] + [(2, g) for g in STAGE2_GROUPS]
    seen: set[str] = set()
    curated_order: List[str] = []
    for _stage, (title, _emoji, _tip, chars) in curated_groups:
        for c in chars:
            if c in seen:
                print(f"[警告] 重复字 {c}（{title}）")
                continue
            if c not in level1_set:
                print(f"[警告] 不在一级字表 {c}（{title}）")
            seen.add(c)
            curated_order.append(c)
    for c in curated_order:
        rank.setdefault(c, 1500)

    bank = WordBank(level1_set)
    by_freq = sorted((c for c in level1 if c in rank), key=lambda c: rank[c])
    final: List[str] = list(curated_order)
    skipped: List[str] = []
    for c in by_freq:
        if len(final) >= TOTAL_CHARS:
            break
        if c in seen:
            continue
        # 姓氏、地名等专有名词用字（没有常用组词）不适合启蒙，顺延到后面
        if not (bank.index.get(c) or bank.fallback.get(c)):
            skipped.append(c)
            continue
        final.append(c)
        seen.add(c)
    print(f"因缺少常用组词而顺延的字 {len(skipped)}：{''.join(skipped)}")
    print(f"最终字数 {len(final)}，人工编排 {len(curated_order)} 字")
    # 名次重排（用于难度判断）：人工字保持其编排，其余按字频
    rest = [c for c in final if c not in set(curated_order)]
    rest.sort(key=lambda c: rank[c])

    # ---- 2. 基础信息 ----
    stroke_dir = TOOLS / "node_modules" / "hanzi-writer-data"
    radical_of: Dict[str, str] = {}
    strokes_of: Dict[str, int] = {}
    for c in final:
        info = words_db.get(c)
        radical_of[c] = info["radicals"] if info else ""
        try:
            strokes_of[c] = int(info["strokes"])
        except (TypeError, ValueError, KeyError):
            data = json.load(open(stroke_dir / f"{c}.json", encoding="utf-8"))
            strokes_of[c] = len(data["strokes"])

    # ---- 3. 课程结构 ----
    stages: List[dict] = []
    gid = 0

    def add_group(stage: dict, title: str, emoji: str, tip: str, chars: str) -> None:
        nonlocal gid
        gid += 1
        stage["groups"].append(
            {"id": gid, "title": title, "emoji": emoji, "tip": tip, "chars": chars}
        )

    stage1 = {
        "id": 1, "name": "启蒙认字", "emoji": "🌱",
        "desc": "从数字、方位、家人、身体、大自然开始，主题式认字，一类一类学。",
        "groups": [],
    }
    stage2 = {
        "id": 2, "name": "字族与结构", "emoji": "🧩",
        "desc": "加一加、声旁家族、量词、反义词，学会“举一反三”。",
        "groups": [],
    }
    emitted: set[str] = set()
    for stage_id, (title, emoji, tip, chars) in curated_groups:
        uniq = "".join(c for c in chars if c not in emitted)
        emitted.update(uniq)
        if uniq:
            add_group(stage1 if stage_id == 1 else stage2, title, emoji, tip, uniq)
    stages += [stage1, stage2]

    start = 0
    for idx, (sid, name, emoji, desc, ratio) in enumerate(STAGES_AUTO):
        if idx == len(STAGES_AUTO) - 1:
            part = rest[start:]
        else:
            count = round(len(rest) * ratio)
            part = rest[start : start + count]
            start += count
        stage = {"id": sid, "name": name, "emoji": emoji, "desc": desc, "groups": []}
        for g in build_auto_groups(part, rank, radical_of, strokes_of):
            add_group(stage, g["title"], g["emoji"], g["tip"], g["chars"])
        stages.append(stage)

    group_of: Dict[str, int] = {}
    for st in stages:
        for g in st["groups"]:
            for c in g["chars"]:
                group_of[c] = g["id"]

    # ---- 4. 每个字的详细数据 ----
    chars_out: Dict[str, dict] = {}
    for n, c in enumerate(final, 1):
        readings = pinyin(c, style=Style.TONE, heteronym=True)[0]
        item: dict = {"p": readings[0], "r": radical_of[c], "n": strokes_of[c],
                      "g": group_of[c]}
        if len(readings) > 1 and c in POLYPHONES:
            item["alt"] = [r for r in readings[1:] if r != readings[0]][:2]
        if c in details:
            meaning, word_list, example = details[c]
            item["m"] = meaning
            item["x"] = example
            wl = []
            for w in word_list:
                # 人工编排的字：只使用人工审核过的词语解释，避免词典里的古义
                exp = bank.notes.get(w, "")
                wl.append([w, " ".join(lazy_pinyin(w, style=Style.TONE)), exp])
            item["w"] = wl
        else:
            item["w"] = bank.pick(c)
        chars_out[c] = item
        if n % 500 == 0:
            print(f"  已处理 {n}/{len(final)}")

    # ---- 5. 写出文件 ----
    DATA_OUT.mkdir(exist_ok=True)
    (DATA_OUT / "chars.json").write_text(
        json.dumps(chars_out, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    curriculum = {
        "total": len(final),
        "stages": stages,
    }
    (DATA_OUT / "curriculum.json").write_text(
        json.dumps(curriculum, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    # ---- 6. 笔顺数据与前端库 ----
    out_strokes = DATA_OUT / "strokes"
    shutil.rmtree(out_strokes, ignore_errors=True)
    out_strokes.mkdir(parents=True, exist_ok=True)
    for c in final:
        shutil.copyfile(stroke_dir / f"{c}.json", out_strokes / f"{ord(c):x}.json")
    vendor = ROOT / "js" / "vendor"
    vendor.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(
        TOOLS / "node_modules" / "hanzi-writer" / "dist" / "hanzi-writer.min.js",
        vendor / "hanzi-writer.min.js",
    )

    # ---- 7. 统计 ----
    no_words = [c for c in final if not chars_out[c]["w"]]
    no_exp = sum(1 for c in final for w in chars_out[c]["w"] if not w[2])
    print(f"分组数 {gid}，阶段 {[len(s['groups']) for s in stages]}")
    print(f"无组词的字 {len(no_words)}：{''.join(no_words[:80])}")
    print(f"无解释的词条 {no_exp}")


if __name__ == "__main__":
    main()
