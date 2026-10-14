/**
 * 设置 / 家长区：小朋友档案、每日目标、语音、备份与恢复、清空进度。
 */
import { D } from '../data.js';
import { canSpeak, listVoices, speakText } from '../speech.js';
import {
    AVATARS,
    createProfile,
    deleteProfile,
    exportData,
    getProfile,
    getSettings,
    importData,
    listProfiles,
    resetProgress,
    switchProfile,
    updateProfile,
    updateSettings,
} from '../store.js';
import { dateKey, h, modal, mount, toast } from '../util.js';

/**
 * 弹出“新建小朋友档案”对话框。
 * @param {Function} onDone 创建成功后的回调
 * @param {boolean} [first] 是否首次使用（不可取消）
 */
export function openProfileDialog(onDone, first = false) {
    let avatar = AVATARS[0];
    const nameInput = h('input', {
        class: 'input',
        type: 'text',
        maxlength: '12',
        placeholder: '小朋友的名字或昵称',
        'aria-label': '名字',
    });
    const avatarBox = h(
        'div',
        { class: 'avatar-pick', role: 'radiogroup', 'aria-label': '选择头像' },
        AVATARS.map((a, i) =>
            h('button', {
                class: `avatar-btn ${i === 0 ? 'on' : ''}`,
                type: 'button',
                role: 'radio',
                'aria-checked': i === 0 ? 'true' : 'false',
                text: a,
                onclick: (e) => {
                    avatar = a;
                    avatarBox.querySelectorAll('.avatar-btn').forEach((b) => {
                        b.classList.remove('on');
                        b.setAttribute('aria-checked', 'false');
                    });
                    e.currentTarget.classList.add('on');
                    e.currentTarget.setAttribute('aria-checked', 'true');
                },
            }),
        ),
    );
    modal({
        title: first ? '欢迎来到小小识字乐园 🎉' : '新建小朋友',
        dismissible: !first,
        body: h(
            'div',
            { class: 'form' },
            h('p', { class: 'muted', text: first ? '先给小朋友起个名字、选个头像。不需要注册登录，学习进度保存在这台电脑的浏览器里。' : '每个小朋友有自己的识字进度。' }),
            h('label', {}, '名字', nameInput),
            h('label', {}, '头像', avatarBox),
        ),
        actions: [
            {
                label: '开始',
                primary: true,
                onClick: () => {
                    createProfile(nameInput.value || '小朋友', avatar);
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
            h('span', { class: 'pr-avatar', text: p.avatar }),
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
