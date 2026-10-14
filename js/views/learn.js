/**
 * 逐字学习：一个字一张卡片（笔顺动画 + 拼音 + 组词 + 解释 + 语音），学完进入小测验。
 */
import { createCharCard } from '../charcard.js';
import { getChar, getGroup } from '../data.js';
import { charState, markKnown, markSeen, markUnknown } from '../store.js';
import { clamp, h, mount, toast } from '../util.js';

/**
 * 渲染逐字学习页。
 * @param {HTMLElement} root 容器
 * @param {{id: string, i: string}} params 路由参数：分组编号与字序号
 * @returns {Function} 清理函数
 */
export function renderLearn(root, params) {
    const group = getGroup(params.id);
    if (!group) {
        location.hash = '#/map';
        return undefined;
    }
    const total = group.list.length;
    const idx = clamp(Number(params.i) || 0, 0, total - 1);
    const ch = group.list[idx];
    if (!getChar(ch)) return undefined;
    markSeen(ch);

    const card = createCharCard(ch);
    const isLast = idx === total - 1;
    const go = (i) => {
        location.hash = `#/learn/${group.id}/${i}`;
    };

    const dots = h(
        'ol',
        { class: 'dots', 'aria-label': '本组进度' },
        group.list.map((c, i) =>
            h(
                'li',
                { class: i === idx ? 'current' : '' },
                h('a', {
                    href: `#/learn/${group.id}/${i}`,
                    class: `dot ${charState(c) === 2 ? 'known' : charState(c) === 1 ? 'seen' : ''}`,
                    'aria-label': `第 ${i + 1} 个字：${c}`,
                    'aria-current': i === idx ? 'step' : null,
                    text: c,
                }),
            ),
        ),
    );

    const knownBtn = h('button', { class: 'btn btn-known', type: 'button' });
    const renderKnown = () => {
        const known = charState(ch) === 2;
        knownBtn.textContent = known ? '✅ 已认识（点一下取消）' : '👍 我认识了';
        knownBtn.classList.toggle('is-on', known);
    };
    knownBtn.addEventListener('click', () => {
        if (charState(ch) === 2) {
            markUnknown(ch);
        } else {
            markKnown(ch);
            toast('记住啦！⭐');
        }
        renderKnown();
        dots.querySelectorAll('.dot')[idx].className = `dot ${charState(ch) === 2 ? 'known' : 'seen'}`;
    });
    renderKnown();

    mount(
        root,
        h(
            'nav',
            { class: 'breadcrumb', 'aria-label': '位置' },
            h('a', { href: `#/group/${group.id}`, text: `‹ ${group.emoji} ${group.title}` }),
            h('span', { class: 'muted', text: `　第 ${idx + 1} / ${total} 个字` }),
        ),
        dots,
        card.el,
        h(
            'div',
            { class: 'learn-nav' },
            idx > 0 ? h('button', { class: 'btn btn-ghost btn-big', type: 'button', text: '‹ 上一个', onclick: () => go(idx - 1) }) : h('span'),
            knownBtn,
            isLast
                ? h('a', { class: 'btn btn-primary btn-big', href: `#/quiz/${group.id}`, text: '去小测验 ›' })
                : h('button', { class: 'btn btn-primary btn-big', type: 'button', text: '下一个 ›', onclick: () => go(idx + 1) }),
        ),
        h('p', { class: 'hint center', text: '小提示：键盘 ← → 可以切换上一个/下一个字。' }),
    );

    const onKey = (e) => {
        if (e.target.closest('input, textarea, select')) return;
        if (e.key === 'ArrowRight') isLast ? (location.hash = `#/quiz/${group.id}`) : go(idx + 1);
        if (e.key === 'ArrowLeft' && idx > 0) go(idx - 1);
    };
    document.addEventListener('keydown', onKey);

    return () => {
        document.removeEventListener('keydown', onKey);
        card.destroy();
    };
}
