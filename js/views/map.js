/**
 * 学习地图：按阶段列出全部分组及完成状态。
 */
import { progressBar, stateBadge } from '../components.js';
import { D, stageChars } from '../data.js';
import { getProfile, groupProgress, nextGroup } from '../store.js';
import { h, mount } from '../util.js';

function groupCard(group, isNext) {
    const prog = groupProgress(group);
    return h(
        'a',
        { class: `group-card state-${prog.state} ${isNext ? 'is-next' : ''}`, href: `#/group/${group.id}` },
        h('div', { class: 'gc-top' }, h('span', { class: 'gc-emoji', text: group.emoji }), stateBadge(prog)),
        h('h4', { text: group.title }),
        h('div', { class: 'gc-chars', text: group.chars }),
        isNext ? h('div', { class: 'gc-next', text: '👉 下一个学这里' }) : null,
    );
}

/**
 * 渲染学习地图。
 * @param {HTMLElement} root 容器
 * @param {{stage?: string}} params 路由参数，stage 指定默认展开的阶段
 */
export function renderMap(root, params = {}) {
    const next = nextGroup();
    const focusStage = params.stage ? Number(params.stage) : next ? next.stage : 1;
    const profile = getProfile();

    const sections = D.stages.map((stage) => {
        const list = stageChars(stage);
        const known = list.filter((c) => (profile.chars[c]?.s || 0) === 2).length;
        const details = h(
            'details',
            { class: 'stage-block', id: `stage-${stage.id}`, open: stage.id === focusStage },
            h(
                'summary',
                {},
                h('span', { class: 'stage-emoji', text: stage.emoji }),
                h('span', { class: 'stage-name' }, h('strong', { text: `${stage.id}. ${stage.name}` }), h('small', { text: stage.desc })),
                h('span', { class: 'stage-count', text: `${known}/${list.length}` }),
            ),
            progressBar(known, list.length, `${stage.name}进度`),
            h('div', { class: 'group-grid' }, stage.groups.map((g) => groupCard(g, next && next.id === g.id))),
        );
        return details;
    });

    mount(
        root,
        h('div', { class: 'page-head' }, h('h1', { text: '🗺️ 识字地图' }), h('p', { class: 'muted', text: '建议从第一阶段开始，按顺序学习；也可以直接点进任何一组。' })),
        sections,
    );
    const target = document.getElementById(`stage-${focusStage}`);
    if (target && params.stage) target.scrollIntoView({ block: 'start' });
}
