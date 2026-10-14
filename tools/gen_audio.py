# -*- coding: utf-8 -*-
"""（可选）为 3000 个字预生成普通话朗读音频，输出到 ``data/audio/<码点>.mp3``。

网页检测到 ``data/audio/4e00.mp3`` 存在后，会优先播放这些音频（音质统一、
不依赖浏览器语音）；缺失时自动回退到浏览器语音合成。

需要联网（调用微软 Edge 在线语音服务，只会发送汉字文本）::

    pip install edge-tts
    python tools\\gen_audio.py            # 全部生成，已存在的会跳过
    python tools\\gen_audio.py --limit 50 # 只生成前 50 个字试听
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "audio"
VOICE = "zh-CN-XiaoxiaoNeural"


async def synth(sem: asyncio.Semaphore, ch: str, text: str) -> None:
    """生成单个字的音频文件，已存在则跳过。"""
    path = OUT / f"{ord(ch):x}.mp3"
    if path.exists() and path.stat().st_size > 0:
        return
    async with sem:
        for attempt in range(3):
            try:
                await edge_tts.Communicate(text, VOICE, rate="-15%").save(str(path))
                return
            except Exception as err:  # noqa: BLE001
                if attempt == 2:
                    print(f"失败 {ch}: {err}")
                await asyncio.sleep(1.5)


async def main(limit: int) -> None:
    """读取字表并并发生成音频。"""
    chars = json.loads((ROOT / "data" / "chars.json").read_text(encoding="utf-8"))
    curriculum = json.loads((ROOT / "data" / "curriculum.json").read_text(encoding="utf-8"))
    order = [c for st in curriculum["stages"] for g in st["groups"] for c in g["chars"]]
    if limit:
        order = order[:limit]
    OUT.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(6)
    tasks = []
    for ch in order:
        info = chars[ch]
        # 多音字连同第一个组词一起读，避免读错
        text = f"{ch}，{info['w'][0][0]}" if info.get("alt") and info.get("w") else ch
        tasks.append(synth(sem, ch, text))
    await asyncio.gather(*tasks)
    print(f"完成，音频目录：{OUT}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="只生成前 N 个字")
    args = parser.parse_args()
    asyncio.run(main(args.limit))
