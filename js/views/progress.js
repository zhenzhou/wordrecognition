/**
 * 识字进度：总进度、阶段进度、最近两周学习曲线、成就徽章、已认识的字墙。
 */
import { progressBar, ring } from '../components.js';
import { D, stageChars } from '../data.js';
import { getProfile, groupProgress, recentDays, stats } from '../store.js';
import { h, mount } from '../util.js';

const MILESTONES = [10, 50, 100, 300, 500, 1000, 1500, 2000, 2500, 3000];

function bars(days) {
    const max = Math.max(5, ...days.map((d) => d.n + d.k));
    return h(
        'div',
        { class: 'bars', role: 'img', 'aria-label': '最近 14 天每天学习的字数' },
        days.map((d) =>
            h(
                'div',
                { class: 'bar-col', title: `${d.key}：新学 ${d.n} 个字，认识 ${d.k} 个字，测验 ${d.q} 次` },
                h('div', { class: 'bar-num', text: d.n ? String(d.n) : '' }),
                h('div', { class: 'bar', style: { height: `${Math.round((d.n / max) * 100)}%` } }),
                h('div', { class: 'bar-label', text: d.label }),
            ),
        ),
    );
}

/** 渲染进度页。 */
export function renderProgress(root) {
    const profile = getProfile();
    const st = stats();
    const days = recentDays(14);
    const knownChars = D.order.filter((c) => profile.chars[c]?.s === 2);
    const learningChars = D.order.filter((c) => profile.chars[c]?.s === 1);

    const stageRows = D.stages.map((stage) => {
        const list = stageChars(stage);
        const known = list.filter((c) => profile.chars[c]?.s === 2).length;
        const doneGroups = stage.groups.filter((g) => groupProgress(g).state === 'done').length;
        return h(
            'div',
            { class: 'stage-row' },
            h('div', { class: 'sr-title', text: `${stage.emoji} ${stage.id}. ${stage.name}` }),
            progressBar(known, list.length, `${stage.name}进度`),
            h('div', { class: 'sr-meta', text: `${known}/${list.length} 字 · 完成 ${doneGroups}/${stage.groups.length} 组` }),
        );
    });

    const badges = MILESTONES.map((m) =>
        h('div', { class: `medal ${st.known >= m ? 'got' : ''}`, title: st.known >= m ? '已获得' : `再认识 ${m - st.known} 个字就能获得` }, h('span', { text: st.known >= m ? '🏅' : '🔒' }), h('b', { text: `${m} 字` })),
    );

    const wall = knownChars.length
        ? h('div', { class: 'wall' }, knownChars.map((c) => h('a', { href: `#/char/${encodeURIComponent(c)}`, text: c, 'aria-label': `已认识：${c}` })))
        : h('p', { class: 'empty', text: '还没有认识的字，快去学习吧。认识的字会出现在这里。' });

    mount(
        root,
        h('div', { class: 'page-head' }, h('h1', { text: `📈 ${profile.name} 的识字进度` })),
        h(
            'section',
            { class: 'card progress-top' },
            ring(st.known, D.total, { size: 180 }),
            h(
                'div',
                { class: 'pt-stats' },
                h('div', { class: 'stat' }, h('strong', { text: String(st.known) }), h('span', { text: '已认识的字' })),
                h('div', { class: 'stat' }, h('strong', { text: String(learningChars.length) }), h('span', { text: '学习中' })),
                h('div', { class: 'stat' }, h('strong', { text: `🔥 ${st.streak}` }), h('span', { text: '连续学习天数' })),
                h('div', { class: 'stat' }, h('strong', { text: String(st.activeDays) }), h('span', { text: '累计学习天数' })),
                h('div', { class: 'stat' }, h('strong', { text: String(st.quizzes) }), h('span', { text: '完成测验次数' })),
                h('div', { class: 'stat' }, h('strong', { text: `${Math.round((st.known / D.total) * 100)}%` }), h('span', { text: '三千字完成度' })),
            ),
        ),
        h('section', { class: 'card' }, h('h2', { text: '各阶段进度' }), stageRows),
        h('section', { class: 'card' }, h('h2', { text: '最近 14 天（每天新学字数）' }), bars(days)),
        h('section', { class: 'card' }, h('h2', { text: '成就徽章' }), h('div', { class: 'medals' }, badges)),
        h('section', { class: 'card' }, h('h2', { text: `认识的字墙（${knownChars.length}）` }), wall),
    );
}
