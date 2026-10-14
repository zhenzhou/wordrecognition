/**
 * 小测验与复习。
 * 题型：听音选字（有语音时）、看字选拼音。
 * 答题结果会写入进度：答对 → 认识并延长复习间隔；答错 → 明天再复习。
 */
import { charGrid } from '../components.js';
import { D, getChar, getGroup, stageChars } from '../data.js';
import { canSpeak, speakChar } from '../speech.js';
import { completeGroup, dueChars, recordAnswer, recordQuiz } from '../store.js';
import { confetti, h, mount, shuffle } from '../util.js';

/** 为每个字生成一道选择题。 */
function buildQuestions(chars, primaryPool, secondaryPool) {
    const listen = canSpeak();
    return shuffle(chars).map((ch, i) => {
        const info = getChar(ch);
        const type = listen && i % 2 === 0 ? 'listen' : 'pinyin';
        const pool = [...shuffle(primaryPool), ...shuffle(secondaryPool)].filter((c) => c !== ch && getChar(c));
        const options = [];
        const seen = new Set([type === 'listen' ? ch : info.p]);
        for (const c of pool) {
            const value = type === 'listen' ? c : getChar(c).p;
            if (seen.has(value)) continue;
            seen.add(value);
            options.push(value);
            if (options.length >= 3) break;
        }
        const answer = type === 'listen' ? ch : info.p;
        return { ch, type, answer, options: shuffle([answer, ...options]) };
    });
}

/**
 * 运行一轮测验。
 * @param {HTMLElement} root 容器
 * @param {Object} cfg { title, chars, primaryPool, secondaryPool, backHref, backLabel, group }
 */
