/**
 * 单字学习卡片：笔顺动画、拼音、释义、组词、例句、笔画分解图、语音。
 * 学习页与单字详情页共用。
 */
import { getChar } from './data.js';
import { speakChar, speakText } from './speech.js';
import { h, toast } from './util.js';
import { createWriter, strokeSteps } from './writer.js';

function speakButton(label, text, extraClass = '') {
    return h('button', {
        class: `icon-btn ${extraClass}`,
        type: 'button',
        'aria-label': `朗读：${label}`,
        title: '听一听',
        text: '🔊',
        onclick: () => speakText(text),
    });
}

/**
 * 创建单字学习卡片。
 * @param {string} ch 汉字
 * @returns {{el: HTMLElement, destroy: Function}}
 */
export function createCharCard(ch) {
    const info = getChar(ch);
    const canvas = h('div', { class: 'cc-canvas' });
    const writer = createWriter(canvas, ch, { size: 300 });
    let practicing = false;

    const practiceBtn = h('button', {
        class: 'btn btn-ghost',
        type: 'button',
        text: '✍️ 我来写',
        onclick: () => {
            if (practicing) {
                practicing = false;
                practiceBtn.textContent = '✍️ 我来写';
                writer.stopPractice();
                return;
            }
            practicing = true;
            practiceBtn.textContent = '👀 看动画';
            toast('用鼠标或手指，照着灰色的字一笔一笔写吧');
            writer.practice((summary) => {
                practicing = false;
                practiceBtn.textContent = '✍️ 我来写';
                const miss = summary.totalMistakes;
                toast(miss === 0 ? '太棒了，一笔都没写错！🎉' : `写完啦！错了 ${miss} 笔，再试一次吧`);
            });
        },
    });

    const controls = h(
        'div',
        { class: 'cc-controls' },
        h('button', {
            class: 'btn btn-ghost',
            type: 'button',
            text: '▶ 再看一遍',
            onclick: () => {
                practicing = false;
                practiceBtn.textContent = '✍️ 我来写';
                writer.replay();
            },
        }),
        practiceBtn,
        h('button', {
            class: 'btn btn-primary',
            type: 'button',
            text: '🔊 读一读',
            onclick: () => speakChar(ch, info),
        }),
    );

    // ---------- 右侧文字信息 ----------
    const chips = [
        h('span', { class: 'chip', text: `部首：${info.r || '—'}` }),
        h('span', { class: 'chip', text: `${info.n} 画` }),
    ];
    if (info.alt && info.alt.length) {
        chips.push(h('span', { class: 'chip chip-warn', text: `多音字，还读：${info.alt.join('、')}` }));
    }

    const right = h(
        'div',
        { class: 'cc-right' },
        h(
            'div',
            { class: 'cc-head' },
            h('div', { class: 'cc-bigchar', 'aria-label': `汉字 ${ch}`, text: ch }),
            h('div', { class: 'cc-pinyin-wrap' }, h('div', { class: 'cc-pinyin', text: info.p }), h('div', { class: 'chips' }, chips)),
        ),
    );

    if (info.m) {
        right.appendChild(
            h('section', { class: 'cc-block' }, h('h3', { text: '这个字的意思' }), h('p', { class: 'cc-meaning', text: info.m })),
        );
    }

    const wordList = h('ul', { class: 'word-list' });
    for (const [word, py, exp] of info.w || []) {
        wordList.appendChild(
            h(
                'li',
                {},
                h(
                    'div',
                    { class: 'word-main' },
                    h('span', { class: 'word-text' }, highlight(word, ch)),
                    h('span', { class: 'word-py', text: py }),
                    speakButton(word, word),
                ),
                exp ? h('div', { class: 'word-exp', text: exp }) : null,
            ),
        );
    }
    right.appendChild(h('section', { class: 'cc-block' }, h('h3', { text: '组词' }), wordList));

    if (info.x) {
        right.appendChild(
            h(
                'section',
                { class: 'cc-block' },
                h('h3', { text: '说一句话' }),
                h('p', { class: 'cc-sentence' }, highlight(info.x, ch), ' ', speakButton(info.x, info.x)),
            ),
        );
    }

    const el = h(
        'article',
        { class: 'char-card' },
        h('div', { class: 'cc-left' }, canvas, controls),
        right,
        h('section', { class: 'cc-steps' }, h('h3', { text: '笔顺分解：一笔一笔看清楚' }), strokeSteps(ch)),
    );
    return { el, destroy: () => writer.destroy() };
}

/** 把文本中的目标字高亮成红色。 */
function highlight(text, ch) {
    return [...text].map((c) => (c === ch ? h('mark', { text: c }) : c));
}
