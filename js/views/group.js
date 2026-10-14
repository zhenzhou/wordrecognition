/**
 * 分组概览：先把这一组的字放在一起看一看，鼠标悬停可放大并播放笔顺，再开始逐字学习。
 */
import { charGrid, stateBadge } from '../components.js';
import { D, getGroup, stageOfGroup } from '../data.js';
import { groupProgress } from '../store.js';
import { speakText, canSpeak } from '../speech.js';
import { h, mount } from '../util.js';

/**
 * 渲染分组概览页。
 * @param {HTMLElement} root 容器
 * @param {{id: string}} params 路由参数
 */
export function renderGroup(root, params) {
    const group = getGroup(params.id);
    if (!group) {
        mount(root, h('p', { class: 'empty', text: '没有找到这一组。' }), h('a', { class: 'btn', href: '#/map', text: '回到地图' }));
        return;
    }
    const stage = stageOfGroup(group);
    const prog = groupProgress(group);
    const prev = D.groupMap.get(group.id - 1);
    const next = D.groupMap.get(group.id + 1);

    const startLabel = prog.seen === 0 ? '开始学习 ›' : prog.state === 'done' ? '再学一遍 ›' : '继续学习 ›';

    mount(
        root,
        h(
            'nav',
            { class: 'breadcrumb', 'aria-label': '位置' },
            h('a', { href: '#/map', text: '识字地图' }),
            ' › ',
            h('a', { href: `#/map/${stage.id}`, text: `${stage.emoji} ${stage.name}` }),
            ' › ',
            h('span', { text: `第 ${group.id} 组` }),
        ),
        h(
            'section',
            { class: 'group-hero' },
            h('div', { class: 'gh-emoji', text: group.emoji }),
            h('div', {}, h('h1', { text: group.title }), h('p', { class: 'gh-tip', text: group.tip }), h('div', { class: 'gh-badge' }, stateBadge(prog))),
        ),
        h('p', { class: 'hint', text: '👆 把鼠标放在字上：字会放大，并演示一笔一画怎么写。（手机/平板请点一下字）' }),
        charGrid(group.list, { large: true }),
        h(
            'div',
            { class: 'action-row' },
            h('a', { class: 'btn btn-primary btn-big', href: `#/learn/${group.id}/0`, text: startLabel }),
            canSpeak()
                ? h('button', { class: 'btn btn-ghost', type: 'button', text: '🔊 把这一组都读一遍', onclick: () => speakText(group.list.join('，')) })
                : null,
            h('a', { class: 'btn btn-ghost', href: `#/quiz/${group.id}`, text: '📝 直接测验' }),
        ),
        h(
            'div',
            { class: 'pager' },
            prev ? h('a', { href: `#/group/${prev.id}`, text: `‹ 上一组：${prev.title}` }) : h('span'),
            next ? h('a', { href: `#/group/${next.id}`, text: `下一组：${next.title} ›` }) : h('span'),
        ),
    );
}