function runQuiz(root, cfg) {
    const questions = buildQuestions(cfg.chars, cfg.primaryPool, cfg.secondaryPool);
    const results = [];
    let index = 0;

    const showQuestion = () => {
        const q = questions[index];
        const info = getChar(q.ch);
        let answered = false;

        const prompt =
            q.type === 'listen'
                ? h(
                      'div',
                      { class: 'q-prompt' },
                      h('p', { text: '听一听，这是哪个字？' }),
                      h('button', { class: 'q-speaker', type: 'button', 'aria-label': '再听一遍', text: '🔊', onclick: () => speakChar(q.ch, info) }),
                  )
                : h(
                      'div',
                      { class: 'q-prompt' },
                      h('p', { text: '这个字怎么读？' }),
                      h('div', { class: 'q-char', text: q.ch }),
                  );

        const feedback = h('div', { class: 'q-feedback', 'aria-live': 'assertive' });
        const nextBtn = h('button', {
            class: 'btn btn-primary btn-big',
            type: 'button',
            text: index === questions.length - 1 ? '看结果 ›' : '下一题 ›',
            style: { visibility: 'hidden' },
            onclick: () => {
                index += 1;
                index < questions.length ? showQuestion() : showResult();
            },
        });

        const optionButtons = q.options.map((opt) =>
            h('button', {
                class: `q-option ${q.type === 'listen' ? 'q-option-char' : ''}`,
                type: 'button',
                text: opt,
                onclick: (e) => {
                    if (answered) return;
                    answered = true;
                    const correct = opt === q.answer;
                    results.push({ ch: q.ch, correct });
                    e.currentTarget.classList.add(correct ? 'right' : 'wrong');
                    optionButtons.forEach((b) => {
                        b.disabled = true;
                        if (b.textContent === q.answer) b.classList.add('right');
                    });
                    feedback.textContent = correct ? '答对啦！👏' : `没关系，正确答案是 ${q.type === 'listen' ? q.ch : info.p}`;
                    feedback.className = `q-feedback ${correct ? 'good' : 'bad'}`;
                    if (q.type === 'pinyin' || !correct) speakChar(q.ch, info);
                    nextBtn.style.visibility = 'visible';
                    nextBtn.focus();
                },
            }),
        );

        mount(
            root,
            h('nav', { class: 'breadcrumb' }, h('a', { href: cfg.backHref, text: `‹ ${cfg.backLabel}` }), h('span', { class: 'muted', text: `　${cfg.title}` })),
            h('div', { class: 'q-progress', 'aria-label': `第 ${index + 1} 题，共 ${questions.length} 题` }, questions.map((_, i) =>
                h('i', { class: i < index ? (results[i]?.correct ? 'ok' : 'ng') : i === index ? 'now' : '' }),
            )),
            h('section', { class: 'card quiz-card' }, prompt, h('div', { class: 'q-options' }, optionButtons), feedback, nextBtn),
        );
        if (q.type === 'listen') setTimeout(() => speakChar(q.ch, info), 250);
    };

    const showResult = () => {
        results.forEach((r) => recordAnswer(r.ch, r.correct));
        recordQuiz();
        const right = results.filter((r) => r.correct).length;
        const wrong = results.filter((r) => !r.correct).map((r) => r.ch);
        const total = results.length;
        const stars = wrong.length === 0 ? 3 : wrong.length <= Math.floor(total * 0.25) ? 2 : 1;
        if (cfg.group) completeGroup(cfg.group.id, stars);
        if (stars >= 2) confetti();

        const nextGroup = cfg.group ? D.groupMap.get(cfg.group.id + 1) : null;
        mount(
            root,
            h(
                'section',
                { class: 'card result-card' },
                h('div', { class: 'result-stars', 'aria-label': `${stars} 颗星`, text: '★'.repeat(stars) + '☆'.repeat(3 - stars) }),
                h('h1', { text: stars === 3 ? '全部答对，太棒了！' : stars === 2 ? '很不错，继续加油！' : '再接再厉！' }),
                h('p', { class: 'muted', text: `答对 ${right} / ${total} 题` }),
                wrong.length
                    ? h(
                          'div',
                          {},
                          h('h3', { text: '这几个字再看一看：' }),
                          charGrid(wrong, { large: true }),
                          h('p', { class: 'muted', text: '它们明天会出现在“复习”里，别担心。' }),
                      )
                    : null,
                h(
                    'div',
                    { class: 'action-row' },
                    nextGroup
                        ? h('a', { class: 'btn btn-primary btn-big', href: `#/group/${nextGroup.id}`, text: `下一组：${nextGroup.title} ›` })
                        : h('a', { class: 'btn btn-primary btn-big', href: '#/', text: '回首页' }),
                    h('button', { class: 'btn btn-ghost', type: 'button', text: '🔄 再测一次', onclick: () => renderAgain() }),
                    h('a', { class: 'btn btn-ghost', href: cfg.backHref, text: cfg.backLabel }),
                ),
            ),
        );
    };

    const renderAgain = () => runQuiz(root, cfg);
    showQuestion();
}

/** 分组测验：#/quiz/:id */
export function renderQuiz(root, params) {
    const group = getGroup(params.id);
    if (!group) {
        location.hash = '#/map';
        return;
    }
    const stage = D.stages.find((s) => s.id === group.stage);
    runQuiz(root, {
        title: `${group.title} · 小测验`,
        chars: group.list,
        primaryPool: group.list,
        secondaryPool: stageChars(stage),
        backHref: `#/group/${group.id}`,
        backLabel: group.title,
        group,
    });
}

/** 复习：#/review，取最需要复习的 10 个字。 */
export function renderReview(root) {
    const chars = dueChars(10);
    if (chars.length === 0) {
        mount(
            root,
            h(
                'section',
                { class: 'card result-card' },
                h('div', { class: 'cta-emoji', text: '🎉' }),
                h('h1', { text: '没有需要复习的字' }),
                h('p', { class: 'muted', text: '先去学几个新字吧，过几天它们就会来找你。' }),
                h('a', { class: 'btn btn-primary btn-big', href: '#/', text: '回首页' }),
            ),
        );
        return;
    }
    runQuiz(root, {
        title: '复习小测验',
        chars,
        primaryPool: chars,
        secondaryPool: D.order.slice(0, 600),
        backHref: '#/',
        backLabel: '首页',
        group: null,
    });
}
