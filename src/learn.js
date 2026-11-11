// Learn: atonal sight-singing. A generated phrase on a staff; a light bar follows the singer
// (waits at each note until it is sung, rushes ahead when the singer arrives early) and each note
// is coloured by intonation: green in tune, purple flat, yellow sharp.

import { Surface, C } from './ui/panels.js';
import { midiToFreq } from './dsp/pitch.js';
import { t } from './i18n.js';
import { spellLine, nextAtonal, tonalLine, keySigMap, TONAL_STYLES } from './melody.js';

/** Intervals offered for generation (semitones). */
export const INTERVALS = [
  { id: 'm2', st: 1 }, { id: 'M2', st: 2 }, { id: 'm3', st: 3 }, { id: 'M3', st: 4 },
  { id: 'P4', st: 5 }, { id: 'TT', st: 6 }, { id: 'P5', st: 7 }, { id: 'm6', st: 8 },
  { id: 'M6', st: 9 }, { id: 'm7', st: 10 }, { id: 'M7', st: 11 }, { id: 'P8', st: 12 },
];
/** Book chapters: the interval material each chapter introduces (Edlund, Modus Novus). */
export const BOOK = [
  { id: 'mn1', title: 'Modus Novus · Chapter 1', intervals: ['m2', 'M2', 'P4'] },
];

const RANGE = { high: [62, 77], low: [47, 62] };      // D4–F5 treble, B2–D4 bass
const COLORS = { in: '#36e07f', flat: '#b28dff', sharp: '#ffd54a' };
const IN_TUNE = 25;       // ± cents counted as in tune
const MATCH = 100;        // ± cents (octave-folded) for a sung pitch to count as this note
const ADVANCE = 45;       // ± cents from the next note before the bar moves on (a very sharp note stays put)
const SWITCH_HOLD = 0.08; // s on the next note before the bar moves to it
const ONSET_SKIP = 0.1;   // s of each note ignored for rating (the scoop into the note)
const BPM = 72;
const HINT_NOTE = 0.55;   // s per note when Help plays the right note and the next
const ONSET_LAG = 0.08;   // s the follower detects a note after it is sung (analysis window + hold)

const LETTERS = 'CDEFGAB';
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];

/** Rhythm: measures of 4/4 in quarters and halves, ending on a long note. strong = starts on beat 1 or 3. */
function rhythm(measures) {
  const BODY = [[1, 1, 1, 1], [2, 1, 1], [1, 1, 2], [1, 2, 1], [1, 1, 1, 1]];
  const END = [[1, 1, 2], [2, 2], [1, 1, 2]];
  const durs = [];
  for (let m = 0; m < measures; m++) {
    let beat = 0;
    for (const [i, d, a] of (m === measures - 1 ? pick(END) : pick(BODY)).map((d, i, a) => [i, d, a])) {
      durs.push({ d, bar: i === a.length - 1, strong: beat === 0 || beat === 2 });
      beat += d;
    }
  }
  return durs;
}

/** Tonal phrase in a style (pentatonic, diatonic, blues, chromatic, modern), with a key signature. */
export function generateTonalPhrase({ style, voice = 'low', measures = 4 }) {
  const [lo, hi] = RANGE[voice] || RANGE.low;
  const durs = rhythm(measures);
  const line = tonalLine(style, durs.length, durs.map((d) => d.strong), lo, hi);
  const notes = line.notes.map((n, i) => ({ midi: n.midi, dur: durs[i].d, barAfter: durs[i].bar && i < durs.length - 1, sp: n.spelled }));
  const fallback = spellLine(notes);
  notes.forEach((n, i) => { Object.assign(n, n.sp || fallback[i]); delete n.sp; });
  return { notes, clef: voice === 'high' ? 'treble' : 'bass', sig: line.sig, scale: line.scaleId };
}

/** Random atonal phrase. */
export function generatePhrase({ intervals, voice = 'low', measures = 4 }) {
  const [lo, hi] = RANGE[voice] || RANGE.low;
  const steps = INTERVALS.filter((i) => intervals.includes(i.id)).map((i) => i.st);
  if (!steps.length) steps.push(1, 2);
  const durs = rhythm(measures);
  const mids = [Math.round((lo + hi) / 2 - 3 + rnd(7))];
  while (mids.length < durs.length) mids.push(nextAtonal(mids, steps, lo, hi));
  const notes = mids.map((midi, i) => ({ midi, dur: durs[i].d, barAfter: durs[i].bar && i < durs.length - 1 }));
  spellLine(notes).forEach((sp, i) => Object.assign(notes[i], sp));
  return { notes, clef: voice === 'high' ? 'treble' : 'bass' };
}

/**
 * Draw ♯ ♭ ♮ placed by the glyph's measured ink (font metrics vary): a sharp or natural is centred on its
 * line or space; a flat's bowl sits on it, so its ink bottom goes half a space below.
 */
