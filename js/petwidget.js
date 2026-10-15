/**
 * 页面右侧的宠物伙伴：随“已认识字数”成长，可点击互动，可隐藏。
 *
 * 激励设计（按每天学 5 个字算）：
 *   - 每日喂食：今天每学一个新字就喂宠物一口，吃饱（达到每日目标）时庆祝，每天都有成就感；
 *   - 等级：前期每认 5 个字（约 1 天）升 1 级，之后逐渐放宽，最慢约 6 天；
 *   - 形态：外观进化，间隔较远，但形态内体型会随进度平滑变大；
 *   - 宠物按“历史最高已认识字数”（profile.petPeak）成长，所以不会退化。
 * 显示开关保存在 settings.showPet，也可在设置页里切换。
 */
import { growthInfo, levelFor, petElement, speciesById, speciesOf, stageFor } from './pets.js';
import { getProfile, getSettings, stats, subscribe, updateProfile, updateSettings } from './store.js';
import { confetti, h, mount, toast } from './util.js';

const PRAISE = ['你真棒！', '我们一起加油！', '每天认几个字，我就长得快。', '今天也要开开心心识字哦。', '认识的字越多，我越厉害！'];
const MAX_FEED_DOTS = 10;

let root = null;
let pending = false;
let lastKey = '';
let lastProfile = '';
let lastKnown = -1;
let lastToday = -1;
let bubbleTimer = 0;

/** 初始化：挂载容器并订阅进度变化。应在 DOM 就绪后调用一次。 */
export function initPet() {
    root = document.getElementById('pet-root');
    if (!root) return;
    subscribe(scheduleRender);
    render();
}

/** 主动刷新（例如路由切换后）。 */
export function refreshPet() {
    scheduleRender();
}

function scheduleRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
        pending = false;
        render();
    });
}

/** 点击宠物时说的话。 */
function pickMessage(profile, info, id, todayNew) {
    if (info.stage === 0) return `快帮我孵化吧，再认识 ${info.needStage} 个字，我就出生啦！`;
    const goal = profile.goal || 5;
    const options = [...PRAISE];
    if (todayNew < goal) options.push(`我还饿着呢，今天再学 ${goal - todayNew} 个字喂饱我吧！`);
    else options.push('我吃得饱饱的，谢谢你今天认真识字！');
    if (info.nextLevelAt !== null) options.push(`再认识 ${info.needLevel} 个字，我就升到 Lv.${info.level + 1} 啦！`);
    if (info.nextTitle) options.push(`继续加油，我以后会进化成「${info.nextTitle}」！`);
    return options[Math.floor(Math.random() * options.length)];
}

/** 今日喂食进度：一排小圆点 + 文字。 */
function feedRow(todayNew, goal) {
    const dots = Math.min(goal, MAX_FEED_DOTS);
    const lit = Math.min(dots, Math.round((Math.min(todayNew, goal) / goal) * dots));
    const full = todayNew >= goal;
    return h(
        'div',
        { class: `pet-feed ${full ? 'full' : ''}`, 'aria-label': `今日喂食 ${Math.min(todayNew, goal)}/${goal}` },
        h('div', { class: 'pet-feed-title', text: full ? '🍖 今天吃饱啦！' : `🍖 今日喂食 ${todayNew}/${goal}` }),
        h('div', { class: 'pet-feed-dots', 'aria-hidden': 'true' }, Array.from({ length: dots }, (_, i) => h('i', { class: i < lit ? 'on' : '' }))),
    );
}

