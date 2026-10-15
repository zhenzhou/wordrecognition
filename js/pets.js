/**
 * 宠物伙伴：物种数据、成长阶段、SVG 绘制。
 *
 * 这是一个纯模块（不依赖 store），宠物的成长阶段由“已认识的字数”决定：
 *   0 蛋 → 1 宝宝 → 2 少年 → 3 青年 → 4 成年 → 5 神兽
 * 所有图形都是代码生成的 SVG，不需要额外图片文件。
 */

/** 各成长阶段需要的“已认识字数”。 */
export const STAGE_THRESHOLDS = [0, 5, 50, 200, 600, 1500];
export const MAX_STAGE = STAGE_THRESHOLDS.length - 1;
const STAGE_SUFFIX = ['蛋', '宝宝', '少年', '青年', '成年', '神兽'];
/** 各阶段整体缩放（越小越幼小）。 */
const STAGE_SCALE = [1, 0.58, 0.7, 0.82, 0.92, 1];
/** 九尾狐各阶段的尾巴数量。 */
const FOX_TAILS = [0, 1, 3, 5, 7, 9];

const INK = '#2b2438';
const NOSE = '#4a3030';
let uidCounter = 0;

// ---------------------------------------------------------------- 绘图小工具
/** 把左侧图形同时画到右侧（水平镜像）。 */
const twin = (s) => `${s}<g transform="translate(200 0) scale(-1 1)">${s}</g>`;

const LEAF = 'M0 0 C-30 -16 -34 -66 0 -108 C34 -66 30 -16 0 0Z';
const LEAF_TIP = 'M0 -108 C-6 -96 -15 -86 -18 -75 C-8 -80 8 -80 18 -75 C15 -86 6 -96 0 -108Z';

/**
 * 扇形排列的尾巴/羽毛。
 * @param {number} n 数量
 * @param {string[]} fills 轮流使用的填充色
 * @param {string} tip 尖端颜色
 * @param {string} line 描边色
 * @param {Object} [o] { origin, span, single, scale }
 */
function fan(n, fills, tip, line, o = {}) {
    if (n <= 0) return '';
    // 数量少时收拢，数量多时展开成扇形（最大 150 度）
    const { origin = [100, 152], span = Math.min(150, 36 + 14 * n), single = 58, scale = 1 } = o;
    const angles = n === 1 ? [single] : Array.from({ length: n }, (_, i) => -span / 2 + (span * i) / (n - 1));
    return angles
        .map((a, i) => ({ a, i }))
        .sort((p, q) => Math.abs(q.a) - Math.abs(p.a))
        .map(
            ({ a, i }) =>
                `<g transform="translate(${origin[0]} ${origin[1]}) rotate(${a.toFixed(1)}) scale(${scale})">` +
                `<path d="${LEAF}" fill="${fills[i % fills.length]}" stroke="${line}" stroke-width="2.5" stroke-linejoin="round"/>` +
                `<path d="${LEAF_TIP}" fill="${tip}"/></g>`,
        )
        .join('');
}

/** 弯曲的尾巴，可带条纹。 */
function curl(color, stripe, width = 14, d = 'M128 170 C172 176 186 138 170 106') {
    return (
        `<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round"/>` +
        (stripe ? `<path d="${d}" stroke="${stripe}" stroke-width="${width}" fill="none" stroke-dasharray="6 10" stroke-dashoffset="-4"/>` : '')
    );
}

const whiskers = () =>
    twin(`<path d="M54 106 L30 100 M54 113 L28 115 M56 120 L34 129" stroke="${NOSE}" stroke-width="1.8" stroke-linecap="round" opacity="0.55" fill="none"/>`);

// ---------------------------------------------------------------- 物种定义
/**
 * 每个物种可提供的钩子（均返回 SVG 片段字符串）：
 *   tail(stage) 尾巴 / behind(stage) 头后装饰 / ears() 耳朵 / bodyMarks() 身体花纹
 *   faceBase() 脸底（眼睛之前）/ underEyes() 眼周 / marks(stage) 脸部花纹 / top(stage) 头顶装饰
 * muzzle 为口鼻部颜色（null 表示没有）；nose 为 'normal' | 'beak' | 'none'。
 */
