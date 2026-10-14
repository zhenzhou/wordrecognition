/**
 * 可复用的界面组件：汉字格子、进度条、进度环。
 */
import { getChar } from './data.js';
import { bindHover } from './hovercard.js';
import { charState } from './store.js';
import { h } from './util.js';

const STATE_CLASS = ['is-new', 'is-learning', 'is-known'];
const STATE_LABEL = ['还没学', '学习中', '已认识'];

/**
 * 汉字格子：悬停放大并播放笔顺，点击进入单字页。
 * @param {string} ch 汉字
 * @param {Object} [opts] { pinyin: 是否显示拼音, large: 大号 }
 */
export function charCell(ch, opts = {}) {
    const info = getChar(ch);
    const state = charState(ch);
    const cell = h(
        'a',
        {
            class: `cell ${STATE_CLASS[state]} ${opts.large ? 'cell-large' : ''}`,
            href: `#/char/${encodeURIComponent(ch)}`,
            'aria-label': `${ch}，${info ? info.p : ''}，${STATE_LABEL[state]}`,
            dataset: { ch },
        },
        opts.pinyin === false ? null : h('span', { class: 'cell-py', text: info ? info.p : '' }),
        h('span', { class: 'cell-ch', text: ch }),
    );
    bindHover(cell, ch);
    return cell;
}

/** 汉字格子网格。 */
export function charGrid(list, opts = {}) {
    return h('div', { class: `char-grid ${opts.class || ''}` }, list.map((ch) => charCell(ch, opts)));
}

/** 横向进度条。 */
export function progressBar(value, total, label = '') {
    const pct = total ? Math.round((value / total) * 100) : 0;
    return h(
        'div',
        { class: 'pbar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(value), 'aria-label': label },
        h('div', { class: 'pbar-fill', style: { width: `${pct}%` } }),
    );
}

/** 圆形进度环（SVG）。 */
export function ring(value, total, { size = 160, label = '已认识', unit = '字' } = {}) {
    const r = 54;
    const c = 2 * Math.PI * r;
    const pct = total ? Math.min(1, value / total) : 0;
    const wrap = h('div', { class: 'ring', style: { width: `${size}px`, height: `${size}px` } });
    wrap.insertAdjacentHTML(
        'afterbegin',
        `<svg viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">
            <circle cx="60" cy="60" r="${r}" fill="none" stroke="#f1e9dc" stroke-width="12"/>
            <circle cx="60" cy="60" r="${r}" fill="none" stroke="url(#rg)" stroke-width="12" stroke-linecap="round"
                stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}" transform="rotate(-90 60 60)"/>
            <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#ff9f43"/><stop offset="1" stop-color="#ff6b6b"/></linearGradient></defs>
        </svg>`,
    );
    wrap.appendChild(
        h(
            'div',
            { class: 'ring-text' },
            h('strong', { text: String(value) }),
            h('span', { text: `${label}${unit} / ${total}` }),
        ),
    );
    return wrap;
}

/** 分组状态徽章文字。 */
export function stateBadge(progress) {
    if (progress.state === 'done') return h('span', { class: 'badge badge-done', text: `完成 ${'★'.repeat(progress.stars || 0)}` });
    if (progress.state === 'doing') return h('span', { class: 'badge badge-doing', text: `学习中 ${progress.known}/${progress.total}` });
    return h('span', { class: 'badge', text: '未开始' });
}
