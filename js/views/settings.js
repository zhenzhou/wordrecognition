/**
 * 设置 / 家长区：小朋友档案、每日目标、语音、备份与恢复、清空进度。
 */
import { D } from '../data.js';
import { canSpeak, listVoices, speakText } from '../speech.js';
import { MAX_LEVEL, SPECIES, STAGE_THRESHOLDS, growthInfo, petElement, petTitle, profileAvatar, profilePeak, speciesById, speciesOf } from '../pets.js';
import {
    createProfile,
    deleteProfile,
    exportData,
    getProfile,
    getSettings,
    importData,
    listProfiles,
    resetProgress,
    subscribe,
    switchProfile,
    updateProfile,
    updateSettings,
} from '../store.js';
import { dateKey, h, modal, mount, toast } from '../util.js';

/**
 * 宠物选择器（单选按钮组）。展示各物种“青年”阶段的样子。
 * @param {string} selected 当前选中的物种 id
 * @param {Function} onPick 选中回调 (id) => void
 */
function petPicker(selected, onPick) {
    const box = h('div', { class: 'pet-pick', role: 'radiogroup', 'aria-label': '选择宠物' });
    SPECIES.forEach((sp) => {
        const on = sp.id === selected;
        box.appendChild(
            h(
                'button',
                {
                    class: `pet-pick-btn ${on ? 'on' : ''}`,
                    type: 'button',
                    role: 'radio',
                    'aria-checked': on ? 'true' : 'false',
                    title: sp.desc,
                    onclick: (e) => {
                        box.querySelectorAll('.pet-pick-btn').forEach((b) => {
                            b.classList.remove('on');
                            b.setAttribute('aria-checked', 'false');
                        });
                        e.currentTarget.classList.add('on');
                        e.currentTarget.setAttribute('aria-checked', 'true');
                        onPick(sp.id);
                    },
                },
                petElement(sp.id, 3, 72),
                h('span', { text: sp.name }),
            ),
        );
    });
    return box;
}

/**
 * 弹出“新建小朋友档案”对话框。
 * @param {Function} onDone 创建成功后的回调
 * @param {boolean} [first] 是否首次使用（不可取消）
 */
export function openProfileDialog(onDone, first = false) {
    let pet = SPECIES[0].id;
    const nameInput = h('input', {
        class: 'input',
        type: 'text',
        maxlength: '12',
        placeholder: '小朋友的名字或昵称',
        'aria-label': '名字',
    });
    const avatarBox = petPicker(pet, (id) => {
        pet = id;
    });
    modal({
        title: first ? '欢迎来到小小识字乐园 🎉' : '新建小朋友',
        dismissible: !first,
        body: h(
            'div',
            { class: 'form' },
            h('p', { class: 'muted', text: first ? '先给小朋友起个名字、领养一只宠物蛋。认识的字越多，宠物长得越大。不需要注册登录，学习进度保存在这台电脑的浏览器里。' : '每个小朋友有自己的识字进度和宠物。' }),
            h('label', {}, '名字', nameInput),
            h('div', { class: 'form-field' }, h('span', { class: 'form-label', text: '选一只宠物（也是你的头像）' }), avatarBox),
        ),
        actions: [
            {
                label: '开始',
                primary: true,
                onClick: () => {
                    createProfile(nameInput.value || '小朋友', pet);
                    onDone();
                },
            },
        ],
    });
}