const DEFS = {
    fox: {
        name: '九尾狐',
        emoji: '🦊',
        desc: '尾巴会越长越多，最后变成九条',
        fur: '#ff9d3a',
        dark: '#d96b12',
        belly: '#fff3df',
        line: '#c4560a',
        muzzle: '#fff3df',
        stageNames: ['狐蛋', '一尾小狐', '三尾灵狐', '五尾妖狐', '七尾仙狐', '九尾天狐'],
        tail: (stage, c) => fan(FOX_TAILS[stage], [c.fur, '#ffb561'], stage === 5 ? '#a8ecff' : '#ffffff', c.dark, { origin: [100, 172], scale: 1.12, span: Math.min(130, 30 + 12 * FOX_TAILS[stage]), single: 50 }),
        ears: (c) => twin(`<polygon points="56,80 44,14 98,54" fill="${c.fur}" stroke="${c.line}" stroke-width="3" stroke-linejoin="round"/><polygon points="58,68 52,34 84,56" fill="#fff3df"/>`),
        faceBase: () => twin('<polygon points="50,102 76,100 62,128" fill="#ffffff"/>'),
        marks: () => '<path d="M100 64 C93 72 93 79 100 84 C107 79 107 72 100 64Z" fill="#e8505b"/>',
    },
    tiger: {
        name: '老虎',
        emoji: '🐯',
        desc: '额头有“王”字，越长越威风',
        fur: '#ffab3d',
        dark: INK,
        belly: '#fff3df',
        line: '#c4630f',
        muzzle: '#fff3df',
        stageNames: ['虎蛋', '小虎崽', '少年虎', '青年虎', '成年虎', '虎王'],
        tail: (stage, c) => curl(c.fur, c.dark, 15),
        ears: (c) => twin(`<circle cx="62" cy="62" r="17" fill="${c.fur}" stroke="${c.line}" stroke-width="2.5"/><circle cx="62" cy="63" r="9" fill="#fff3df"/>`),
        bodyMarks: (c) => twin(`<path d="M62 138 l12 2 M60 150 l14 0 M63 162 l12 -3" stroke="${c.dark}" stroke-width="4.5" stroke-linecap="round" fill="none"/>`),
        marks: (stage, c) =>
            `<path d="M91 68 H109 M93 76 H107 M95 84 H105 M100 62 V88" stroke="${c.dark}" stroke-width="4" stroke-linecap="round" fill="none"/>` +
            twin(`<path d="M51 98 l14 3 M51 110 l14 -2 M54 121 l13 -6" stroke="${c.dark}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`) +
            whiskers(),
    },
    panda: {
        name: '熊猫',
        emoji: '🐼',
        desc: '圆滚滚的国宝，爱吃竹子',
        fur: '#ffffff',
        dark: INK,
        belly: '#ffffff',
        line: '#8d86a0',
        limb: INK,
        muzzle: '#ffffff',
        stageNames: ['熊猫蛋', '熊猫宝宝', '少年熊猫', '青年熊猫', '成年熊猫', '国宝熊猫'],
        tail: () => '<circle cx="136" cy="176" r="11" fill="#ffffff" stroke="#8d86a0" stroke-width="2.5"/>',
        ears: (c) => twin(`<circle cx="62" cy="62" r="17" fill="${c.dark}"/>`),
        underEyes: (c) => twin(`<ellipse cx="80" cy="98" rx="12" ry="15" transform="rotate(22 80 98)" fill="${c.dark}"/>`),
    },
    rabbit: {
        name: '兔子',
        emoji: '🐰',
        desc: '长耳朵蹦蹦跳跳',
        fur: '#ffffff',
        dark: '#ffb3c6',
        belly: '#ffffff',
        line: '#d3bfd6',
        muzzle: '#ffffff',
        stageNames: ['兔蛋', '兔宝宝', '小白兔', '青年兔', '成年兔', '月兔神兽'],
        tail: () => '<circle cx="137" cy="176" r="12" fill="#ffffff" stroke="#d3bfd6" stroke-width="2.5"/>',
        ears: (c) => twin(`<ellipse cx="80" cy="32" rx="13" ry="33" transform="rotate(-10 80 58)" fill="${c.fur}" stroke="${c.line}" stroke-width="2.5"/><ellipse cx="80" cy="34" rx="6.5" ry="24" transform="rotate(-10 80 58)" fill="#ffc2d1"/>`),
        marks: () => '<rect x="95" y="114" width="10" height="9" rx="2.5" fill="#ffffff" stroke="#d3bfd6" stroke-width="1.6"/>',
    },
    cat: {
        name: '猫咪',
        emoji: '🐱',
        desc: '软软的小猫，胡须会抖动',
        fur: '#aebbd6',
        dark: '#7d8bab',
        belly: '#ffffff',
        line: '#6b7894',
        muzzle: '#ffffff',
        noseColor: '#ff8fa3',
        stageNames: ['猫蛋', '小奶猫', '少年猫', '青年猫', '成年猫', '喵星神兽'],
        tail: (stage, c) => curl(c.fur, null, 13),
        ears: (c) => twin(`<polygon points="56,78 52,30 92,58" fill="${c.fur}" stroke="${c.line}" stroke-width="3" stroke-linejoin="round"/><polygon points="61,68 58,42 82,58" fill="#ffc2d1"/>`),
        marks: (stage, c) => `<path d="M91 70 V80 M100 67 V80 M109 70 V80" stroke="${c.dark}" stroke-width="3.5" stroke-linecap="round" fill="none"/>` + whiskers(),
    },
    dog: {
        name: '小狗',
        emoji: '🐶',
        desc: '忠诚又活泼的好朋友',
        fur: '#e8bb7e',
        dark: '#8c5a2b',
        belly: '#fff4e3',
        line: '#a8743a',
        muzzle: '#fff4e3',
        stageNames: ['狗蛋', '小奶狗', '少年犬', '青年犬', '成年犬', '神犬'],
        tail: (stage, c) => curl(c.fur, null, 12, 'M132 170 C152 168 160 152 156 136'),
        ears: (c) => twin(`<ellipse cx="52" cy="92" rx="15" ry="29" transform="rotate(14 52 92)" fill="${c.dark}" stroke="${c.line}" stroke-width="2.5"/>`),
        underEyes: (c) => `<ellipse cx="119" cy="95" rx="16" ry="15" fill="${c.dark}" opacity="0.85"/>`,
        marks: () => '<path d="M95 116 Q100 134 105 116Z" fill="#ff7d93"/>',
    },
    lion: {
        name: '狮子',
        emoji: '🦁',
        desc: '金色鬃毛，百兽之王',
        fur: '#f7c26b',
        dark: '#a8601b',
        belly: '#fff1d6',
        line: '#c98a2b',
        muzzle: '#fff1d6',
        stageNames: ['狮蛋', '小狮崽', '少年狮', '青年狮', '成年狮', '狮王'],
        tail: (stage, c) => `<path d="M128 172 C165 176 176 150 166 128" stroke="${c.fur}" stroke-width="8" fill="none" stroke-linecap="round"/><ellipse cx="166" cy="124" rx="9" ry="13" transform="rotate(-10 166 124)" fill="${c.dark}"/>`,
        behind: (stage) => {
            const n = 14;
            const bumps = Array.from({ length: n }, (_, i) => {
                const a = (i / n) * Math.PI * 2;
                return `<circle cx="${(100 + Math.cos(a) * 50).toFixed(1)}" cy="${(98 + Math.sin(a) * 46).toFixed(1)}" r="15" fill="#b9701f"/>`;
            }).join('');
            return bumps + '<ellipse cx="100" cy="98" rx="54" ry="50" fill="#b9701f"/>';
        },
        ears: (c) => twin(`<circle cx="64" cy="58" r="13" fill="${c.fur}" stroke="${c.line}" stroke-width="2.5"/><circle cx="64" cy="59" r="7" fill="#ffd9b0"/>`),
        marks: () => whiskers(),
    },
    dragon: {
        name: '小龙',
        emoji: '🐲',
        desc: '头上长角，会慢慢变成神龙',
        fur: '#5ccf8c',
        dark: '#2f9e64',
        belly: '#fff0b8',
        line: '#2f8a58',
        muzzle: '#8ee0ae',
        nose: 'none',
        stageNames: ['龙蛋', '小龙宝宝', '少年龙', '青年龙', '成年龙', '神龙'],
        tail: (stage, c) =>
            `<path d="M128 172 C172 178 190 146 176 118" stroke="${c.fur}" stroke-width="16" fill="none" stroke-linecap="round"/><polygon points="166,124 176,98 188,124" fill="${c.dark}"/>`,
        ears: (c) =>
            twin(`<path d="M52 94 C32 82 28 100 36 114 C44 108 48 106 52 106Z" fill="${c.dark}"/>`) +
            twin('<polygon points="68,62 58,22 90,52" fill="#ffd166" stroke="#e0a21f" stroke-width="3" stroke-linejoin="round"/>'),
        bodyMarks: () => '<path d="M82 144 H118 M84 154 H116 M87 164 H113" stroke="#f0cf7a" stroke-width="3.5" stroke-linecap="round" fill="none"/>',
        marks: (stage, c) => twin(`<circle cx="94" cy="108" r="2.2" fill="${c.dark}"/>`),
        top: (stage, c) => `<polygon points="90,60 100,40 110,60" fill="${c.dark}"/>`,
    },
    unicorn: {
        name: '独角兽',
        emoji: '🦄',
        desc: '彩虹鬃毛，额头有金色独角',
        fur: '#fff3f8',
        dark: '#ff8fb8',
        belly: '#ffffff',
        line: '#e0b3cb',
        muzzle: '#ffffff',
        noCrown: true,
        stageNames: ['独角兽蛋', '小独角兽', '少年独角兽', '青年独角兽', '成年独角兽', '天马独角兽'],
        tail: () =>
            '<path d="M128 170 C172 172 184 140 172 112" stroke="#ff8fb8" stroke-width="10" fill="none" stroke-linecap="round"/>' +
            '<path d="M126 175 C178 180 194 144 182 118" stroke="#b79cff" stroke-width="8" fill="none" stroke-linecap="round"/>' +
            '<path d="M124 180 C184 188 200 152 192 126" stroke="#7ed6ff" stroke-width="7" fill="none" stroke-linecap="round"/>',
        behind: () =>
            twin(
                '<path d="M58 66 C28 84 28 128 54 148" stroke="#ff8fb8" stroke-width="13" fill="none" stroke-linecap="round"/>' +
                    '<path d="M63 62 C38 76 38 114 56 132" stroke="#b79cff" stroke-width="8" fill="none" stroke-linecap="round"/>' +
                    '<path d="M68 60 C50 72 50 98 60 112" stroke="#7ed6ff" stroke-width="5" fill="none" stroke-linecap="round"/>',
            ),
        ears: (c) => twin(`<polygon points="58,76 56,40 88,58" fill="${c.fur}" stroke="${c.line}" stroke-width="2.5" stroke-linejoin="round"/><polygon points="62,68 61,48 78,60" fill="#ffc2d1"/>`),
        top: () =>
            '<path d="M84 60 C90 80 106 80 116 60 C106 68 94 68 84 60Z" fill="#ff8fb8"/>' +
            '<polygon points="100,10 90,60 110,60" fill="#ffd166" stroke="#e0a21f" stroke-width="2.5" stroke-linejoin="round"/>' +
            '<path d="M92 48 L107 42 M94 34 L105 29 M91 56 L109 52" stroke="#e0a21f" stroke-width="2" stroke-linecap="round" fill="none"/>',
    },
    phoenix: {
        name: '凤凰',
        emoji: '🦚',
        desc: '烈焰羽毛，尾羽越来越长',
        fur: '#ff6a3d',
        dark: '#c23b1a',
        belly: '#ffd98a',
        line: '#b8341a',
        muzzle: null,
        nose: 'beak',
        noCrown: true,
        stageNames: ['凤凰蛋', '雏凤', '少年凤', '青年凤', '成年凤', '涅槃神凰'],
        tail: (stage) => fan(stage, ['#ff5a36', '#ff9f1c', '#ffd23f'], '#fff3b0', '#c23b1a', { origin: [100, 160], single: 40, scale: 0.95 }),
        top: () => [-30, 0, 30].map((a, i) => `<g transform="translate(100 64) rotate(${a}) scale(0.42)"><path d="${LEAF}" fill="${['#ff9f1c', '#ff5a36', '#ffd23f'][i]}" stroke="#c23b1a" stroke-width="3" stroke-linejoin="round"/></g>`).join(''),
    },
};

