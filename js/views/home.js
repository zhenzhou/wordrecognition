/**
 * 首页：问候、总进度环、继续学习、复习提醒、今日目标、阶段地图入口。
 */
import { progressBar, ring } from '../components.js';
import { D, stageChars } from '../data.js';
import { profileAvatar } from '../pets.js';
import { dueChars, getProfile, groupProgress, nextGroup, stats } from '../store.js';
import { h, mount } from '../util.js';

function greeting() {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深啦，早点休息';
    if (hour < 11) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
}

function continueCard(next) {
    if (!next) {
        return h(
            'section',
            { class: 'card cta-card' },
            h('div', { class: 'cta-emoji', text: '🏆' }),
            h('div', { class: 'cta-body' }, h('h2', { text: '太厉害了！三千字全部学完' }), h('p', { text: '去字库里随便翻翻，或者做做复习吧。' })),
            h('a', { class: 'btn btn-primary btn-big', href: '#/library', text: '去字库' }),
        );
    }
    const prog = groupProgress(next);
    const stage = D.stages.find((s) => s.id === next.stage);
    const started = prog.seen > 0;
    return h(
        'section',
        { class: 'card cta-card' },
        h('div', { class: 'cta-emoji', text: next.emoji }),
        h(
            'div',
            { class: 'cta-body' },
            h('div', { class: 'eyebrow', text: `${stage.emoji} ${stage.name} · 第 ${next.id} 组` }),
            h('h2', { text: next.title }),
            h('div', { class: 'cta-chars', 'aria-label': `本组的字：${next.chars}` }, next.list.map((c) => h('span', { text: c }))),
            h('p', { class: 'muted', text: next.tip }),
        ),
        h('a', { class: 'btn btn-primary btn-big', href: `#/group/${next.id}`, text: started ? '继续学习 ›' : '开始学习 ›' }),
    );
}

function stageCard(stage) {
    const list = stageChars(stage);
    const known = list.filter((c) => (getProfile()?.chars[c]?.s || 0) === 2).length;
    const done = stage.groups.filter((g) => groupProgress(g).state === 'done').length;
    return h(
        'a',
        { class: 'stage-card', href: `#/map/${stage.id}` },
        h('div', { class: 'stage-emoji', text: stage.emoji }),
        h('h3', { text: `${stage.id}. ${stage.name}` }),
        h('p', { class: 'muted', text: stage.desc }),
        progressBar(known, list.length, `${stage.name}进度`),
        h('div', { class: 'stage-meta', text: `${known}/${list.length} 字 · ${done}/${stage.groups.length} 组` }),
    );
}

/** 渲染首页。 */
export function renderHome(root) {
    const profile = getProfile();
    const st = stats();
    const next = nextGroup();
    const due = dueChars();
    const goal = profile.goal || 5;
    const goalPct = Math.min(100, Math.round((st.todayNew / goal) * 100));

    const hero = h(
        'section',
        { class: 'hero' },
        h(
            'div',
            { class: 'hero-text' },
            h('div', { class: 'hero-avatar' }, profileAvatar(profile, 110)),
            h('h1', { text: `${greeting()}，${profile.name}！` }),
            h('p', { text: st.known === 0 ? '欢迎来到识字乐园，我们从第一个字开始吧。' : `你已经认识 ${st.known} 个字啦，继续加油！` }),
            h(
                'div',
                { class: 'hero-stats' },
                h('div', { class: 'stat' }, h('strong', { text: `🔥 ${st.streak}` }), h('span', { text: '连续学习(天)' })),
                h('div', { class: 'stat' }, h('strong', { text: String(st.learning) }), h('span', { text: '学习中的字' })),
                h('div', { class: 'stat' }, h('strong', { text: String(D.total - st.known - st.learning) }), h('span', { text: '还没学的字' })),
            ),
        ),
        ring(st.known, D.total, { size: 190 }),
    );

    const goalCard = h(
        'section',
        { class: 'card goal-card' },
        h('div', { class: 'goal-head' }, h('h3', { text: '⭐ 今日目标' }), h('span', { class: 'muted', text: `新学 ${st.todayNew} / ${goal} 个字` })),
        h('div', { class: 'pbar pbar-thick', role: 'progressbar', 'aria-valuenow': String(goalPct), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': '今日目标进度' }, h('div', { class: 'pbar-fill', style: { width: `${goalPct}%` } })),
        h('p', { class: 'muted', text: st.todayNew >= goal ? '今天的目标完成啦，真棒！可以再多学一点，也可以去复习。' : '每天认几个字，坚持下去就会越来越多。' }),
    );

    const reviewCard = h(
        'section',
        { class: 'card review-card' },
        h('div', { class: 'cta-emoji', text: '🔁' }),
        h(
            'div',
            { class: 'cta-body' },
            h('h3', { text: due.length ? `有 ${due.length} 个字需要复习` : '暂时没有要复习的字' }),
            h('p', { class: 'muted', text: due.length ? `${due.slice(0, 8).join(' ')}${due.length > 8 ? ' …' : ''}` : '学了新字后，过几天它们就会出现在这里。' }),
        ),
        due.length ? h('a', { class: 'btn btn-accent', href: '#/review', text: '去复习' }) : null,
    );

    const parentTips = h(
        'details',
        { class: 'card tips' },
        h('summary', { text: '👪 家长小贴士：怎么陪孩子学？' }),
        h(
            'ol',
            {},
            h('li', { text: '每天固定 10~15 分钟，一次学一组（4~8 个字），宁少勿多。' }),
            h('li', { text: '把鼠标放在字上，看笔顺动画；让孩子用手指在空中“书写”。' }),
            h('li', { text: '先读字音、再读组词、再说一句话，把字放进生活里。' }),
            h('li', { text: '孩子能自己说出字的读音和意思，再点“我认识了”；做完小测验再进入下一组。' }),
            h('li', { text: '进度保存在本机浏览器里。换电脑前，请到“设置”里导出备份。' }),
        ),
    );

    mount(
        root,
        hero,
        h('div', { class: 'grid-2' }, continueCard(next), h('div', { class: 'stack' }, reviewCard, goalCard)),
        h('div', { class: 'section-title' }, h('h2', { text: '🗺️ 识字地图' }), h('a', { href: '#/map', text: '查看全部分组 ›' })),
        h('div', { class: 'stage-grid' }, D.stages.map(stageCard)),
        parentTips,
    );
}
