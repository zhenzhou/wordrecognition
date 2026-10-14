/**
 * 笔顺：动画演示（HanziWriter）、笔画分解图、跟着写。
 * 笔顺数据来自 hanzi-writer-data，已按 Unicode 码点保存到 data/strokes/。
 */
import { h, hex } from './util.js';

const cache = new Map();

/** 加载某个字的笔顺数据（带缓存）。 */
export function loadStroke(ch) {
    if (!cache.has(ch)) {
        const promise = fetch(`data/strokes/${hex(ch)}.json`).then((res) => {
            if (!res.ok) throw new Error(`没有 ${ch} 的笔顺数据`);
            return res.json();
        });
        promise.catch(() => cache.delete(ch));
        cache.set(ch, promise);
    }
    return cache.get(ch);
}

/**
 * 在容器里创建笔顺动画。
 * @param {HTMLElement} el 容器
 * @param {string} ch 汉字
 * @param {Object} [opts] { size, loop, pause, onReady }
 * @returns {{replay: Function, practice: Function, stopPractice: Function, destroy: Function}}
 */
export function createWriter(el, ch, opts = {}) {
    const size = opts.size || 260;
    const loop = opts.loop !== false;
    const pause = opts.pause || 1400;
    let alive = true;
    let timer = null;
    let practicing = false;

    if (typeof HanziWriter === 'undefined') {
        el.textContent = ch;
        el.classList.add('writer-fallback');
        return { replay() {}, practice() {}, stopPractice() {}, destroy() {} };
    }

    const writer = HanziWriter.create(el, ch, {
        width: size,
        height: size,
        padding: Math.round(size * 0.06),
        showOutline: true,
        showCharacter: false,
        strokeColor: '#2d2a4a',
        radicalColor: '#e8505b',
        outlineColor: '#e4def2',
        highlightColor: '#ffb703',
        drawingColor: '#3a86ff',
        strokeAnimationSpeed: 1.1,
        delayBetweenStrokes: 280,
        showHintAfterMisses: 2,
        charDataLoader: (c, onLoad, onError) => {
            loadStroke(c).then(onLoad).catch(onError);
        },
        onLoadCharDataSuccess: () => {
            if (opts.onReady) opts.onReady();
        },
        onLoadCharDataError: () => {
            el.textContent = ch;
            el.classList.add('writer-fallback');
        },
    });

    const play = () => {
        if (!alive || practicing) return;
        writer.animateCharacter({
            onComplete: () => {
                if (alive && loop && !practicing) timer = setTimeout(play, pause);
            },
        });
    };
    play();

    return {
        /** 从头重新播放。 */
        replay() {
            clearTimeout(timer);
            practicing = false;
            writer.cancelQuiz();
            writer.hideCharacter();
            play();
        },
        /** 进入“我来写”模式，用鼠标或手指描红。 */
        practice(onComplete) {
            clearTimeout(timer);
            practicing = true;
            writer.hideCharacter();
            writer.quiz({
                onComplete: (summary) => {
                    practicing = false;
                    if (onComplete) onComplete(summary);
                },
            });
        },
        stopPractice() {
            practicing = false;
            writer.cancelQuiz();
            this.replay();
        },
        destroy() {
            alive = false;
            clearTimeout(timer);
            try {
                writer.cancelQuiz();
            } catch {
                /* 忽略 */
            }
        },
    };
}

/**
 * 笔画分解图：每一步一张图，红色是当前笔画，黑色是已写笔画，灰色是未写笔画。
 * @param {string} ch 汉字
 * @param {number} [size] 单张图片尺寸
 * @returns {HTMLElement} 容器（异步填充）
 */
export function strokeSteps(ch, size = 72) {
    const box = h('div', { class: 'stroke-steps', 'aria-label': `${ch} 的笔顺分解` });
    loadStroke(ch)
        .then((data) => {
            const strokes = data.strokes;
            strokes.forEach((_, i) => {
                const paths = strokes
                    .map((d, j) => {
                        const fill = j < i ? '#2d2a4a' : j === i ? '#e8505b' : '#e4e0ee';
                        return `<path d="${d}" fill="${fill}"/>`;
                    })
                    .join('');
                const svgText =
                    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}" aria-hidden="true">` +
                    '<rect x="8" y="8" width="1008" height="1008" fill="#fffdf7" stroke="#e8c9c9" stroke-width="10" rx="40"/>' +
                    '<path d="M512 8V1016M8 512H1016" stroke="#f1d6d6" stroke-width="6" stroke-dasharray="24 20"/>' +
                    `<g transform="scale(1,-1) translate(0,-900)">${paths}</g></svg>`;
                const cell = h('figure', { class: 'step' });
                cell.insertAdjacentHTML('afterbegin', svgText);
                cell.appendChild(h('figcaption', { text: `第${i + 1}笔` }));
                box.appendChild(cell);
            });
        })
        .catch(() => box.appendChild(h('p', { class: 'muted', text: '暂时没有笔画分解图。' })));
    return box;
}