function profileSection(rerender) {
    const current = getProfile();
    const list = listProfiles();
    const rows = list.map((p) =>
        h(
            'li',
            { class: p.id === current.id ? 'current' : '' },
            h('span', { class: 'pr-avatar' }, profileAvatar(p, 44)),
            h('span', { class: 'pr-name', text: p.name }),
            h('span', { class: 'muted', text: `认识 ${Object.values(p.chars).filter((r) => r.s === 2).length} 字` }),
            p.id === current.id
                ? h('span', { class: 'badge badge-done', text: '当前' })
                : h('button', { class: 'btn btn-small', type: 'button', text: '切换', onclick: () => { switchProfile(p.id); rerender(); toast(`已切换到 ${p.name}`); } }),
            list.length > 1
                ? h('button', {
                      class: 'btn btn-small btn-danger',
                      type: 'button',
                      text: '删除',
                      onclick: () => {
                          if (confirm(`确定删除“${p.name}”的全部学习记录吗？此操作不能恢复。`)) {
                              deleteProfile(p.id);
                              rerender();
                          }
                      },
                  })
                : null,
        ),
    );
    const nameInput = h('input', { class: 'input', type: 'text', maxlength: '12', value: current.name, 'aria-label': '修改名字' });
    return h(
        'section',
        { class: 'card' },
        h('h2', { text: '👶 小朋友' }),
        h('ul', { class: 'profile-list' }, rows),
        h(
            'div',
            { class: 'inline-form' },
            nameInput,
            h('button', { class: 'btn btn-small', type: 'button', text: '修改当前名字', onclick: () => { updateProfile({ name: nameInput.value.trim().slice(0, 12) || current.name }); rerender(); toast('已保存'); } }),
            h('button', { class: 'btn btn-small btn-primary', type: 'button', text: '＋ 新建小朋友', onclick: () => openProfileDialog(rerender) }),
        ),
    );
}

function petSection(rerender) {
    const p = getProfile();
    const id = speciesOf(p);
    const species = speciesById(id);
    const info = growthInfo(id, profilePeak(p));
    const best = info.stage;
    const show = h('input', {
        type: 'checkbox',
        checked: getSettings().showPet !== false,
        onchange: (e) => {
            updateSettings({ showPet: e.target.checked });
            toast(e.target.checked ? '宠物回来啦' : '宠物已隐藏');
        },
    });
    // 在页面右侧点“×”隐藏宠物时，同步这里的开关；视图被替换后自动取消订阅
    const off = subscribe(() => {
        if (!show.isConnected) off();
        else show.checked = getSettings().showPet !== false;
    });
    const stages = h(
        'ol',
        { class: 'pet-stages', 'aria-label': `${species.name}的成长阶段` },
        STAGE_THRESHOLDS.map((_, s) =>
            h(
                'li',
                { class: s <= best ? 'got' : '' },
                petElement(id, s, 72, s === best ? info.grow : undefined),
                h('span', { class: 'ps-title', text: petTitle(id, s) }),
                h('span', { class: 'ps-need muted', text: s === 0 ? '领养时' : `认识 ${STAGE_THRESHOLDS[s]} 字` }),
            ),
        ),
    );
    return h(
        'section',
        { class: 'card' },
        h('h2', { text: '🐾 学习宠物' }),
        h('p', { class: 'muted', text: `现在是「${info.title}」Lv.${info.level}（满级 Lv.${MAX_LEVEL}）。每认识一些字就升一级，前期每认 5 个字升 1 级，后面逐渐放慢；每天学满目标字数还能把宠物喂饱。换一只宠物不会丢失成长进度。` }),
        h('label', { class: 'check' }, show, ' 在页面右侧显示宠物'),
        stages,
        h('p', { class: 'muted', text: '换一只宠物：' }),
        petPicker(id, (next) => {
            const sp = speciesById(next);
            updateProfile({ pet: next, avatar: sp.emoji });
            toast(`已换成${sp.name}`);
            rerender();
        }),
    );
}

function learningSection() {
    const p = getProfile();
    const goal = h(
        'select',
        {
            class: 'input',
            'aria-label': '每日新学字数目标',
            onchange: (e) => {
                updateProfile({ goal: Number(e.target.value) });
                toast('已保存');
            },
        },
        [3, 5, 8, 10, 15, 20].map((n) => h('option', { value: String(n), selected: n === p.goal, text: `每天新学 ${n} 个字` })),
    );
    return h('section', { class: 'card' }, h('h2', { text: '🎯 学习目标' }), h('p', { class: 'muted', text: '建议每天 5 个字左右，一年左右就能学完三千字。' }), goal);
}