/** 物种列表：[{ id, name, emoji, desc }]。 */
export const SPECIES = Object.entries(DEFS).map(([id, d]) => ({ id, name: d.name, emoji: d.emoji, desc: d.desc }));

/** 旧版 emoji 头像 → 物种（兼容已保存的档案）。 */
const LEGACY_AVATAR = { '🐸': 'dragon', '🐥': 'phoenix', '🐳': 'dragon', '🐨': 'panda' };

export function speciesById(id) {
    return DEFS[id] ? { id, ...DEFS[id] } : null;
}

/** 由档案推断物种 id：优先 profile.pet，其次旧 emoji 头像。 */
export function speciesOf(profile) {
    if (profile && DEFS[profile.pet]) return profile.pet;
    const avatar = profile && profile.avatar;
    const hit = SPECIES.find((s) => s.emoji === avatar);
    if (hit) return hit.id;
    return LEGACY_AVATAR[avatar] || 'fox';
}

// ---------------------------------------------------------------- 成长阶段
/** 已认识字数 → 成长阶段（0~5）。 */
export function stageFor(known) {
    let stage = 0;
    STAGE_THRESHOLDS.forEach((t, i) => {
        if (known >= t) stage = i;
    });
    return stage;
}

/** 阶段称号，如“三尾灵狐”“少年虎”。 */
export function petTitle(id, stage) {
    const d = DEFS[id] || DEFS.fox;
    return (d.stageNames && d.stageNames[stage]) || `${d.name}${STAGE_SUFFIX[stage]}`;
}

