# -*- coding: utf-8 -*-
"""端到端冒烟测试：用 Edge 打开各页面，检查控制台错误并截图。

用法（需先启动本地服务 http://127.0.0.1:8080）::

    python tools\\e2e_smoke.py
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:8080/"
SHOTS = Path(__file__).parent / "_shots"


async def main() -> None:
    """依次访问各页面并截图。"""
    SHOTS.mkdir(exist_ok=True)
    errors: list[str] = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="msedge", headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()
        page.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
        page.on("requestfailed", lambda r: errors.append(f"[reqfail] {r.url}"))
        page.on("response", lambda r: errors.append(f"[{r.status}] {r.url}") if r.status >= 400 and "audio" not in r.url else None)

        await page.goto(BASE)
        await page.wait_for_selector(".modal")
        await page.screenshot(path=str(SHOTS / "00_welcome.png"))
        await page.fill(".modal input", "小宝")
        await page.click(".modal .btn-primary")
        await page.wait_for_selector(".hero")
        await page.screenshot(path=str(SHOTS / "01_home.png"), full_page=True)

        await page.goto(BASE + "#/map")
        await page.wait_for_selector(".group-card")
        await page.screenshot(path=str(SHOTS / "02_map.png"))

        await page.goto(BASE + "#/group/1")
        await page.wait_for_selector(".cell")
        await page.hover(".cell >> nth=1")
        await page.wait_for_selector(".hover-card svg")
        await page.wait_for_timeout(1800)
        await page.screenshot(path=str(SHOTS / "03_group_hover.png"))

        await page.goto(BASE + "#/learn/1/0")
        await page.wait_for_selector(".char-card .stroke-steps .step")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(SHOTS / "04_learn.png"), full_page=True)
        await page.click(".btn-known")
        await page.keyboard.press("ArrowRight")
        await page.wait_for_selector(".char-card")

        await page.goto(BASE + "#/quiz/1")
        await page.wait_for_selector(".q-option")
        await page.click(".q-option >> nth=0")
        await page.screenshot(path=str(SHOTS / "05_quiz.png"))
        for _ in range(5):
            btn = page.locator(".quiz-card .btn-primary")
            if await btn.is_visible():
                await btn.click()
            opts = page.locator(".q-option")
            if await opts.count():
                await opts.first.click()
        await page.wait_for_timeout(300)

        for name, route, sel in [
            ("06_library", "#/library", ".cell"),
            ("07_progress", "#/progress", ".ring"),
            ("08_settings", "#/settings", ".profile-list"),
            ("09_map_stage3", "#/map/3", "details[open] .group-card"),
            ("10_char", "#/char/%E4%BA%BA", ".char-card"),
        ]:
            await page.goto(BASE + route)
            await page.wait_for_selector(sel)
            await page.wait_for_timeout(500)
            await page.screenshot(path=str(SHOTS / f"{name}.png"))

        await browser.close()

    print("控制台/网络问题：", len(errors))
    for e in errors[:30]:
        print("  ", e)


if __name__ == "__main__":
    asyncio.run(main())