function voiceSection() {
    const s = getSettings();
    const voices = listVoices();
    const select = h(
        'select',
        {
            class: 'input',
            'aria-label': '朗读声音',
            onchange: (e) => updateSettings({ voice: e.target.value }),
        },
        h('option', { value: '', text: '自动选择（推荐）' }),
        voices.map((v) => h('option', { value: v.name, selected: v.name === s.voice, text: `${v.name}（${v.lang}）` })),
    );
    const rate = h('input', {
        type: 'range',
        min: '0.5',
        max: '1.2',
        step: '0.05',
        value: String(s.rate),
        'aria-label': '朗读语速',
        oninput: (e) => updateSettings({ rate: Number(e.target.value) }),
    });
    const hover = h('input', {
        type: 'checkbox',
        checked: s.hoverSpeak,
        onchange: (e) => updateSettings({ hoverSpeak: e.target.checked }),
    });
    return h(
        'section',
        { class: 'card' },
        h('h2', { text: '🔊 语音朗读' }),
        canSpeak()
            ? h('p', { class: 'muted', text: `检测到 ${voices.length} 个中文语音。` })
            : h('p', { class: 'notice', text: '当前浏览器没有找到中文语音，朗读功能暂不可用。建议使用 Windows 自带的 Edge 浏览器（内置高质量中文语音），或在系统设置里安装中文语音包。' }),
        h('label', {}, '声音', select),
        h('label', {}, '语速（慢 → 快）', rate),
        h('label', { class: 'check' }, hover, ' 鼠标放在字上时自动朗读'),
        h('button', { class: 'btn btn-small', type: 'button', text: '试听：小朋友你好', onclick: () => speakText('小朋友你好，我们一起来识字吧') }),
    );
}

function backupSection(rerender) {
    const fileInput = h('input', {
        type: 'file',
        accept: 'application/json,.json',
        class: 'visually-hidden',
        id: 'import-file',
        onchange: async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const n = importData(await file.text());
                toast(`导入成功，共 ${n} 个小朋友的记录`);
                rerender();
            } catch (err) {
                toast(`导入失败：${err.message}`);
            }
        },
    });
    return h(
        'section',
        { class: 'card' },
        h('h2', { text: '💾 备份与恢复' }),
        h('p', { class: 'muted', text: '进度只保存在当前浏览器里。清理浏览器数据或换电脑前，请先导出备份文件。' }),
        h(
            'div',
            { class: 'inline-form' },
            h('button', {
                class: 'btn btn-primary',
                type: 'button',
                text: '导出备份',
                onclick: () => {
                    const blob = new Blob([exportData()], { type: 'application/json' });
                    const a = h('a', { href: URL.createObjectURL(blob), download: `识字进度备份-${dateKey()}.json` });
                    a.click();
                    URL.revokeObjectURL(a.href);
                },
            }),
            h('label', { class: 'btn', for: 'import-file', text: '导入备份' }),
            fileInput,
            h('button', {
                class: 'btn btn-danger',
                type: 'button',
                text: '清空当前小朋友的进度',
                onclick: () => {
                    if (confirm('确定清空当前小朋友的全部识字进度吗？建议先导出备份。')) {
                        resetProgress();
                        toast('已清空');
                        rerender();
                    }
                },
            }),
        ),
    );
}

/** 渲染设置页。 */
export function renderSettings(root, _params, refreshShell) {
    const rerender = () => {
        refreshShell();
        renderSettings(root, _params, refreshShell);
    };
    mount(
        root,
        h('div', { class: 'page-head' }, h('h1', { text: '⚙️ 设置（家长区）' }), h('p', { class: 'muted', text: `课程共 ${D.total} 个字，分 ${D.stages.length} 个阶段、${D.groups.length} 组。` })),
        profileSection(rerender),
        petSection(rerender),
        learningSection(),
        voiceSection(),
        backupSection(rerender),
        h(
            'section',
            { class: 'card' },
            h('h2', { text: 'ℹ️ 关于' }),
            h('p', { class: 'muted', text: '字表：《通用规范汉字表》一级字表，按字频取常用三千字；笔顺：Make Me a Hanzi / hanzi-writer-data；词语释义：新华字典数据（自动整理）。' }),
        ),
    );
}