/**
 * 成长信息。
 * @returns {{stage:number, title:string, nextAt:(number|null), need:number, pct:number}}
 */
export function growthInfo(id, known) {
    const stage = stageFor(known);
    const nextAt = stage >= MAX_STAGE ? null : STAGE_THRESHOLDS[stage + 1];
    const base = STAGE_THRESHOLDS[stage];
    const pct = nextAt === null ? 100 : Math.round(((known - base) / (nextAt - base)) * 100);
    return { stage, title: petTitle(id, stage), nextAt, need: nextAt === null ? 0 : nextAt - known, pct };
}

// ---------------------------------------------------------------- SVG 绘制
function eggSvg(c) {
    const spots = [[84, 110, 9], [118, 98, 7], [110, 138, 10], [72, 150, 7], [128, 162, 6]];
    return (
        '<ellipse cx="100" cy="190" rx="46" ry="6" fill="rgba(0,0,0,0.12)"/>' +
        '<g class="pet-egg">' +
        `<path d="M100 62 C134 62 156 118 156 148 C156 174 132 188 100 188 C68 188 44 174 44 148 C44 118 66 62 100 62Z" fill="#fffaf0" stroke="${c.line}" stroke-width="3"/>` +
        spots.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 2 ? c.dark : c.fur}" opacity="0.85"/>`).join('') +
        '<path d="M78 76 C84 70 92 68 96 68" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.8"/>' +
        '</g>'
    );
}

