/**
 * 单字详情页：#/char/:c
 */
import { createCharCard } from '../charcard.js';
import { D, getChar, getGroup } from '../data.js';
import { charState, markKnown, markSeen, markUnknown } from '../store.js';
import { h, mount, toast } from '../util.js';

/**
 * 渲染单字详情。
 * @param {HTMLElement} root 容器
 * @param {{c: string}} params 路由参数
 * @returns {Function|undefined} 清理函数
 */
export function renderChar(root, params) {
    const ch = decodeURIComponent(params.c);
    const info = getChar(ch);
    if (!info) {
        mount(root, h('p', { class: 'empty', text: `字库里没有“${ch}”。` }), h('a', { class: 'btn', href: '#/library', text: '去字库' }));
        return undefined;
    }
    markSeen(ch);
    const group = getGroup(info.g);
    const card = createCharCard(ch);
    const pos = D.order.indexOf(ch);
    const prev = pos > 0 ? D.order[pos - 1] : null;
    const next = pos < D.order.length - 1 ? D.order[pos + 1] : null;

    const knownBtn = h('button', { class: 'btn btn-known', type: 'button' });
    const syncKnown = () => {
        const known = charState(ch) === 2;
        knownBtn.textContent = known ? '✅ 已认识（点一下取消）' : '👍 我认识了';
        knownBtn.classList.toggle('is-on', known);
    };
    knownBtn.addEventListener('click', () => {
        if (charState(ch) === 2) markUnknown(ch);
        else {
            markKnown(ch);
            toast('记住啦！⭐');
        }
        syncKnown();
    });
    syncKnown();

    mount(
        root,
        h(
            'nav',
            { class: 'breadcrumb', 'aria-label': '位置' },
            h('a', { href: '#/library', text: '字库' }),
            ' › ',
            group ? h('a', { href: `#/group/${group.id}`, text: `${group.emoji} ${group.title}` }) : null,
            ' › ',
            h('span', { text: ch }),
        ),
        card.el,
        h(
            'div',
            { class: 'learn-nav' },
            prev ? h('a', { class: 'btn btn-ghost', href: `#/char/${encodeURIComponent(prev)}`, text: `‹ ${prev}` }) : h('span'),
            knownBtn,
            next ? h('a', { class: 'btn btn-ghost', href: `#/char/${encodeURIComponent(next)}`, text: `${next} ›` }) : h('span'),
        ),
        group ? h('p', { class: 'center' }, h('a', { href: `#/learn/${group.id}/0`, text: `和它同组的字：${group.chars}，一起学 ›` })) : null,
    );
    return card.destroy;
}
