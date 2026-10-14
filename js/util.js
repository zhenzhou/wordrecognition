/**
 * 通用工具：DOM 构建、日期、随机、提示、弹窗、撒花。
 * 所有文本都通过 textContent 写入，避免 XSS。
 */

/**
 * 创建 DOM 元素。
 * @param {string} tag 标签名
 * @param {Object} [props] 属性：class / text / style(对象) / on* 事件 / dataset / 其他普通属性
 * @param {...(Node|string|null|false|Array)} children 子节点
 * @returns {HTMLElement}
 * @example h('button', {class: 'btn', onclick: fn}, '点我')
 */
export function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
        if (value === null || value === undefined || value === false) continue;
        if (key === 'class') el.className = value;
        else if (key === 'text') el.textContent = value;
        else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
        else if (key === 'dataset') Object.assign(el.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else el.setAttribute(key, value === true ? '' : value);
    }
    appendChildren(el, children);
    return el;
}

function appendChildren(el, children) {
    for (const child of children) {
        if (Array.isArray(child)) appendChildren(el, child);
        else if (child instanceof Node) el.appendChild(child);
        else if (child !== null && child !== undefined && child !== false) {
            el.appendChild(document.createTextNode(String(child)));
        }
    }
}

/** 清空并填充容器。 */
export function mount(root, ...nodes) {
    root.replaceChildren();
    appendChildren(root, nodes);
}

/** 汉字的 Unicode 码点（十六进制），用作笔顺文件名。 */
export function hex(ch) {
    return ch.codePointAt(0).toString(16);
}

/** 本地日期键，格式 YYYY-MM-DD。 */
export function dateKey(ts = Date.now()) {
    const d = new Date(ts);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

/** Fisher-Yates 洗牌（返回新数组）。 */
export function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** 底部轻提示。 */
export function toast(message, ms = 2200) {
    const root = document.getElementById('toast-root');
    const node = h('div', { class: 'toast', text: message });
    root.appendChild(node);
    setTimeout(() => node.classList.add('hide'), ms);
    setTimeout(() => node.remove(), ms + 400);
}

/**
 * 弹出对话框。
 * @param {Object} opts { title, body(Node), actions:[{label, primary, onClick(返回 false 则不关闭)}], dismissible }
 * @returns {{close: Function}}
 */
export function modal({ title, body, actions = [], dismissible = true }) {
    const root = document.getElementById('modal-root');
    const previous = document.activeElement;
    const close = () => {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        if (previous && previous.focus) previous.focus();
    };
    const onKey = (e) => {
        if (e.key === 'Escape' && dismissible) close();
    };
    const buttons = actions.map((a) =>
        h('button', {
            class: `btn ${a.primary ? 'btn-primary' : 'btn-ghost'}`,
            type: 'button',
            text: a.label,
            onclick: async () => {
                const keep = a.onClick ? await a.onClick() : true;
                if (keep !== false) close();
            },
        }),
    );
    const overlay = h(
        'div',
        {
            class: 'modal-overlay',
            onclick: (e) => {
                if (e.target === overlay && dismissible) close();
            },
        },
        h(
            'div',
            { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
            h('h2', { text: title }),
            body,
            h('div', { class: 'modal-actions' }, buttons),
        ),
    );
    root.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    const focusable = overlay.querySelector('input, button');
    if (focusable) focusable.focus();
    return { close };
}

/** 撒花庆祝。 */
export function confetti(count = 42) {
    const colors = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc', '#f783ac'];
    const layer = h('div', { class: 'confetti-layer', 'aria-hidden': 'true' });
    for (let i = 0; i < count; i++) {
        layer.appendChild(
            h('i', {
                style: {
                    left: `${Math.random() * 100}%`,
                    background: colors[i % colors.length],
                    animationDelay: `${Math.random() * 0.6}s`,
                    animationDuration: `${1.8 + Math.random() * 1.6}s`,
                    transform: `rotate(${Math.random() * 360}deg)`,
                },
            }),
        );
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 4200);
}

/** 返回 min(max(v, lo), hi)。 */
export function clamp(v, lo, hi) {
    return Math.min(Math.max(v, lo), hi);
}
