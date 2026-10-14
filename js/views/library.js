/**
 * 字库：浏览全部三千字，可按学习状态、阶段筛选，也可以按汉字或拼音搜索。
 */
import { charGrid } from '../components.js';
import { D, getChar, stageChars } from '../data.js';
import { charState } from '../store.js';
import { closeHoverCard } from '../hovercard.js';
import { h, mount } from '../util.js';

const STATUS_FILTERS = [
    ['all', '全部'],
    ['2', '已认识'],
    ['1', '学习中'],
    ['0', '还没学'],
];

/** 去掉拼音声调，方便用字母搜索。 */
function plainPinyin(py) {
    return py.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ü/g, 'v').toLowerCase();
}

/** 渲染字库页。 */
export function renderLibrary(root) {
    let status = 'all';
    let stageId = 'all';
    let query = '';

    const gridBox = h('div', { class: 'library-grid' });
    const counter = h('p', { class: 'muted', 'aria-live': 'polite' });

    const refresh = () => {
        closeHoverCard();
        let list = stageId === 'all' ? D.order : stageChars(D.stages.find((s) => s.id === Number(stageId)));
        if (status !== 'all') list = list.filter((c) => String(charState(c)) === status);
        const q = query.trim().toLowerCase();
        if (q) {
            list = list.filter((c) => {
                const info = getChar(c);
                return [...q].includes(c) || plainPinyin(info.p).startsWith(plainPinyin(q));
            });
        }
        counter.textContent = `共 ${list.length} 个字${list.length > 600 ? '（数量较多，可以用上面的筛选缩小范围）' : ''}`;
        mount(gridBox, list.length ? charGrid(list, { class: 'dense' }) : h('p', { class: 'empty', text: '没有找到符合条件的字。' }));
    };

    const search = h('input', {
        class: 'input',
        type: 'search',
        placeholder: '输入汉字或拼音，例如：mā',
        'aria-label': '搜索汉字',
        oninput: (e) => {
            query = e.target.value;
            refresh();
        },
    });

    const statusBox = h(
        'div',
        { class: 'filter-row', role: 'group', 'aria-label': '按学习状态筛选' },
        STATUS_FILTERS.map(([value, label]) =>
            h('button', {
                class: `chip-btn ${value === status ? 'on' : ''}`,
                type: 'button',
                text: label,
                onclick: (e) => {
                    status = value;
                    statusBox.querySelectorAll('.chip-btn').forEach((b) => b.classList.remove('on'));
                    e.currentTarget.classList.add('on');
                    refresh();
                },
            }),
        ),
    );

    const stageSelect = h(
        'select',
        {
            class: 'input',
            'aria-label': '按阶段筛选',
            onchange: (e) => {
                stageId = e.target.value;
                refresh();
            },
        },
        h('option', { value: 'all', text: '所有阶段' }),
        D.stages.map((s) => h('option', { value: String(s.id), text: `${s.id}. ${s.name}` })),
    );

    mount(
        root,
        h('div', { class: 'page-head' }, h('h1', { text: '📚 字库' }), h('p', { class: 'muted', text: '三千常用字都在这里。颜色代表学习状态：灰色没学，黄色学习中，绿色已认识。' })),
        h('div', { class: 'toolbar' }, search, stageSelect),
        statusBox,
        counter,
        gridBox,
    );
    refresh();
}
