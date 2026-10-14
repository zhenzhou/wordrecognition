/**
 * 鼠标悬停放大卡片：把鼠标放在某个字上，字会放大并播放笔顺动画。
 * 触屏设备：点一下显示放大卡片，卡片上的“详情”按钮进入单字页。
 */
import { getChar } from './data.js';
import { getSettings } from './store.js';
import { speakChar } from './speech.js';
import { clamp, h } from './util.js';
import { createWriter } from './writer.js';

const CARD_W = 236;
const CARD_H = 330;

let card = null;
let writer = null;
let hideTimer = null;
let showTimer = null;
let currentCell = null;

function destroyCard() {
    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    if (writer) writer.destroy();
    writer = null;
    if (card) card.remove();
    card = null;
    currentCell = null;
}

/** 关闭悬停卡片（切换页面时调用）。 */
export function closeHoverCard() {
    destroyCard();
}

function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(destroyCard, 160);
}

function showCard(cell, ch) {
    if (currentCell === cell && card) return;
    destroyCard();
    const info = getChar(ch);
    if (!info) return;
    currentCell = cell;

    const rect = cell.getBoundingClientRect();
    const left = clamp(rect.left + rect.width / 2 - CARD_W / 2, 8, window.innerWidth - CARD_W - 8);
    const top = clamp(rect.top + rect.height / 2 - CARD_H / 2, 8, window.innerHeight - CARD_H - 8);

    const canvas = h('div', { class: 'hc-canvas' });
    const firstWord = info.w && info.w[0] ? info.w[0][0] : '';
    card = h(
        'div',
        {
            class: 'hover-card',
            style: { left: `${left}px`, top: `${top}px`, width: `${CARD_W}px` },
            onmouseenter: () => clearTimeout(hideTimer),
            onmouseleave: scheduleHide,
        },
        h('div', { class: 'hc-pinyin', text: info.p }),
        canvas,
        h('div', { class: 'hc-word', text: firstWord }),
        h(
            'div',
            { class: 'hc-actions' },
            h('button', {
                class: 'btn btn-small',
                type: 'button',
                text: '🔊 读一读',
                onclick: (e) => {
                    e.stopPropagation();
                    speakChar(ch, info);
                },
            }),
            h('a', { class: 'btn btn-small btn-primary', href: `#/char/${encodeURIComponent(ch)}`, text: '详情 ›' }),
        ),
    );
    document.body.appendChild(card);
    writer = createWriter(canvas, ch, { size: 188 });
    if (getSettings().hoverSpeak) speakChar(ch, info);
}

/**
 * 给一个字的单元格绑定悬停放大效果。
 * @param {HTMLElement} cell 单元格元素
 * @param {string} ch 汉字
 */
export function bindHover(cell, ch) {
    cell.addEventListener('mouseenter', () => {
        clearTimeout(hideTimer);
        clearTimeout(showTimer);
        showTimer = setTimeout(() => showCard(cell, ch), 90);
    });
    cell.addEventListener('mouseleave', (e) => {
        clearTimeout(showTimer);
        if (card && e.relatedTarget && card.contains(e.relatedTarget)) return;
        scheduleHide();
    });
    cell.addEventListener('focus', () => showCard(cell, ch));
    cell.addEventListener('blur', () => scheduleHide());
    cell.addEventListener('click', (e) => {
        // 触屏设备没有悬停：第一次点击显示卡片
        if (window.matchMedia('(hover: none)').matches) {
            e.preventDefault();
            showCard(cell, ch);
        }
    });
}
