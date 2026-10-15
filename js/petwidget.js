/**
 * 页面右侧的宠物伙伴：随“已认识字数”成长，可点击互动，可隐藏。
 *
 * - 订阅 store 变化，学习进度一变就刷新；
 * - 升级（成长阶段提高）时撒花并提示；宠物不会退化（记录在 profile.petBest）；
 * - 显示开关保存在 settings.showPet，也可在设置页里切换。
 */
import { MAX_STAGE, growthInfo, petElement, petTitle, speciesById, speciesOf } from './pets.js';
import { getProfile, getSettings, stats, subscribe, updateProfile, updateSettings } from './store.js';
import { confetti, h, mount, toast } from './util.js';

const PRAISE = ['你真棒！', '我们一起加油！', '每天认几个字，我就长得快。', '今天也要开开心心识字哦。', '认识的字越多，我越厉害！'];

let root = null;
let pending = false;
let lastKey = '';
let lastKnown = -1;
let lastProfile = '';
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

function pickMessage(profile, info, id) {
    if (info.stage === 0) return `快帮我孵化吧，再认识 ${info.need} 个字，我就出生啦！`;
    const st = stats();
    const goal = profile.goal || 5;
    const options = [...PRAISE];
    if (st.todayNew < goal) options.push(`今天再学 ${goal - st.todayNew} 个字，就完成目标啦！`);
    else options.push('今天的目标完成啦，太厉害了！');
    if (info.nextAt !== null) options.push(`再认识 ${info.need} 个字，我就会长成「${petTitle(id, info.stage + 1)}」！`);
    else options.push('我已经长成最强的样子啦，谢谢你！');
    return options[Math.floor(Math.random() * options.length)];
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
    const known = stats().known;
    const info = growthInfo(id, known);

    // 成长：只升不降。旧档案第一次进来时静默记录，不触发庆祝。
    let best = typeof profile.petBest === 'number' ? profile.petBest : info.stage;
    let evolved = false;
    if (info.stage > best) {
        best = info.stage;
        evolved = true;
    }
    if (profile.petBest !== best || profile.pet !== id) updateProfile({ petBest: best, pet: id });

    const sameProfile = lastProfile === profile.id;
    const grew = sameProfile && lastKnown >= 0 && known > lastKnown;
    const key = [profile.id, id, best, known].join('|');
    if (key === lastKey) return;
    lastKey = key;
    lastProfile = profile.id;
    lastKnown = known;

    const species = speciesById(id);
    const title = petTitle(id, best);
    const bubble = h('div', { class: 'pet-bubble', role: 'status', 'aria-live': 'polite' });
    const stage = h('button', { class: 'pet-stage', type: 'button', 'aria-label': `${title}，点我互动`, title: '点我互动' }, petElement(id, best, 168));

    const say = (text) => {
        bubble.textContent = text;
        bubble.classList.add('show');
        stage.classList.remove('jump');
        void stage.offsetWidth; // 重置动画
        stage.classList.add('jump');
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 4200);
    };
    stage.addEventListener('click', () => say(pickMessage(getProfile() || profile, growthInfo(id, stats().known), id)));

    const barLabel = info.nextAt === null ? '已经是最强形态啦' : `再认识 ${info.need} 个字，长成「${petTitle(id, info.stage + 1)}」`;
    const lv = h('span', { class: 'pet-lv', text: `Lv.${best + 1}` });
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
            h('div', { class: 'pet-name' }, h('strong', { text: title }), lv),
            h('div', { class: 'pet-species', text: species.name }),
            h(
                'div',
                { class: 'pbar', role: 'progressbar', 'aria-valuenow': String(info.pct), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': '成长进度' },
                h('div', { class: 'pbar-fill', style: { width: `${info.pct}%` } }),
            ),
            h('div', { class: 'pet-next', text: barLabel }),
        ),
    );

    if (evolved && best <= MAX_STAGE) {
        confetti(60);
        toast(best === 1 ? `🎉 宠物蛋孵化啦！是一只${species.name}！` : `🎉 你的${species.name}长大了：${title}！`, 3600);
        setTimeout(() => say(best === 1 ? '哇，我出生啦！谢谢你！' : `我变成「${title}」啦！`), 400);
    } else if (grew) {
        stage.classList.add('jump');
    }
}