function wingsSvg() {
    const feather = (x, y, rx, rot) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="11" transform="rotate(${rot} ${x} ${y})" fill="#ffe9a3" stroke="#f0b429" stroke-width="2.5"/>`;
    return `<g class="pet-wings">${twin(feather(40, 100, 30, -55) + feather(30, 120, 32, -38) + feather(28, 138, 30, -20))}</g>`;
}

function sparklesSvg(n) {
    const spots = [[6, 40], [192, 52], [14, 150], [186, 142], [100, 0]];
    return spots
        .slice(0, n)
        .map(
            ([x, y], i) =>
                `<path class="pet-spark" style="animation-delay:${(i * 0.55).toFixed(2)}s" d="M${x} ${y - 8} L${x + 2.5} ${y - 2.5} L${x + 8} ${y} L${x + 2.5} ${y + 2.5} L${x} ${y + 8} L${x - 2.5} ${y + 2.5} L${x - 8} ${y} L${x - 2.5} ${y - 2.5}Z" fill="#ffd23f"/>`,
        )
        .join('');
}

function faceSvg(c, stage) {
    const k = stage === 1 ? 1.18 : 1;
    const rx = (6 * k).toFixed(1);
    const ry = (8 * k).toFixed(1);
    const eye = (x) => `<ellipse cx="${x}" cy="98" rx="${rx}" ry="${ry}" fill="${INK}"/><circle cx="${x + 2}" cy="94.5" r="2.6" fill="#fff"/><circle cx="${x - 2}" cy="102" r="1.3" fill="#fff"/>`;
    let out = '';
    if (c.faceBase) out += c.faceBase(c);
    if (c.muzzle) out += `<ellipse cx="100" cy="114" rx="24" ry="16" fill="${c.muzzle}"/>`;
    if (c.underEyes) out += c.underEyes(c);
    out += `<g class="pet-eyes">${eye(80)}${eye(120)}</g>`;
    if (c.nose === 'beak') {
        out += '<polygon points="91,104 109,104 100,120" fill="#ffb703" stroke="#e08a00" stroke-width="2" stroke-linejoin="round"/>';
    } else {
        if (c.nose !== 'none') out += `<ellipse cx="100" cy="106" rx="5" ry="3.5" fill="${c.noseColor || NOSE}"/>`;
        out += `<path d="M100 109 V113 M91 113 Q95.5 119 100 113 Q104.5 119 109 113" stroke="${NOSE}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    out += twin('<circle cx="64" cy="112" r="8" fill="#ff8fa3" opacity="0.42"/>');
    if (c.marks) out += c.marks(stage, c);
    if (c.top) out += c.top(stage, c);
    return out;
}

