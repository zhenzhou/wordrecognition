/**
 * 语音朗读。
 *
 * 优先级：
 *   1. 预生成的音频文件 data/audio/<码点>.mp3（由 tools/gen_audio.py 生成，可选）
 *   2. 浏览器自带语音合成（Web Speech API），Windows 的 Edge 浏览器自带高质量中文语音
 */
import { getSettings } from './store.js';
import { hex } from './util.js';

const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
let voices = [];
let audioAvailable = null; // null 未探测, true/false
let currentAudio = null;

function refreshVoices() {
    if (!synth) return;
    voices = synth
        .getVoices()
        .filter((v) => /^zh/i.test(v.lang) || /Chinese|中文|普通话|Mandarin/i.test(v.name));
}
if (synth) {
    refreshVoices();
    synth.addEventListener?.('voiceschanged', refreshVoices);
}

/** 是否有可用的朗读能力。 */
export function canSpeak() {
    return audioAvailable === true || (!!synth && voices.length > 0);
}

/** 可选的中文语音列表。 */
export function listVoices() {
    refreshVoices();
    return voices;
}

function pickVoice() {
    const wanted = getSettings().voice;
    if (wanted) {
        const found = voices.find((v) => v.name === wanted);
        if (found) return found;
    }
    const prefer = /Xiaoxiao|Xiaoyi|Yunxi|Yunjian|Huihui|Yaoyao|Tingting|Meijia|Google.*(普通话|Chinese)/i;
    return (
        voices.find((v) => /zh[-_]CN/i.test(v.lang) && prefer.test(v.name)) ||
        voices.find((v) => /zh[-_]CN/i.test(v.lang)) ||
        voices[0] ||
        null
    );
}

/** 用浏览器语音合成朗读一段文字。 */
export function speak(text) {
    if (!synth || !text) return;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    utter.rate = getSettings().rate;
    utter.pitch = 1.1;
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    synth.speak(utter);
}

/** 探测是否有预生成音频。 */
export async function probeAudio() {
    try {
        const res = await fetch(`data/audio/${hex('一')}.mp3`, { method: 'HEAD' });
        audioAvailable = res.ok;
    } catch {
        audioAvailable = false;
    }
    return audioAvailable;
}

function playFile(url, fallbackText) {
    if (currentAudio) currentAudio.pause();
    const audio = new Audio(url);
    audio.playbackRate = Math.min(1.1, Math.max(0.7, getSettings().rate + 0.1));
    currentAudio = audio;
    audio.addEventListener('error', () => speak(fallbackText), { once: true });
    audio.play().catch(() => speak(fallbackText));
}

/**
 * 朗读单个汉字。多音字会连同第一个组词一起读，避免读错音。
 * @param {string} ch 汉字
 * @param {Object} [info] 字的数据（D.chars[ch]）
 */
export function speakChar(ch, info) {
    let text = ch;
    if (info && info.alt && info.w && info.w[0]) text = `${ch}，${info.w[0][0]}`;
    if (audioAvailable) playFile(`data/audio/${hex(ch)}.mp3`, text);
    else speak(text);
}

/** 朗读词语或句子。 */
export function speakText(text) {
    if (currentAudio) currentAudio.pause();
    speak(text);
}

export function stopSpeaking() {
    if (synth) synth.cancel();
    if (currentAudio) currentAudio.pause();
}