function render() {
    if (!root) return;
    const profile = getProfile();
    const visible = Boolean(profile) && getSettings().showPet !== false;
    document.body.classList.toggle('has-pet', visible);
    if (!visible) {
        root.replaceChildren();
        lastKey = '';
        return;
    }

    const id = speciesOf(profile);
    const st = stats();
    const known = st.known;
    const goal = profile.goal || 5;
    const todayNew = st.todayNew;

    // 成长只升不降。旧档案第一次进来时没有 petPeak，静默记录，不触发庆祝。
    const prevPeak = typeof profile.petPeak === 'number' ? profile.petPeak : known;
    const peak = Math.max(prevPeak, known);
    const evolved = stageFor(peak) > stageFor(prevPeak);
    const levelUp = levelFor(peak) > levelFor(prevPeak);
    if (profile.petPeak !== peak || profile.pet !== id) updateProfile({ petPeak: peak, pet: id });

    const sameProfile = lastProfile === profile.id;
    const fedNow = sameProfile && lastToday >= 0 && lastToday < goal && todayNew >= goal;
    const grew = sameProfile && lastKnown >= 0 && known > lastKnown;
    const key = [profile.id, id, peak, todayNew, goal].join('|');
    if (key === lastKey) return;
    lastKey = key;
    lastProfile = profile.id;
    lastKnown = known;
    lastToday = todayNew;

    const info = growthInfo(id, peak);
    const species = speciesById(id);
    const bubble = h('div', { class: 'pet-bubble', role: 'status', 'aria-live': 'polite' });
    const stage = h('button', { class: 'pet-stage', type: 'button', 'aria-label': `${info.title}，点我互动`, title: '点我互动' }, petElement(id, info.stage, 168, info.grow));

    const say = (text) => {
        bubble.textContent = text;
        bubble.classList.add('show');
        stage.classList.remove('jump');
        void stage.offsetWidth; // 重置动画
        stage.classList.add('jump');
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 4200);
    };
    stage.addEventListener('click', () => {
        const p = getProfile() || profile;
        say(pickMessage(p, growthInfo(id, Math.max(p.petPeak || 0, stats().known)), id, stats().todayNew));
    });

    const levelText = info.nextLevelAt === null ? '已经满级啦！' : `再认识 ${info.needLevel} 个字，升到 Lv.${info.level + 1}`;
    const stageText = info.nextTitle ? `再认识 ${info.needStage} 个字，进化成「${info.nextTitle}」` : '已经是最强形态啦';
    mount(
        root,
        h(
            'aside',
            { class: 'pet-widget', 'aria-label': `学习伙伴：${species.name}` },
            h('button', {
                class: 'pet-hide',
                type: 'button',
                text: '×',
                'aria-label': '隐藏宠物',
                title: '隐藏宠物（可在设置里重新显示）',
                onclick: () => {
                    updateSettings({ showPet: false });
                    toast('宠物已隐藏，可以在“设置”里重新显示');
                },
            }),
            bubble,
            stage,
            h('div', { class: 'pet-name' }, h('strong', { text: info.title }), h('span', { class: 'pet-lv', text: `Lv.${info.level}` })),
            h('div', { class: 'pet-species', text: species.name }),
            h(
                'div',
                { class: 'pbar', role: 'progressbar', 'aria-valuenow': String(info.levelPct), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': '升级进度' },
                h('div', { class: 'pbar-fill', style: { width: `${info.levelPct}%` } }),
            ),
            h('div', { class: 'pet-next', text: levelText }),
            h('div', { class: 'pet-next pet-next-stage', text: stageText }),
            feedRow(todayNew, goal),
        ),
    );

    if (evolved) {
        confetti(60);
        toast(info.stage === 1 ? `🎉 宠物蛋孵化啦！是一只${species.name}！` : `🎉 你的${species.name}进化了：${info.title}！`, 3600);
        setTimeout(() => say(info.stage === 1 ? '哇，我出生啦！谢谢你！' : `我进化成「${info.title}」啦！`), 400);
    } else if (fedNow) {
        confetti(30);
        toast(`🍖 今天的目标完成，${species.name}吃饱啦！`, 3000);
        setTimeout(() => say('好饱呀，今天的目标完成啦，你真棒！'), 300);
    } else if (levelUp) {
        confetti(18);
        setTimeout(() => say(`升级啦！我现在是 Lv.${info.level}！`), 300);
    } else if (grew) {
        stage.classList.add('jump');
    }
}