function accessoriesSvg(c, stage) {
    let out = '';
    if (stage >= 3) {
        out += '<path d="M62 138 Q100 160 138 138 L136 150 Q100 172 64 150Z" fill="#ff5d73" stroke="#d93f57" stroke-width="2" stroke-linejoin="round"/>';
        out += '<path d="M118 154 l12 24 l-13 3 l-7 -22Z" fill="#e8405a" stroke="#d93f57" stroke-width="2" stroke-linejoin="round"/>';
    }
    if (stage >= 4) {
        out += '<polygon points="100,158 103,166 112,166 105,171 108,180 100,175 92,180 95,171 88,166 97,166" fill="#ffd23f" stroke="#e09f1f" stroke-width="1.5" stroke-linejoin="round"/>';
    }
    if (stage === 5 && !c.noCrown) {
        out +=
            '<polygon points="80,58 83,38 92,49 100,34 108,49 117,38 120,58" fill="#ffd23f" stroke="#e09f1f" stroke-width="2.5" stroke-linejoin="round"/>' +
            '<circle cx="100" cy="50" r="3" fill="#e8505b"/>';
    }
    return out;
}

/**
 * 生成宠物 SVG 字符串（内容全部来自本文件常量，可安全 innerHTML）。
 * @param {string} id 物种 id
 * @param {number} stage 成长阶段 0~5
 * @returns {string}
 */
