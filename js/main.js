/**
 * 入口：加载课程数据、渲染顶部导航、基于 location.hash 的简易路由。
 *
 * 路由：
 *   #/                首页
 *   #/map[/阶段]      识字地图
 *   #/group/:id       分组概览
 *   #/learn/:id/:i    逐字学习
 *   #/quiz/:id        分组测验
 *   #/review          复习
 *   #/char/:字        单字详情
 *   #/library         字库
 *   #/progress        识字进度
 *   #/settings        设置
 */
import { loadData } from './data.js';
import { closeHoverCard } from './hovercard.js';
import { probeAudio, stopSpeaking } from './speech.js';
import { getProfile } from './store.js';
import { h, mount } from './util.js';
import { renderChar } from './views/char.js';
import { renderGroup } from './views/group.js';
import { renderHome } from './views/home.js';
import { renderLearn } from './views/learn.js';
import { renderLibrary } from './views/library.js';
import { renderMap } from './views/map.js';
import { renderProgress } from './views/progress.js';
import { renderQuiz, renderReview } from './views/quiz.js';
import { openProfileDialog, renderSettings } from './views/settings.js';

const app = document.getElementById('app');
const topbar = document.getElementById('topbar');

const NAV = [
    ['#/', '🏠', '首页', 'home'],
    ['#/map', '🗺️', '地图', 'map'],
    ['#/library', '📚', '字库', 'library'],
    ['#/review', '🔁', '复习', 'review'],
    ['#/progress', '📈', '进度', 'progress'],
];

/** 路由表：[正则, 视图函数, 导航高亮键]。 */
const ROUTES = [
    [/^\/?$/, () => renderHome(app), 'home'],
    [/^\/map(?:\/(\d+))?$/, (m) => renderMap(app, { stage: m[1] }), 'map'],
    [/^\/group\/(\d+)$/, (m) => renderGroup(app, { id: m[1] }), 'map'],
    [/^\/learn\/(\d+)(?:\/(\d+))?$/, (m) => renderLearn(app, { id: m[1], i: m[2] }), 'map'],
    [/^\/quiz\/(\d+)$/, (m) => renderQuiz(app, { id: m[1] }), 'map'],
    [/^\/review$/, () => renderReview(app), 'review'],
    [/^\/char\/(.+)$/, (m) => renderChar(app, { c: m[1] }), 'library'],
    [/^\/library$/, () => renderLibrary(app), 'library'],
    [/^\/progress$/, () => renderProgress(app), 'progress'],
    [/^\/settings$/, () => renderSettings(app, {}, renderTopbar), 'settings'],
];

let cleanup = null;
let activeKey = 'home';

function renderTopbar() {
    const profile = getProfile();
    mount(
        topbar,
        h('a', { class: 'logo', href: '#/', 'aria-label': '小小识字乐园，回到首页' }, h('span', { class: 'logo-mark', text: '📖' }), h('span', { text: '小小识字乐园' })),
        h(
            'nav',
            { class: 'nav', 'aria-label': '主导航' },
            NAV.map(([href, icon, label, key]) =>
                h('a', { href, class: key === activeKey ? 'active' : '', 'aria-current': key === activeKey ? 'page' : null }, h('span', { class: 'nav-icon', text: icon }), h('span', { text: label })),
            ),
        ),
        profile
            ? h('a', { class: `profile-chip ${activeKey === 'settings' ? 'active' : ''}`, href: '#/settings', title: '设置 / 切换小朋友' }, h('span', { text: profile.avatar }), h('span', { class: 'pc-name', text: profile.name }))
            : null,
    );
}

function route() {
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    closeHoverCard();
    stopSpeaking();

    const path = location.hash.replace(/^#/, '') || '/';
    for (const [pattern, view, key] of ROUTES) {
        const match = path.match(pattern);
        if (match) {
            activeKey = key;
            renderTopbar();
            try {
                cleanup = view(match) || null;
            } catch (err) {
                console.error(err);
                mount(app, h('p', { class: 'empty', text: `页面出错了：${err.message}` }), h('a', { class: 'btn', href: '#/', text: '回首页' }));
            }
            window.scrollTo({ top: 0 });
            app.focus({ preventScroll: true });
            return;
        }
    }
    location.hash = '#/';
}

async function start() {
    try {
        await loadData();
    } catch (err) {
        mount(
            app,
            h('div', { class: 'card' }, h('h2', { text: '课程数据加载失败' }), h('p', { text: err.message }), h('p', { class: 'muted', text: '请通过 Web 服务器访问本页面（例如运行 start.bat，或放在 Apache 的 htdoc 目录下），不能直接双击打开 index.html。' })),
        );
        return;
    }
    probeAudio();
    window.addEventListener('hashchange', route);
    if (!getProfile()) {
        renderTopbar();
        mount(app, h('p', { class: 'loading', text: '先创建一个小朋友的档案吧 😊' }));
        openProfileDialog(() => route(), true);
        return;
    }
    route();
}

start();
