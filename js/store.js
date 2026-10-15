/**
 * 学习进度存储（浏览器 localStorage，无需登录）。
 *
 * 数据结构：
 *   db = { v, current, settings, profiles: { [id]: profile } }
 *   profile = { id, name, avatar, pet, petBest, created, goal, chars, groups, days }
 *   pet = 宠物物种 id；petBest = 宠物曾达到的最高成长阶段（宠物不会退化）
 *   chars[c]  = { s: 1 学过 | 2 认识, b: 复习盒子 0~6, d: 下次复习时间戳, t: 首次学习时间, ok, ng }
 *   groups[id] = { done: 时间戳, stars: 1~3 }
 *   days[YYYY-MM-DD] = { n: 新学字数, k: 新认识字数, q: 测验次数 }
 */
import { D } from './data.js';
import { speciesById } from './pets.js';
import { dateKey } from './util.js';

const KEY = 'shizi.v1';
const DAY = 86400000;

/** 复习间隔（天），下标为盒子编号。 */
export const INTERVALS = [0, 1, 2, 4, 7, 15, 30];

const DEFAULT_SETTINGS = { rate: 0.85, voice: '', hoverSpeak: false, showPet: true };

let db = load();
const listeners = new Set();

/** 订阅数据变化（每次保存后触发），返回取消订阅函数。 */
export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            parsed.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
            return parsed;
        }
    } catch (err) {
        console.warn('读取进度失败', err);
    }
    return { v: 1, current: null, profiles: {}, settings: { ...DEFAULT_SETTINGS } };
}

let persistAsked = false;

/**
 * 申请持久化存储，避免磁盘空间紧张时浏览器自动清理本站数据。
 * 每个页面会话只申请一次；已授权时不会重复申请。
 * 注意：Chrome 按站点活跃度自动决定，Firefox 会弹出授权提示，Safari 支持有限。
 * @returns {Promise<boolean>} 当前是否已处于持久化状态
 */
export async function requestPersistentStorage() {
    if (persistAsked) return false;
    persistAsked = true;
    try {
        if (!navigator.storage || !navigator.storage.persist) return false;
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
    } catch (err) {
        console.warn('申请持久化存储失败', err);
        return false;
    }
}

function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(db));
        // 第一次成功写入后（即创建档案后）再申请，避免首次打开就弹授权提示
        requestPersistentStorage();
    } catch (err) {
        console.warn('保存进度失败', err);
    }
    listeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------- 设置
export function getSettings() {
    return db.settings;
}

export function updateSettings(patch) {
    db.settings = { ...db.settings, ...patch };
    save();
}

// ---------------------------------------------------------------- 档案
export function listProfiles() {
    return Object.values(db.profiles).sort((a, b) => a.created - b.created);
}

export function getProfile() {
    return db.profiles[db.current] || null;
}

/**
 * 新建小朋友档案。
 * @param {string} name 名字
 * @param {string} [pet] 宠物物种 id（见 pets.js），同时决定头像
 */
export function createProfile(name, pet) {
    const id = `p${Date.now().toString(36)}`;
    const species = speciesById(pet) || speciesById('fox');
    db.profiles[id] = {
        id,
        name: name.trim().slice(0, 12) || '小朋友',
        pet: species.id,
        avatar: species.emoji,
        petBest: 0,
        created: Date.now(),
        goal: 5,
        chars: {},
        groups: {},
        days: {},
    };
    db.current = id;
    save();
    return db.profiles[id];
}

export function switchProfile(id) {
    if (db.profiles[id]) {
        db.current = id;
        save();
    }
}

export function updateProfile(patch) {
    const p = getProfile();
    if (!p) return;
    Object.assign(p, patch);
    save();
}

export function deleteProfile(id) {
    delete db.profiles[id];
    if (db.current === id) db.current = Object.keys(db.profiles)[0] || null;
    save();
}

export function resetProgress() {
    const p = getProfile();
    if (!p) return;
    p.chars = {};
    p.groups = {};
    p.days = {};
    save();
}

// ---------------------------------------------------------------- 备份
export function exportData() {
    return JSON.stringify(db);
}

/** 导入备份，返回导入的档案数量。 */
export function importData(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !parsed.profiles) {
        throw new Error('不是有效的备份文件');
    }
    db = {
        v: 1,
        current: parsed.current && parsed.profiles[parsed.current] ? parsed.current : Object.keys(parsed.profiles)[0] || null,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        profiles: parsed.profiles,
    };
    save();
    return Object.keys(db.profiles).length;
}

// ---------------------------------------------------------------- 字的学习状态
function day(p) {
    const key = dateKey();
    if (!p.days[key]) p.days[key] = { n: 0, k: 0, q: 0 };
    return p.days[key];
}

/** 字的状态：0 未学，1 学习中，2 已认识。 */
export function charState(ch) {
    const p = getProfile();
    return (p && p.chars[ch] && p.chars[ch].s) || 0;
}

export function charRecord(ch) {
    const p = getProfile();
    return (p && p.chars[ch]) || null;
}