export function petSvg(id, stage = 3) {
    const key = DEFS[id] ? id : 'fox';
    const c = DEFS[key];
    const s = Math.max(0, Math.min(MAX_STAGE, Math.floor(stage)));
    const uid = `pg${++uidCounter}`;
    const label = `${c.name}：${petTitle(key, s)}`;
    const S = `stroke="${c.line}" stroke-width="2.5" stroke-linejoin="round"`;
    const limb = c.limb || c.fur;
    let inner;

    if (s === 0) {
        inner = eggSvg(c);
    } else {
        inner = '<ellipse cx="100" cy="190" rx="50" ry="6" fill="rgba(0,0,0,0.12)"/>';
        if (s === 5) inner = wingsSvg() + inner;
        inner += c.tail ? c.tail(s, c) : '';
        inner += c.behind ? c.behind(s, c) : '';
        inner += c.ears ? c.ears(c) : '';
        // 身体、花纹、手脚
        inner += `<ellipse cx="100" cy="152" rx="40" ry="34" fill="${c.fur}" ${S}/>`;
        inner += `<ellipse cx="100" cy="158" rx="25" ry="23" fill="${c.belly}"/>`;
        inner += c.bodyMarks ? c.bodyMarks(c) : '';
        inner += twin(`<ellipse cx="76" cy="184" rx="15" ry="8" fill="${limb}" ${S}/><ellipse cx="62" cy="150" rx="9" ry="15" transform="rotate(20 62 150)" fill="${limb}" ${S}/>`);
        // 头
        inner += `<ellipse cx="100" cy="98" rx="50" ry="44" fill="${c.fur}" ${S}/>`;
        inner += faceSvg(c, s);
        inner += accessoriesSvg(c, s);
    }

    const scale = STAGE_SCALE[s];
    const aura =
        s === 5
            ? `<defs><radialGradient id="${uid}"><stop offset="0" stop-color="#ffe58a" stop-opacity="0.8"/><stop offset="1" stop-color="#ffe58a" stop-opacity="0"/></radialGradient></defs>` +
              `<circle class="pet-aura" cx="100" cy="116" r="104" fill="url(#${uid})"/>`
            : '';
    const sparks = s >= 4 ? sparklesSvg(s === 5 ? 5 : 2) : '';
    return (
        `<svg class="pet-svg" xmlns="http://www.w3.org/2000/svg" viewBox="-20 -14 240 214" role="img" aria-label="${label}">` +
        aura +
        `<g class="pet-bob"><g transform="translate(100 190) scale(${scale}) translate(-100 -190)">${inner}</g></g>` +
        sparks +
        '</svg>'
    );
}

/** 档案当前应显示的成长阶段（取历史最高与按已认识字数计算的较大者）。 */
export function profileStage(profile) {
    const known = Object.values((profile && profile.chars) || {}).filter((r) => r.s === 2).length;
    return Math.max((profile && profile.petBest) || 0, stageFor(known));
}

/** 档案头像：该小朋友宠物当前成长阶段的 SVG 元素。 */
export function profileAvatar(profile, size = 40) {
    return petElement(speciesOf(profile), profileStage(profile), size);
}

/**
 * 生成宠物 DOM 元素（span.pet-icon，包含 SVG）。
 * @param {string} id 物种 id
 * @param {number} stage 成长阶段
 * @param {number} [size] 像素宽度
 */
export function petElement(id, stage, size = 64) {
    const el = document.createElement('span');
    el.className = 'pet-icon';
    el.style.width = `${size}px`;
    el.innerHTML = petSvg(id, stage);
    return el;
}