function drawAcc(ctx, acc, x, y, gap, align) {
  const g = acc === 1 ? '♯' : acc === -1 ? '♭' : '♮';
  ctx.font = `${gap * 2.6}px "Noto Music"`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(g), up = m.actualBoundingBoxAscent, down = m.actualBoundingBoxDescent;
  const base = acc === -1 ? y + gap * 0.55 - down : y + (up - down) / 2;
  ctx.fillText(g, x, base);
}

/* ------------------------------------------------------------------ */
export class LearnUI {
  /**
   * @param {{getVoice:()=>string, getCtx:()=>AudioContext|null, mute:boolean}} h
   */
  constructor(h) {
    this.h = h;
    const $ = (id) => document.getElementById(id);
    this.el = {
      panel: $('learnPanel'), canvas: $('learnCanvas'), retry: $('learnRetry'), reroll: $('learnReroll'),
      rerollMenuBtn: $('learnRerollMenu'), rerollMenu: $('learnIntervals'), play: $('learnPlay'),
      score: $('learnScore'),
      help: $('learnHelp'), perf: $('learnPerf'),
    };
    this.surf = new Surface(this.el.canvas);
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('va.learn.intervals') || 'null'); } catch { /* ignore */ }
    this.intervals = Array.isArray(saved) && saved.length ? saved : [...BOOK[0].intervals];
    // What the dice makes: 'random' (short, the chosen intervals) or 'book' (book-length, a chapter's intervals)
    try { this.kind = localStorage.getItem('va.learn.kind') === 'book' ? 'book' : 'random'; } catch { this.kind = 'random'; }
    // Atonal | Tonal, and the tonal style
    try { this.tonality = localStorage.getItem('va.learn.tonality') === 'tonal' ? 'tonal' : 'atonal'; } catch { this.tonality = 'atonal'; }
    try { this.style = TONAL_STYLES.includes(localStorage.getItem('va.learn.style')) ? localStorage.getItem('va.learn.style') : 'diatonic'; } catch { this.style = 'diatonic'; }
    this.phrase = null;
    this.playing = null;
    this.barX = null;

    this.el.retry.addEventListener('click', () => { this.stopPlayback(); this.reset(); });
    // Help (toggle): when the singer goes wrong, play the right note and the next one
    try { this.helpOn = localStorage.getItem('va.learn.help') === '1'; } catch { this.helpOn = false; }
    this.el.help.setAttribute('aria-pressed', String(this.helpOn));
    this.el.help.addEventListener('click', () => {
      this.helpOn = !this.helpOn;
      this.el.help.setAttribute('aria-pressed', String(this.helpOn));
      try { localStorage.setItem('va.learn.help', this.helpOn ? '1' : '0'); } catch { /* ignore */ }
    });
    // Performance (one take): press before singing; recording stops after the last note, then plays back
    this.el.perf.addEventListener('click', () => (this.perf ? this.cancelPerformance() : this.armPerformance()));
    this.el.reroll.addEventListener('click', () => this.reroll());
    // Long phrases scroll: wheel or drag freely; the view also turns a page as the singer nears the edge
    const cv = this.el.canvas, clamp = (v) => Math.max(0, Math.min(this.maxScroll || 0, v));
    cv.addEventListener('wheel', (e) => {
      if (!this.maxScroll) return;
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      this.scroll = this.scrollTarget = clamp(this.scroll + d);
    }, { passive: false });
    let drag = null;
    const onFirst = (e) => {
      const f = this.firstNote, r = cv.getBoundingClientRect();
      return f && Math.hypot(e.clientX - r.left - f.x, e.clientY - r.top - f.y) < f.r;
    };
    cv.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, s: this.scroll, moved: false };
      try { cv.setPointerCapture(e.pointerId); } catch { /* not all pointers capture */ }
    });
    cv.addEventListener('pointermove', (e) => {
      if (drag) {
        if (Math.abs(e.clientX - drag.x) > 6) drag.moved = true;
        if (drag.moved && this.maxScroll) this.scroll = this.scrollTarget = clamp(drag.s - (e.clientX - drag.x));
      } else cv.style.cursor = onFirst(e) ? 'pointer' : '';
    });
    cv.addEventListener('pointerup', (e) => { if (drag && !drag.moved && onFirst(e)) this.playStartPitch(); drag = null; });
    cv.addEventListener('pointercancel', () => { drag = null; });
    this.el.play.addEventListener('click', () => (this.playing ? this.stopPlayback() : this.done && this.take ? this.playTake() : this.play()));
    const toggleMenu = (btn, menu) => (e) => {
      e.stopPropagation();
      const open = menu.hidden;
      this.closeMenus();
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    };
    this.el.rerollMenuBtn.addEventListener('click', toggleMenu(this.el.rerollMenuBtn, this.el.rerollMenu));
    document.addEventListener('click', (e) => { if (!e.target.closest('.learn-menu')) this.closeMenus(); });
    this.renderMenus();
    if (document.fonts?.load) document.fonts.load('32px "Noto Music"', '\u{1D11E}\u{1D122}♯♭♮').then(() => this.draw(performance.now() / 1000)).catch(() => {});
  }

  closeMenus() {
    this.el.rerollMenu.hidden = true;
    this.el.rerollMenuBtn.setAttribute('aria-expanded', 'false');
  }

  /** The dice menu: interval chips (short phrases) and book chapters (book-length phrases). */
  renderMenus() {
    const save = () => {
      try {
        localStorage.setItem('va.learn.intervals', JSON.stringify(this.intervals)); localStorage.setItem('va.learn.kind', this.kind);
        localStorage.setItem('va.learn.tonality', this.tonality); localStorage.setItem('va.learn.style', this.style);
      } catch { /* ignore */ }
    };
    const book = this.tonality === 'atonal' && this.kind === 'book' ? BOOK.find((b) => b.intervals.join() === this.intervals.join()) : null;
    const STYLE_NAMES = { pentatonic: 'Pentatonic', diatonic: 'Diatonic', blues: 'Blues', chromatic: 'Chromatic', modern: 'Modern' };
    const seg = `<div class="segmented ton-seg" role="radiogroup">` +
      ['atonal', 'tonal'].map((k) => `<button type="button" role="radio" data-ton="${k}" aria-checked="${this.tonality === k}">${t(k === 'atonal' ? 'Atonal' : 'Tonal')}</button>`).join('') + `</div>`;
    if (this.tonality === 'tonal') {
      this.el.rerollMenu.innerHTML = seg + `<div class="style-grid">${TONAL_STYLES.map((k) =>
        `<button type="button" class="iv-chip" data-style="${k}" aria-pressed="${this.style === k}">${t(STYLE_NAMES[k])}</button>`).join('')}</div>`;
    } else this.el.rerollMenu.innerHTML = seg +
      `<div class="iv-grid">${INTERVALS.map((i) =>
        `<button type="button" class="iv-chip" data-iv="${i.id}" aria-pressed="${this.intervals.includes(i.id)}">${i.id}</button>`).join('')}</div>` +
      `<div class="sm-sep"></div>` +
      BOOK.map((b) => `<button type="button" class="sm-row book-row" data-book="${b.id}" aria-pressed="${book === b}">` +
        `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>` +
        `<span>${t(b.title)}</span></button>`).join('');
    this.el.rerollMenu.querySelectorAll('[data-ton]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      this.tonality = b.dataset.ton;
      if (this.tonality === 'tonal') this.kind = 'random';
      save(); this.renderMenus(); this.el.rerollMenu.hidden = false;
    }));
    this.el.rerollMenu.querySelectorAll('[data-style]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      this.style = b.dataset.style;
      save(); this.renderMenus(); this.el.rerollMenu.hidden = false;
    }));
    // A chip: back to short phrases with your own intervals (takes effect on the next roll)
    this.el.rerollMenu.querySelectorAll('[data-iv]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = b.dataset.iv, on = this.intervals.includes(id);
      if (on && this.intervals.length === 1) return; // keep at least one
      this.intervals = on ? this.intervals.filter((x) => x !== id) : [...this.intervals, id];
      this.kind = 'random';
      save();
      this.renderMenus();
      this.el.rerollMenu.hidden = false;
    }));
    // A chapter: its intervals, book-length phrases; rolls one now
    this.el.rerollMenu.querySelectorAll('[data-book]').forEach((btn) => btn.addEventListener('click', () => {
      const b = BOOK.find((x) => x.id === btn.dataset.book);
      this.intervals = [...b.intervals];
      this.kind = 'book';
      save();
      this.renderMenus();
      this.closeMenus();
      this.reroll();
    }));
  }

  open() { this.el.panel.hidden = false; if (!this.phrase) this.reroll(); }
  close() { this.stopPlayback(); this.closeMenus(); this.el.panel.hidden = true; }
  get isOpen() { return !this.el.panel.hidden; }

  /** New phrase. 'random': short, fits the screen. 'book': book-length (about 12 bars), scrolls. */
  reroll(kind = this.kind || 'random') {
    this.stopPlayback();
    this.cancelPerformance();
    this.kind = kind;
    const tonal = this.tonality === 'tonal';
    const measures = kind === 'book' && !tonal ? 12 : (this.surf.w || innerWidth) < 600 ? 3 : 4;
    this.phrase = tonal
      ? generateTonalPhrase({ style: this.style, voice: this.h.getVoice(), measures })
      : generatePhrase({ intervals: this.intervals, voice: this.h.getVoice(), measures });
    this.reset();
  }

  /** Voice range changed: re-generate if nothing has been sung yet. */
  voiceChanged() { if (this.isOpen && !this.started) this.reroll(); }

  reset() {
    this.idx = 0; this.started = false; this.done = false;
    this.cents = []; this.ratings = []; this.live = null; this.take = null;
    this.noteT = 0; this.nextSince = null; this.silentSince = null;
    this.wrongSince = null; this.offSince = null; this.hintedIdx = -1;
    this.barX = null;
    this.scroll = 0; this.scrollTarget = 0; this.turnM = 0;
    this.el.score.textContent = '';
  }

  /** Cents from a note's target, folded to the nearest octave (sing in any octave). */
  static off(midi, target) {
    let c = ((midi - target) * 100) % 1200;
    if (c > 600) c -= 1200; if (c < -600) c += 1200;
    return c;
  }

  rate(list) {
    if (list.length < 3) return null;
    const s = [...list].sort((a, b) => a - b), med = s[s.length >> 1];
    return { cents: med, state: Math.abs(med) <= IN_TUNE ? 'in' : med < 0 ? 'flat' : 'sharp' };
  }

  finishNote() {
    this.ratings[this.idx] = this.rate(this.cents) || this.ratings[this.idx] || { state: 'missed' };
  }

  /** Per animation frame: follow the singer and redraw. */
  tick(o, now) {
    if (!this.isOpen || !this.phrase) return;
    const notes = this.phrase.notes;
    const quiet = this.playing || now < (this.quietUntil || 0); // ignore the speaker during playback
    if (!quiet && !this.done && o?.voiced && o.midiFast) {
      this.silentSince = null;
      const cur = LearnUI.off(o.midiFast, notes[this.idx].midi);
      const nxt = this.idx + 1 < notes.length ? LearnUI.off(o.midiFast, notes[this.idx + 1].midi) : Infinity;
      // Move on when the singer is clearly on the next note, or has left this one (after holding it most
      // of its length) for a pitch near the next: a note sung ~50 c off sits halfway between the two.
      const held = now - this.noteT, minHold = Math.max(0.35, 0.7 * notes[this.idx].dur * 60 / BPM);
      const onNext = Math.abs(nxt) < ADVANCE && Math.abs(nxt) < Math.abs(cur);
      const leftForNext = Math.abs(cur) > 35 && Math.abs(nxt) < MATCH && held >= minHold;
      if (this.started && (onNext || leftForNext)) {
        // On the next note: move there once it has held briefly (vibrato and glides cross over)
        this.nextSince ??= now;
        if (now - this.nextSince >= SWITCH_HOLD) {
          this.finishNote();
          this.idx += 1; this.cents = []; this.noteT = this.nextSince; this.nextSince = null;
          this.markOnset(now);
        }
      } else {
        this.nextSince = null;
        if (Math.abs(cur) < MATCH) {
          if (!this.started) { this.started = true; this.noteT = now; this.markOnset(now); }
          if (now - this.noteT > ONSET_SKIP) this.cents.push(LearnUI.off(o.midiRaw || o.midiFast, notes[this.idx].midi));
          this.live = this.rate(this.cents.slice(-20));
        }
      }
      // Help: a wrong note (neither this one nor the next) for 0.6 s, or this note held out of tune for 0.4 s
      const wrong = Math.abs(cur) >= MATCH && Math.abs(nxt) >= MATCH;
      this.wrongSince = wrong ? (this.wrongSince ?? now) : null;
      const off = this.started && this.live && this.live.state !== 'in' && this.cents.length >= 12;
      this.offSince = off ? (this.offSince ?? now) : null;
      if (this.helpOn && !this.perf && this.hintedIdx !== this.idx // no hints during a performance take
        && ((this.wrongSince && now - this.wrongSince > 0.6) || (this.offSince && now - this.offSince > 0.4))) this.hint(now);
    } else if (!quiet && this.started && !this.done) {
      this.wrongSince = null; this.offSince = null;
      this.silentSince ??= now;
      // Last note: finished when the singer stops after holding it
      if (this.idx === notes.length - 1 && now - this.silentSince > 0.25 && this.cents.length >= 3) {
        this.finishNote(); this.done = true; this.showScore();
        if (this.perf) this.finishPerformance();
      }
    }
    this.draw(now);
  }

  showScore() {
    const n = this.phrase.notes.length, ok = this.ratings.filter((r) => r?.state === 'in').length;
    this.el.score.textContent = `${ok}/${n}`;
  }

  /* ---------------- playback ---------------- */
  audioCtx() {
    const ctx = this.h.getCtx() || (this.ownCtx ||= new (window.AudioContext || window.webkitAudioContext)());
    ctx.resume?.();
    return ctx;
  }

  /** Schedule simple voice-like tones [{midi, t, d}] into a new output; returns that output. */
  tones(ctx, list, gain) {
    const out = ctx.createGain();
    out.gain.value = this.h.mute ? 0 : gain;
    out.connect(ctx.destination);
    const wave = ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.5, 0.33, 0.2, 0.12]));
    for (const { midi, t: tt, d } of list) {
      if (d < 0.06) continue;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.setPeriodicWave(wave);
      osc.frequency.value = midiToFreq(midi);
      g.gain.setValueAtTime(0, tt);
      g.gain.linearRampToValueAtTime(1, tt + 0.03);
      g.gain.setValueAtTime(1, tt + d - 0.08);
      g.gain.linearRampToValueAtTime(0, tt + d - 0.02);
      osc.connect(g).connect(out);
      osc.start(tt); osc.stop(tt + d);
    }
    return out;
  }

  play() {
    const ctx = this.audioCtx();
    this.cancelPerformance();
    this.reset();
    const spb = 60 / BPM;
    let tt = ctx.currentTime + 0.1;
    const list = this.phrase.notes.map((n) => { const e = { midi: n.midi, t: tt, d: n.dur * spb }; tt += e.d; return e; });
    this.startPlaying({ ctx, out: this.tones(ctx, list, 0.22), times: list.map((e) => e.t), end: tt });
  }

  startPlaying(p) {
    this.playing = p;
    this.el.play.setAttribute('aria-pressed', 'true');
    this.el.play.title = t('Stop');
    clearTimeout(this.playTimer);
    this.playTimer = setTimeout(() => this.stopPlayback(), (p.end - p.ctx.currentTime) * 1000 + 50);
  }

  stopPlayback() {
    if (!this.playing) return;
    const { ctx, outs, take } = this.playing;
    for (const out of outs || [this.playing.out]) {
      try { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(out.gain.value, ctx.currentTime); out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05); } catch { /* closed */ }
      setTimeout(() => { try { out.disconnect(); } catch { /* noop */ } }, 120);
    }
    this.playing = null;
    clearTimeout(this.playTimer);
    this.quietUntil = performance.now() / 1000 + 0.4; // let the room go quiet before listening again
    this.el.play.setAttribute('aria-pressed', 'false');
    this.el.play.title = t('Play the melody');
    if (!take) this.reset(); // a performance replay keeps its colours
  }

  /** Tap the first note: hear the starting pitch. Listening pauses while it sounds. */
  playStartPitch() {
    const ctx = this.audioCtx();
    this.tones(ctx, [{ midi: this.phrase.notes[0].midi, t: ctx.currentTime + 0.03, d: 1 }], 0.25);
    this.quietUntil = performance.now() / 1000 + 1.3;
  }

  /** Help: play the note the singer should be on, then the next one. Listening pauses meanwhile. */
  hint(now) {
    const ctx = this.audioCtx(), notes = this.phrase.notes;
    const t0 = ctx.currentTime + 0.05;
    const list = [notes[this.idx], notes[this.idx + 1]].filter(Boolean).map((n, k) => ({ midi: n.midi, t: t0 + k * HINT_NOTE, d: HINT_NOTE }));
    this.tones(ctx, list, 0.25);
    this.hintedIdx = this.idx;
    this.hints = (this.hints || 0) + 1;
    this.wrongSince = null; this.offSince = null;
    this.quietUntil = now + 0.05 + list.length * HINT_NOTE + 0.3;
  }

  /* ---------------- performance: record one take, then play it back with the right notes ---------------- */
  async armPerformance() {
    this.stopPlayback();
    this.reset();
    const ctx = this.h.getCtx(), tap = this.h.getTap?.();
    if (!ctx || !tap) return;
    this.perf = { chunks: [], onsets: [], t0: null, ctx };
    this.el.perf.setAttribute('aria-pressed', 'true');
    try {
      if (this.recCtx !== ctx) {
        await ctx.audioWorklet.addModule('src/rec-worklet.js');
        this.recCtx = ctx;
        this.recNode = new AudioWorkletNode(ctx, 'take-recorder');
        const sink = ctx.createGain(); sink.gain.value = 0; // keeps the node running, silently
        tap.connect(this.recNode); this.recNode.connect(sink).connect(ctx.destination);
      }
    } catch { this.cancelPerformance(); return; }
    if (!this.perf) return;
    this.perf.t0 = ctx.currentTime;
    this.recNode.port.onmessage = (e) => {
      const P = this.perf;
      if (!P || P.stopped) return;
      P.chunks.push(e.data);
      if (P.chunks.length * 128 > ctx.sampleRate * 180) this.cancelPerformance(); // 3 min cap
    };
  }

  cancelPerformance() {
    if (this.recNode) this.recNode.port.onmessage = null;
    this.perf = null;
    this.el.perf.setAttribute('aria-pressed', 'false');
  }

  /** Note onset in recording time (the follower hears a note ~ONSET_LAG after it starts). */
  markOnset(now) {
    const P = this.perf;
    if (!P || P.t0 == null) return;
    const ago = now - this.noteT; // the switch is confirmed a little after the note began
    P.onsets[this.idx] = Math.max(0, P.ctx.currentTime - P.t0 - ago - ONSET_LAG);
  }

  finishPerformance() {
    const P = this.perf;
    if (!P || P.t0 == null) return this.cancelPerformance();
    P.stopped = true;
    P.end = P.ctx.currentTime - P.t0;
    this.cancelPerformance();
    const n = P.chunks.reduce((a, c) => a + c.length, 0);
    if (!n) return;
    const buf = P.ctx.createBuffer(1, n, P.ctx.sampleRate), x = buf.getChannelData(0);
    let o = 0;
    for (const c of P.chunks) { x.set(c, o); o += c.length; }
    this.take = { buf, onsets: P.onsets, end: P.end };
    setTimeout(() => this.playTake(), 350);
  }

  /** Your take with the right notes underneath, each started where you started it. */
  playTake() {
    const T = this.take;
    if (!T) return;
    const ctx = this.audioCtx(), notes = this.phrase.notes;
    const from = Math.max(0, (T.onsets.find((v) => v != null) ?? 0) - 0.4);
    const t0 = ctx.currentTime + 0.1, end = t0 + T.end - from;
    const voice = ctx.createGain();
    voice.gain.value = this.h.mute ? 0 : 1;
    voice.connect(ctx.destination);
    const src = ctx.createBufferSource();
    src.buffer = T.buf;
    src.connect(voice);
    src.start(t0, from);
    const list = [];
    notes.forEach((nt, i) => {
      if (T.onsets[i] == null) return;
      const next = T.onsets.slice(i + 1).find((v) => v != null) ?? T.end;
      list.push({ midi: nt.midi, t: t0 + T.onsets[i] - from, d: next - T.onsets[i] - 0.03 });
    });
    const synth = this.tones(ctx, list, 0.1);
    this.startPlaying({ ctx, outs: [voice, synth], times: list.map((e) => e.t), end, take: true });
  }

  /** Dev: a silent synthetic singer for this phrase (cents detune per note), as an AudioBuffer. */
  renderSinger(ctx, detune = []) {
    const fs = ctx.sampleRate, spb = 60 / BPM * 1.15;
    const notes = this.phrase.notes;
    const total = notes.reduce((s, n) => s + n.dur * spb, 0) + 1.5;
    const buf = ctx.createBuffer(1, Math.floor(total * fs), fs), x = buf.getChannelData(0);
    let tt = 0.6, ph = 0;
    notes.forEach((n, i) => {
      const d = n.dur * spb, s0 = Math.floor(tt * fs), s1 = Math.floor((tt + d - 0.04) * fs);
      const f = midiToFreq(n.midi + (detune[i] || 0) / 100);
      for (let s = s0; s < s1 && s < x.length; s++) {
        const lt = (s - s0) / fs;
        const env = Math.min(1, lt / 0.03, (s1 - s) / fs / 0.03);
        const vib = lt > 0.3 ? Math.sin(2 * Math.PI * 5.5 * lt) * 0.3 : 0;
        ph += (2 * Math.PI * f * Math.pow(2, vib / 12)) / fs;
        x[s] = 0.25 * env * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph) + 0.15 * Math.sin(4 * ph));
      }
      tt += d;
    });
    return buf;
  }

  /* ---------------- drawing ---------------- */
  layout() {
    const { w, h } = this.surf;
    const notes = this.phrase.notes;
    // width weight: base + duration + room for an accidental + barline
    const shown = this.accidentals();
    const wts = notes.map((n, i) => 1 + 0.35 * (n.dur - 1) + (shown[i] != null ? 0.45 : 0) + (n.barAfter ? 0.35 : 0));
    const sumW = wts.reduce((a, b) => a + b, 0);
    let gap = Math.max(7, Math.min(22, h / 10, w / 26));
    // Short (dice) phrases always fit the panel: shrink the staff rather than scroll
    const sigN = Math.abs(this.phrase.sig || 0);
    if (this.kind !== 'book' || this.tonality === 'tonal') gap = Math.max(7, Math.min(gap, (w - 20) / (sumW * 2.2 + 5.2 + sigN * 0.95)));
    const top = h / 2 - 2 * gap; // top staff line
    const bottomD = this.phrase.clef === 'treble' ? 30 : 18; // E4 / G2 = bottom line (diatonic number)
    const yOf = (n) => top + 4 * gap - ((n.oct * 7 + LETTERS.indexOf(n.letter)) - bottomD) * gap / 2;
    const x0 = (4.2 + sigN * 0.95) * gap + 12, x1 = w - gap - 8; // notes start clear of the clef and key signature
    // Long phrases keep a readable spacing and scroll; short ones stretch to fill
    const avail = x1 - x0;
    const u = sumW * gap * 2.2 <= avail ? avail / sumW : gap * 2.2;
    let x = 0;
    const xs = [], bars = [], measStart = [0], measOf = [];
    notes.forEach((n, i) => {
      const accW = shown[i] != null ? 0.45 * u : 0;
      xs.push(x + accW + u * 0.35);
      measOf.push(measStart.length - 1);
      x += wts[i] * u;
      if (n.barAfter) { bars.push(x - u * 0.2); measStart.push(x - u * 0.2); }
    });
    const contentW = x;
    this.maxScroll = Math.max(0, contentW - avail);
    return { gap, top, yOf, xs, bars, x0, x1, avail, shown, measStart, measOf, contentW, sigN };
  }

  /** Accidental to print for each note (null = none): standard rule, accidentals last to the barline. */
  accidentals() {
    const out = [], sig = keySigMap(this.phrase.sig || 0);
    let state = {};
    for (const n of this.phrase.notes) {
      const key = n.letter + n.oct;
      const cur = state[key] ?? sig[LETTERS.indexOf(n.letter)] ?? 0;
      out.push(n.acc !== cur ? n.acc : null);
      state[key] = n.acc;
      if (n.barAfter) state = {};
    }
    return out;
  }

  draw(now) {
    if (!this.phrase || !this.isOpen) return;
    const s = this.surf, ctx = s.begin();
    if (s.w < 50 || s.h < 50) return;
    const L = this.layout(), { gap, top, yOf, xs } = L;
    const notes = this.phrase.notes;

    // Follower bar (behind the notes)
    let target;
    if (this.playing) {
      const ct = this.playing.ctx.currentTime;
      let i = this.playing.times.findIndex((tt, k) => ct < (this.playing.times[k + 1] ?? this.playing.end));
      if (i < 0) i = notes.length - 1;
      target = xs[Math.max(0, i)];
      this.curIdx = Math.max(0, i);
    } else {
      this.curIdx = this.idx;
      const i = this.idx;
      const span = (xs[i + 1] ?? L.contentW) - xs[i];
      const prog = this.started && !this.done ? Math.min(0.55, (now - this.noteT) / (notes[i].dur * 60 / BPM) * 0.55) : 0;
      target = xs[i] + span * prog; // glides through the note at tempo, then waits for the singer
    }
    const dt = Math.min(0.1, now - (this.lastDraw || now));
    this.lastDraw = now;
    this.barX = this.barX == null ? target : this.barX + (target - this.barX) * (1 - Math.exp(-dt / 0.07));
    // Page turn: when the singer reaches a bar whose next bar is not fully in view (or is off to the left),
    // scroll so that bar becomes the first one shown. Only on reaching a new bar, so free scrolling isn't undone.
    const bar = L.measOf[this.curIdx] ?? 0;
    if (bar !== this.turnM) {
      this.turnM = bar;
      const nextEnd = L.measStart[bar + 2] ?? L.contentW;
      if (nextEnd > this.scrollTarget + L.avail || L.measStart[bar] < this.scrollTarget) {
        this.scrollTarget = Math.max(0, Math.min(this.maxScroll, L.measStart[bar]));
      }
    }
    this.scrollTarget = Math.min(this.scrollTarget, this.maxScroll);
    this.scroll += (this.scrollTarget - this.scroll) * (1 - Math.exp(-dt / 0.18));
    const sx = (cx) => L.x0 + cx - this.scroll; // content → screen
    const bw = gap * 2.2;
    const g = ctx.createLinearGradient(0, top - 3 * gap, 0, top + 7 * gap);
    g.addColorStop(0, 'rgba(124,196,255,0)'); g.addColorStop(0.5, 'rgba(124,196,255,.22)'); g.addColorStop(1, 'rgba(124,196,255,0)');
    ctx.save();
    ctx.beginPath(); ctx.rect(L.x0 - gap * 1.6, 0, L.x1 - L.x0 + gap * 1.6 + 8, s.h); ctx.clip(); // notes area (the clef stays put)
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(sx(this.barX) - bw / 2, top - 3 * gap, bw, 10 * gap, bw / 2); ctx.fill();
    ctx.restore();

    // Staff
    ctx.strokeStyle = 'rgba(232,234,240,.45)'; ctx.lineWidth = 1;
    const ex = sx(L.contentW), staffEnd = Math.min(L.x1 + 6, ex + 3);
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(12, top + k * gap); ctx.lineTo(staffEnd, top + k * gap); ctx.stroke(); }
    ctx.save();
    ctx.beginPath(); ctx.rect(L.x0 - gap * 1.6, 0, L.x1 - L.x0 + gap * 1.6 + 8, s.h); ctx.clip();
    ctx.beginPath(); ctx.moveTo(ex - 3, top); ctx.lineTo(ex - 3, top + 4 * gap); ctx.stroke(); // final double bar
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex + 1.5, top); ctx.lineTo(ex + 1.5, top + 4 * gap); ctx.stroke();
    ctx.lineWidth = 1;
    for (const bx of L.bars) { ctx.beginPath(); ctx.moveTo(sx(bx), top); ctx.lineTo(sx(bx), top + 4 * gap); ctx.stroke(); }
    ctx.restore();

    // Clef (Noto Music)
    // Fit the glyph by its measured ink box (font metrics vary): treble spans ~7 spaces, bass ~3
    ctx.fillStyle = 'rgba(232,234,240,.85)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const treble = this.phrase.clef === 'treble', glyph = treble ? '\u{1D11E}' : '\u{1D122}';
    ctx.font = '100px "Noto Music"';
    const m = ctx.measureText(glyph), ink = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    if (ink > 0) {
      const [y0, y1] = treble ? [top - 1.5 * gap, top + 5.6 * gap] : [top - 0.05 * gap, top + 3.1 * gap];
      const k = (y1 - y0) / ink;
      ctx.font = `${100 * k}px "Noto Music"`;
      ctx.fillText(glyph, 16 - m.actualBoundingBoxLeft * k, y0 + m.actualBoundingBoxAscent * k);
    }

    // Key signature: standard positions (treble F5 C5 G5 D5 A4 E5 B4 for sharps; B4 E5 A4 D5 G4 C5 F4 for flats)
    if (this.phrase.sig) {
      const sharps = this.phrase.sig > 0, shift = treble ? 0 : -14; // bass: two octaves lower on the staff
      const pos = sharps ? [38, 35, 39, 36, 33, 37, 34] : [34, 37, 33, 36, 32, 35, 31];
      ctx.fillStyle = 'rgba(232,234,240,.85)';
      for (let k = 0; k < L.sigN; k++) {
        const d = pos[k] + shift;
        const y = yOf({ oct: Math.floor(d / 7), letter: LETTERS[d % 7] });
        drawAcc(ctx, sharps ? 1 : -1, 4.0 * gap + 12 + k * 0.95 * gap, y, gap, 'center');
      }
    }

    // Notes (scrolled, clipped to the notes area)
    ctx.save();
    ctx.beginPath(); ctx.rect(L.x0 - gap * 1.6, 0, L.x1 - L.x0 + gap * 1.6 + 8, s.h); ctx.clip();
    notes.forEach((n, i) => {
      const x = sx(xs[i]), y = yOf(n);
      if (x < L.x0 - gap * 3 || x > L.x1 + gap * 3) return;
      const r = i < this.idx || this.done ? this.ratings[i] : i === this.idx && this.started ? this.live : null;
      const col = r?.state && COLORS[r.state] ? COLORS[r.state] : r?.state === 'missed' ? C.faint : C.text;
      ctx.strokeStyle = 'rgba(232,234,240,.45)';
      // ledger lines
      for (let ly = top + 5 * gap; ly <= y + 0.1; ly += gap) { ctx.beginPath(); ctx.moveTo(x - gap * 0.95, ly); ctx.lineTo(x + gap * 0.95, ly); ctx.stroke(); }
      for (let ly = top - gap; ly >= y - 0.1; ly -= gap) { ctx.beginPath(); ctx.moveTo(x - gap * 0.95, ly); ctx.lineTo(x + gap * 0.95, ly); ctx.stroke(); }
      ctx.fillStyle = col; ctx.strokeStyle = col;
      // accidental
      if (L.shown[i] != null) {
        drawAcc(ctx, L.shown[i], x - gap * 0.85, y, gap, 'right');
      }
      // notehead
      ctx.save(); ctx.translate(x, y);
      ctx.beginPath();
      if (n.dur >= 4) { // whole note: wider, upright oval with a hole tilted the other way
        ctx.ellipse(0, 0, gap * 0.78, gap * 0.48, 0, 0, Math.PI * 2);
        ctx.ellipse(0, 0, gap * 0.42, gap * 0.26, 1.0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, 0, gap * 0.62, gap * 0.44, -0.35, 0, Math.PI * 2);
        if (n.dur >= 2) ctx.ellipse(0, 0, gap * 0.5, gap * 0.19, -0.6, 0, Math.PI * 2); // half note: hole inside the same outline
      }
      ctx.fill('evenodd');
      ctx.restore();
      if (i === 0) this.firstNote = { x, y, r: gap * 1.4 };
      // stem
      if (n.dur < 4) {
        const up = y > top + 2 * gap;
        const stemX = up ? x + gap * 0.56 : x - gap * 0.56;
        ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(stemX, y + (up ? -gap * 0.15 : gap * 0.15)); ctx.lineTo(stemX, y + (up ? -3.4 * gap : 3.4 * gap)); ctx.stroke();
      }
    });
    ctx.restore();
  }
}