/** 记录“看过这个字”。 */
export function markSeen(ch) {
    const p = getProfile();
    if (!p || p.chars[ch]) return;
    p.chars[ch] = { s: 1, b: 0, d: Date.now(), t: Date.now(), ok: 0, ng: 0 };
    day(p).n += 1;
    save();
}

function schedule(rec) {
    rec.d = Date.now() + INTERVALS[Math.max(rec.b, 1)] * DAY;
}

/** 标记“我认识了”。 */
export function markKnown(ch) {
    const p = getProfile();
    if (!p) return;
    markSeen(ch);
    const rec = p.chars[ch];
    if (rec.s !== 2) {
        rec.s = 2;
        rec.b = Math.max(rec.b, 1);
        day(p).k += 1;
    }
    schedule(rec);
    save();
}

/** 标记“还不熟”，回到学习中。 */
export function markUnknown(ch) {
    const p = getProfile();
    if (!p || !p.chars[ch]) return;
    const rec = p.chars[ch];
    if (rec.s === 2) day(p).k = Math.max(0, day(p).k - 1);
    rec.s = 1;
    rec.b = 0;
    rec.d = Date.now();
    save();
}

/** 测验作答：答对则升级复习间隔；答错则降级并明天再复习。 */
export function recordAnswer(ch, correct) {
    const p = getProfile();
    if (!p) return;
    markSeen(ch);
    const rec = p.chars[ch];
    if (correct) {
        rec.ok += 1;
        if (rec.s !== 2) {
            rec.s = 2;
            rec.b = 1;
            day(p).k += 1;
        } else {
            rec.b = Math.min(rec.b + 1, INTERVALS.length - 1);
        }
        schedule(rec);
    } else {
        rec.ng += 1;
        rec.b = Math.max(rec.b - 2, 0);
        rec.d = Date.now() + DAY;
        if (rec.b === 0) rec.s = rec.s === 2 ? 2 : 1;
    }
    save();
}

/** 记录一次测验（用于连续打卡）。 */
export function recordQuiz() {
    const p = getProfile();
    if (!p) return;
    day(p).q += 1;
    save();
}

// ---------------------------------------------------------------- 分组 / 统计
export function completeGroup(id, stars) {
    const p = getProfile();
    if (!p) return;
    const old = p.groups[id];
    p.groups[id] = { done: Date.now(), stars: Math.max(stars, (old && old.stars) || 0) };
    save();
}

export function groupRecord(id) {
    const p = getProfile();
    return (p && p.groups[id]) || null;
}

/** 分组进度：{ known, seen, total, state: 'new' | 'doing' | 'done' }。 */
export function groupProgress(group) {
    const p = getProfile();
    let known = 0;
    let seen = 0;
    for (const ch of group.list) {
        const s = (p && p.chars[ch] && p.chars[ch].s) || 0;
        if (s >= 1) seen += 1;
        if (s === 2) known += 1;
    }
    const total = group.list.length;
    const rec = groupRecord(group.id);
    let state = 'new';
    if (rec || known === total) state = 'done';
    else if (seen > 0) state = 'doing';
    return { known, seen, total, state, stars: rec ? rec.stars : 0 };
}

/** 下一个推荐学习的分组：第一个未完成的分组。 */
export function nextGroup() {
    return D.groups.find((g) => groupProgress(g).state !== 'done') || null;
}

/** 需要复习的字（学习中的字 + 到期的已认识字）。 */
export function dueChars(limit = Infinity) {
    const p = getProfile();
    if (!p) return [];
    const now = Date.now();
    return Object.entries(p.chars)
        .filter(([, r]) => r.s === 1 || r.d <= now)
        .sort((a, b) => a[1].d - b[1].d)
        .slice(0, limit)
        .map(([ch]) => ch);
}

/** 汇总统计。 */
export function stats() {
    const p = getProfile();
    const result = { known: 0, learning: 0, todayNew: 0, streak: 0, activeDays: 0, quizzes: 0 };
    if (!p) return result;
    for (const rec of Object.values(p.chars)) {
        if (rec.s === 2) result.known += 1;
        else result.learning += 1;
    }
    const today = p.days[dateKey()];
    result.todayNew = today ? today.n : 0;
    result.activeDays = Object.keys(p.days).filter((k) => p.days[k].n || p.days[k].q || p.days[k].k).length;
    result.quizzes = Object.values(p.days).reduce((sum, d) => sum + (d.q || 0), 0);

    // 连续打卡：今天没学则从昨天开始往前数
    let cursor = Date.now();
    const active = (ts) => {
        const d = p.days[dateKey(ts)];
        return d && (d.n || d.q || d.k);
    };
    if (!active(cursor)) cursor -= DAY;
    while (active(cursor)) {
        result.streak += 1;
        cursor -= DAY;
    }
    return result;
}

/** 最近 n 天的学习数据，用于柱状图。 */
export function recentDays(n = 14) {
    const p = getProfile();
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
        const ts = Date.now() - i * DAY;
        const key = dateKey(ts);
        const d = (p && p.days[key]) || { n: 0, k: 0, q: 0 };
        out.push({ key, label: key.slice(5), n: d.n, k: d.k, q: d.q });
    }
    return out;
}
