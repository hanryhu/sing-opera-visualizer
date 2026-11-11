// English / Simplified Chinese. English text is the key; t() returns the Chinese when it is selected.
// Static page text is translated by walking the DOM (text nodes, title, aria-label); the Help text has
// a full Chinese version in index.html. Code that sets text calls t() and re-renders on onLang().

const ZH = {
  // Header, menus, panels
  'Vocal Analyzer': '声乐分析器',
  'Sing': '演唱', 'Synthesize': '合成', 'Listen': '聆听',
  'Learn': '视唱', 'Sight-sing a generated atonal phrase': '视唱随机生成的无调性乐句',
  'Start again': '重新开始', 'New phrase': '新乐句', 'Intervals': '音程', 'Play the melody': '播放旋律', 'Book': '教材',
  'Modus Novus · Chapter 1': 'Modus Novus · 第 1 章',
  'Analyze your voice from the microphone': '通过麦克风分析你的声音',
  'Hear a synthesized voice with your own F0, F1, F2, F3 and volume': '用你设定的 F0、F1、F2、F3 和音量播放合成人声',
  'Listen to aria excerpts for each voice part': '聆听各声部的咏叹调片段',
  'Sound source': '声音来源',
  'Detail': '详细', 'Detail: Hz values, grids, spectrum, extra vowels': '详细：Hz 数值、网格、频谱、更多元音',
  'Record': '录制', 'Record up to 30 s of the dashboard and sound as a video': '将最多 30 秒的画面和声音录制为视频',
  'Settings': '设置',
  'Voice range': '音域', 'Auto': '自动', 'High': '高', 'Low': '低',
  'Detect from the pitches you sing': '根据你唱的音高判断',
  'Soprano · mezzo · alto · countertenor': '女高音 · 女中音 · 女低音 · 假声男高音',
  'Tenor · baritone · bass': '男高音 · 男中音 · 男低音',
  'Quarter tones': '四分音', 'Label quarter-tone pitches': '标出四分音',
   'Calibrate vowels…': '校准元音…', 'Help & sources…': '帮助与来源…',
  'Exit to start page': '退出到首页', 'Exit (stop and return to the start page)': '退出（停止并返回首页）',
  'Pitch': '音高', 'Vowel': '元音', 'Input': '输入', '· ring': '· 共鸣',
  'drag bar to set': '拖动竖条设置', 'drag to set F1 · F2': '拖动以设置 F1 · F2',
  'Hide panel': '隐藏面板', 'Show panel': '显示面板',
  'Hide vibrato': '隐藏颤音', 'Show vibrato': '显示颤音', 'VIBRATO': '颤音', 'Vibrato rate and extent': '颤音速率与幅度',
  'Synthesizer pitch (F0)': '合成器音高（F0）', 'Synthesizer volume': '合成器音量', 'Volume': '音量',
  'The input hit full scale: the sound is distorted. Lower the mic level or step back.': '输入达到满刻度，声音失真。请调低麦克风电平或离远一些。',
  'Your vowels': '你的元音', 'reset': '重置',
  // Panels: samples, synth, calibration, recording
  'Aria samples': '咏叹调示例', 'Close samples': '关闭示例',
  'Historic recordings with orchestra: readings are noisier than a solo voice. Credits under “?”.': '带乐队的历史录音：读数比独唱人声更不稳定。来源见帮助。',
  'Synthesizer': '合成器', 'Close synthesizer': '关闭合成器', 'Vibrato': '颤音', 'Play': '播放', 'Stop sound': '停止',
  'Pitch F0': '音高 F0', 'muted': '静音', 'Vowel presets (load formants)': '元音预设（载入共振峰）',
  'Calibrate vowels': '校准元音', 'Close calibration': '关闭校准', 'Vowels': '元音',
  'Sing each vowel on a comfortable, sustained note for 3 seconds. Your vowels replace the default landmarks for': '在舒适的音高上把每个元音持续唱 3 秒。你的元音将替换以下声部的默认位置：',
  '. ɛ and ɔ are optional.': '。ɛ 和 ɔ 可选。',
  'Save & use': '保存并使用', 'Use defaults': '使用默认值', 'Listening…': '正在聆听…', 'Record again': '重新录制',
  'Start the microphone first.': '请先打开麦克风。',
  'Not enough steady voice — sing a little louder and hold the vowel.': '稳定的声音不足：请唱得稍响一些，并保持元音。',
  'Saved. The vowel map now uses your vowels.': '已保存。元音图现在使用你的元音。',
  'Back to the default vowel landmarks.': '已恢复默认元音位置。',
  'Low voice': '低音声部', 'High voice': '高音声部',
  'tenor · baritone · bass': '男高音 · 男中音 · 男低音', 'soprano · mezzo · countertenor': '女高音 · 女中音 · 假声男高音',
  'Recording saved': '录制已保存', 'Close': '关闭', 'Recording': '录制',
  'Start Sing, Synthesize or Listen first, then press Record.': '请先开始演唱、合成或聆听，再按录制。',
  'Recording is not supported in this browser.': '此浏览器不支持录制。',
  'The recording came out empty — keep this tab in front while recording.': '录制内容为空：录制时请保持此页面在前台。',
  'Samples are not available.': '示例不可用。', 'Stop': '停止',
  'Bass': '男低音', 'Baritone': '男中音', 'Tenor': '男高音', 'Mezzo-soprano': '女中音', 'Soprano': '女高音',
  // Landing
  'Sing Together': '一起唱', 'Live Pitch and Resonance visualizer': '实时音高与共鸣可视化',
  'Choose how to start': '选择开始方式', 'Audio data never leaves your device.': '音频数据不会离开你的设备。',
  // Help chrome
  'Guide': '指南', 'Close help': '关闭帮助', 'Sources': '参考文献',
  'The default vowel positions are averages from speech, not singing. Calibrate for the most accurate map.': '默认元音位置来自说话声的平均值，而非歌唱。校准后元音图最准确。',
  // Live readouts
  'in tune': '音准', 'a little sharp': '略高', 'a little flat': '略低', 'between notes': '介于两音之间',
  'sing a note': '唱一个音', 'waiting for a voice': '等待人声',
  'Too loud — input is clipping, vowel reading paused. Lower mic level or step back.': '太响：输入削波，元音读数暂停。请调低麦克风电平或离远一些。',
  'High pitch: F1 readings can be unreliable': '高音：F1 读数可能不可靠',
  'Detecting your typical pitch…': '正在检测你的常用音高…',
  'Detected High voice': '检测到高音声部', 'Detected Low voice': '检测到低音声部',
  'No microphone was found. Plug one in or check your system sound settings, then try again.': '未找到麦克风。请连接麦克风或检查系统声音设置后重试。',
  'The microphone is in use by another app. Close it and try again.': '麦克风正被其他应用占用。请关闭该应用后重试。',
  'Microphone access needs a secure page (https:// or http://localhost).': '麦克风需要安全页面（https:// 或 http://localhost）。',
  // Canvas labels
  'unrounded': '非圆唇', 'rounded': '圆唇', 'unrnd': '非圆', 'rnd': '圆',
  'RING': '共鸣', 'speech': '说话', 'ring': '共鸣', '0 dB speech': '0 dB 说话', '+6 dB ring': '+6 dB 共鸣',
  'front': '前', 'back': '后', 'close': '闭', 'open': '开', 'set': '设定',
  'Hz · F2 top · F1 right': 'Hz · 上为 F2 · 右为 F1',
  'hold a note': '保持一个音', 'straight tone': '无颤音',
  'wide': '过宽', 'narrow': '过窄', 'fast': '过快', 'slow': '过慢', 'typical': '适中', 'a little fast': '略快', 'a little slow': '略慢', '': '',
};

const EXAMPLES_ZH = { a: '如 “casa”', e: '如 “sera”', i: '如 “vita”', o: '如 “sole”', u: '如 “luna”', ɛ: '如 “bello”', ɔ: '如 “nove”' };

let lang = 'en';
try {
  const saved = localStorage.getItem('va.lang');
  lang = saved === 'zh' || saved === 'en' ? saved : (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
} catch { /* storage blocked */ }

const listeners = [];
export const getLang = () => lang;
export const isZh = () => lang === 'zh';
/** Translate an English UI string (returned unchanged in English or when untranslated). */
export function t(s) { return lang === 'zh' && ZH[s] != null ? ZH[s] : s; }
export const exampleFor = (v, en) => (lang === 'zh' ? EXAMPLES_ZH[v] || en : en);
export function onLang(fn) { listeners.push(fn); }

const origText = new WeakMap();   // text node -> English
const origAttr = new WeakMap();   // element -> {title, aria-label}
const norm = (x) => x.trim().replace(/\s+/g, ' ');
const SKIP = 'script,style,canvas,.help-text,#helpSources';

/** Translate the static page text in place (and restore English). */
export function applyDom(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.parentElement?.closest(SKIP)) continue;
    let en = origText.get(n);
    if (en == null) {
      if (ZH[norm(n.nodeValue)] == null) continue;
      en = n.nodeValue;
      origText.set(n, en);
    }
    const lead = en.match(/^\s*/)[0], trail = en.match(/\s*$/)[0];
    n.nodeValue = lang === 'zh' ? lead + ZH[norm(en)] + trail : en;
  }
  for (const el of root.querySelectorAll('[title],[aria-label]')) {
    if (el.closest(SKIP)) continue;
    let o = origAttr.get(el);
    if (!o) { o = { title: el.getAttribute('title'), aria: el.getAttribute('aria-label') }; origAttr.set(el, o); }
    if (o.title != null && ZH[o.title] != null) el.setAttribute('title', t(o.title));
    if (o.aria != null && ZH[o.aria] != null) el.setAttribute('aria-label', t(o.aria));
  }
  document.querySelectorAll('.help-text').forEach((d) => { d.hidden = (d.lang === 'zh-Hans') !== (lang === 'zh'); });
  const langBtn = document.getElementById('langBtn');
  if (langBtn) { langBtn.textContent = lang === 'zh' ? 'English' : '中文'; langBtn.lang = lang === 'zh' ? 'en' : 'zh-Hans'; }
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en';
  document.title = lang === 'zh' ? '声乐分析器 · Synsoph' : 'Vocal Analyzer · Synsoph';
}

export function setLang(l) {
  lang = l;
  try { localStorage.setItem('va.lang', l); } catch { /* ignore */ }
  applyDom();
  for (const fn of listeners) fn(l);
}
