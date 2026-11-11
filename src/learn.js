// Learn: atonal sight-singing. A generated phrase on a staff; a light bar follows the singer
// (waits at each note until it is sung, rushes ahead when the singer arrives early) and each note
// is coloured by intonation: green in tune, purple flat, yellow sharp.

import { Surface, C } from './ui/panels.js';
import { midiToFreq } from './dsp/pitch.js';
import { t } from './i18n.js';
import { spellLine, nextAtonal, tonalLine, keySigMap, TONAL_STYLES } from './melody.js';
import { generateRhythm, generateTextRhythm, METERS, SIG_CHOICES, NOTE_VALUES, DEFAULT_RHYTHM, DEFAULT_TEMPO } from './rhythm.js';
import { lyricLines, LANGS } from './lyrics.js';
import { analyzeSyllable } from './phonetics.js';
import { VOICE_PRESETS, pitchAdjustedLandmarks } from './vowels.js';

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

/** Attach pitches to a rhythm: events become notes with a MIDI pitch and their written pieces. */
function assemble(rh, mids, spelled, voice, extra = {}) {
  const notes = rh.events.map((e, i) => ({ ...e, midi: mids[i], ...(spelled[i] || {}) }));
  return { notes, measures: rh.measures, clef: voice === 'high' ? 'treble' : 'bass', ...extra };
}

/** Tonal phrase in a style (pentatonic, diatonic, blues, chromatic, modern), with a key signature. */
export function generateTonalPhrase({ style, voice = 'low', measures = 4, rhythm: R = DEFAULT_RHYTHM, tempo: T = DEFAULT_TEMPO, rh = null }) {
  const [lo, hi] = RANGE[voice] || RANGE.low;
  rh ||= generateRhythm(R, T, measures);
  const line = tonalLine(style, rh.events.length, rh.events.map((e) => e.strong), lo, hi);
  const mids = line.notes.map((n) => n.midi);
  const fallback = spellLine(mids.map((midi) => ({ midi })));
  const spelled = line.notes.map((n, i) => n.spelled || fallback[i]);
  return assemble(rh, mids, spelled, voice, { sig: line.sig, scale: line.scaleId });
}

/** Random atonal phrase. */
export function generatePhrase({ intervals, voice = 'low', measures = 4, rhythm: R = DEFAULT_RHYTHM, tempo: T = DEFAULT_TEMPO, rh = null }) {
  const [lo, hi] = RANGE[voice] || RANGE.low;
  const steps = INTERVALS.filter((i) => intervals.includes(i.id)).map((i) => i.st);
  if (!steps.length) steps.push(1, 2);
  rh ||= generateRhythm(R, T, measures);
  const mids = [Math.round((lo + hi) / 2 - 3 + rnd(7))];
  while (mids.length < rh.events.length) mids.push(nextAtonal(mids, steps, lo, hi));
  return assemble(rh, mids, spellLine(mids.map((midi) => ({ midi }))), voice);
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
    // First visit: tonal pentatonic, the easiest to sing
    try { this.tonality = localStorage.getItem('va.learn.tonality') === 'atonal' ? 'atonal' : 'tonal'; } catch { this.tonality = 'tonal'; }
    try { this.style = TONAL_STYLES.includes(localStorage.getItem('va.learn.style')) ? localStorage.getItem('va.learn.style') : 'pentatonic'; } catch { this.style = 'pentatonic'; }
    // Rhythm and Tempo settings (note values, dots, triplets, ties; time signatures, changes, bar count)
    const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return { ...d }; } };
    this.rhythm = load('va.learn.rhythm', DEFAULT_RHYTHM);
    this.tempo = load('va.learn.tempo', DEFAULT_TEMPO);
    this.page = 0; // dice menu page: Pitch, Rhythm, Tempo, Language
    try {
      const saved = localStorage.getItem('va.learn.lang');
      this.lang = saved && (saved === 'none' || LANGS.some((l) => l.id === saved)) ? saved
        : (navigator.language || '').toLowerCase().startsWith('zh') ? 'zhS' : 'en';
    } catch { this.lang = 'en'; }
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
        localStorage.setItem('va.learn.rhythm', JSON.stringify(this.rhythm)); localStorage.setItem('va.learn.tempo', JSON.stringify(this.tempo));
        localStorage.setItem('va.learn.lang', this.lang);
      } catch { /* ignore */ }
    };
    const keep = (e) => { e.stopPropagation(); save(); this.renderMenus(); this.el.rerollMenu.hidden = false; };
    const PAGES = ['Pitch', 'Rhythm', 'Tempo', 'Language'];
    const head = `<div class="pg-head"><button type="button" class="pg-arrow" data-pg="-1" aria-label="${t('Previous')}">‹</button>` +
      `<span>${t(PAGES[this.page])}</span><button type="button" class="pg-arrow" data-pg="1" aria-label="${t('Next')}">›</button></div>`;
    const bindPages = () => this.el.rerollMenu.querySelectorAll('[data-pg]').forEach((b) => b.addEventListener('click', (e) => {
      this.page = (this.page + Number(b.dataset.pg) + PAGES.length) % PAGES.length; keep(e);
    }));
    if (this.page === 1) { // Rhythm
      const R = this.rhythm;
      const GLYPH = { 16: '\u{1D161}', 8: '\u{1D160}', q: '\u{1D15F}', h: '\u{1D15E}', w: '\u{1D15D}' };
      const NAME = { 16: 'Sixteenth', 8: 'Eighth', q: 'Quarter', h: 'Half', w: 'Whole' };
      this.el.rerollMenu.innerHTML = head +
        `<div class="nv-grid">${NOTE_VALUES.map((v) => `<button type="button" class="iv-chip nv-chip" data-nv="${v}" aria-pressed="${R.values.includes(v)}" title="${t(NAME[v])}" aria-label="${t(NAME[v])}">${GLYPH[v]}</button>`).join('')}</div>` +
        `<div class="opt-grid">${[['dotted', 'Dotted'], ['triplets', 'Triplets'], ['ties', 'Ties']].map(([k, l]) =>
          `<button type="button" class="iv-chip" data-ropt="${k}" aria-pressed="${!!R[k]}">${t(l)}</button>`).join('')}</div>`;
      bindPages();
      this.el.rerollMenu.querySelectorAll('[data-nv]').forEach((b) => b.addEventListener('click', (e) => {
        const v = b.dataset.nv, on = R.values.includes(v);
        if (on && R.values.length === 1) return e.stopPropagation(); // keep at least one
        R.values = on ? R.values.filter((x) => x !== v) : NOTE_VALUES.filter((x) => x === v || R.values.includes(x));
        keep(e);
      }));
      this.el.rerollMenu.querySelectorAll('[data-ropt]').forEach((b) => b.addEventListener('click', (e) => { R[b.dataset.ropt] = !R[b.dataset.ropt]; keep(e); }));
      return;
    }
    if (this.page === 3) { // Language: words under the notes, or none
      const NONE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 17.5l11-11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      this.el.rerollMenu.innerHTML = head + `<div class="lang-grid">` +
        `<button type="button" class="iv-chip" data-lang="none" aria-pressed="${this.lang === 'none'}" title="${t('No words')}" aria-label="${t('No words')}">${NONE}</button>` +
        LANGS.map((l) => `<button type="button" class="iv-chip" data-lang="${l.id}" aria-pressed="${this.lang === l.id}">${l.label}</button>`).join('') + `</div>`;
      bindPages();
      this.el.rerollMenu.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', (e) => { this.lang = b.dataset.lang; keep(e); }));
      return;
    }
    if (this.page === 2) { // Tempo
      const T = this.tempo;
      const LABEL = { cut: '\u00A2', '3/4': '3/4', '4/4': '4/4', '6/8': '6/8', other: '…' };
      this.el.rerollMenu.innerHTML = head +
        `<div class="sig-grid">${SIG_CHOICES.map((k) => `<button type="button" class="iv-chip" data-sig="${k}" aria-pressed="${T.sigs.includes(k)}"${k === 'cut' ? ` title="${t('Cut time')}"` : k === 'other' ? ` title="${t('Other')}" aria-label="${t('Other')}"` : ''}>${LABEL[k]}</button>`).join('')}</div>` +
        `<button type="button" class="iv-chip wide-chip" data-tchg aria-pressed="${!!T.changes}">${t('Time signature changes')}</button>` +
        `<div class="meas-row"><span>${t('Bars')}</span>` +
        `<button type="button" class="step" data-meas="min:-1"${T.min <= 1 ? ' disabled' : ''}>−</button><b>${T.min}</b><button type="button" class="step" data-meas="min:1"${T.min >= 30 ? ' disabled' : ''}>+</button>` +
        `<span class="dash">–</span>` +
        `<button type="button" class="step" data-meas="max:-1"${T.max <= 1 ? ' disabled' : ''}>−</button><b>${T.max}</b><button type="button" class="step" data-meas="max:1"${T.max >= 30 ? ' disabled' : ''}>+</button></div>`;
      bindPages();
      this.el.rerollMenu.querySelectorAll('[data-sig]').forEach((b) => b.addEventListener('click', (e) => {
        const k = b.dataset.sig, on = T.sigs.includes(k);
        if (on && T.sigs.length === 1) return e.stopPropagation();
        T.sigs = on ? T.sigs.filter((x) => x !== k) : SIG_CHOICES.filter((x) => x === k || T.sigs.includes(x));
        keep(e);
      }));
      this.el.rerollMenu.querySelector('[data-tchg]').addEventListener('click', (e) => { T.changes = !T.changes; keep(e); });
      this.el.rerollMenu.querySelectorAll('[data-meas]').forEach((b) => b.addEventListener('click', (e) => {
        const [k, d] = b.dataset.meas.split(':');
        T[k] = Math.max(1, Math.min(30, T[k] + Number(d)));
        if (T.min > T.max) { if (k === 'min') T.max = T.min; else T.min = T.max; }
        keep(e);
      }));
      return;
    }
    const book = this.tonality === 'atonal' && this.kind === 'book' ? BOOK.find((b) => b.intervals.join() === this.intervals.join()) : null;
    const STYLE_NAMES = { pentatonic: 'Pentatonic', diatonic: 'Diatonic', blues: 'Blues', chromatic: 'Chromatic', modern: 'Modern' };
    const seg = head + `<div class="segmented ton-seg" role="radiogroup">` +
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
    bindPages();
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
    const T = this.tempo;
    const book = kind === 'book' && !tonal;
    const measures = book ? 12 : T.min + rnd(T.max - T.min + 1);
    const lines = this.lang !== 'none' ? lyricLines(this.lang, 16) : [];
    const rh = lines.length ? generateTextRhythm(this.rhythm, T, lines, book ? 12 : T.min, book ? 12 : T.max) : null;
    const opts = { voice: this.h.getVoice(), measures, rhythm: this.rhythm, tempo: T, rh };
    this.phrase = tonal
      ? generateTonalPhrase({ style: this.style, ...opts })
      : generatePhrase({ intervals: this.intervals, ...opts });
    this.phrase.lang = rh ? this.lang : null;
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
    if (this.phrase.lang) return this.sing(); // words: the formant voice sings them
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

  /* ---------------- singing voice for phrases with words ---------------- */
  /**
   * Sing the phrase with the formant synthesizer: each syllable's plain vowel on its note (resonances tuned to
   * the pitch the way trained singers do), consonants from filtered noise, closures and formant glides.
   * Consonants before a vowel are sung just ahead of the beat so the vowel lands on it; consonants after a
   * vowel close the note.
   */
  async sing() {
    const ctx = this.audioCtx(), P = this.phrase, voice = this.h.getVoice();
    if (this.synthCtx !== ctx) { await ctx.audioWorklet.addModule('src/synth-worklet.js'); this.synthCtx = ctx; }
    this.cancelPerformance();
    this.reset();
    const lang = P.lang === 'ruLat' ? 'ru' : P.lang === 'zhS' || P.lang === 'zhT' ? 'zh' : P.lang;
    const base = VOICE_PRESETS[voice].vowels;
    const spb = 60 / BPM, t0 = ctx.currentTime + 0.45;

    const out = ctx.createGain(); out.gain.value = this.h.mute ? 0 : 0.55; out.connect(ctx.destination);
    const node = new AudioWorkletNode(ctx, 'formant-synth', { outputChannelCount: [1] });
    const vg = ctx.createGain(); vg.gain.value = 0; node.connect(vg).connect(out); // voicing level (precise envelope)
    const prm = (k) => node.parameters.get(k);
    prm('gain').value = 1;
    // noise for consonants: white noise → band-pass → level
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    const ng = ctx.createGain(); ng.gain.value = 0;
    noise.connect(bp).connect(ng).connect(out);

    // consonant sounds: kind, place (F2 locus / noise band), voicing, length (s)
    const CON = {
      p: { k: 'stop', burst: 900, locus: 900 }, b: { k: 'stop', burst: 900, locus: 900, v: 1 },
      t: { k: 'stop', burst: 4000, locus: 1800 }, d: { k: 'stop', burst: 3500, locus: 1800, v: 1 },
      k: { k: 'stop', burst: 2200 }, g: { k: 'stop', burst: 2200, v: 1 },
      ts: { k: 'aff', burst: 4000, band: 5500, q: 1.4, lvl: 0.55 }, tʃ: { k: 'aff', burst: 3000, band: 3000, q: 1.2, lvl: 0.6 },
      dʒ: { k: 'aff', burst: 3000, band: 3000, q: 1.2, lvl: 0.45, v: 1 },
      f: { k: 'fric', band: 1800, q: 0.5, lvl: 0.3, locus: 900 }, v: { k: 'fric', band: 1800, q: 0.5, lvl: 0.2, v: 1, locus: 900 },
      θ: { k: 'fric', band: 5000, q: 0.6, lvl: 0.2 }, s: { k: 'fric', band: 5500, q: 1.4, lvl: 0.6 }, z: { k: 'fric', band: 5500, q: 1.4, lvl: 0.4, v: 1 },
      ʃ: { k: 'fric', band: 2800, q: 1.2, lvl: 0.6 }, ʒ: { k: 'fric', band: 2800, q: 1.2, lvl: 0.4, v: 1 },
      h: { k: 'fric', band: 1500, q: 0.4, lvl: 0.35 },
      m: { k: 'nasal', f1: 250, f2: 1000 }, n: { k: 'nasal', f1: 250, f2: 1600 },
      l: { k: 'liquid', f1: 350, f2: 1100, f3: 2900 }, r: { k: 'tap' },
      j: { k: 'glide', f1: 280, f2: 2200 }, w: { k: 'glide', f1: 300, f2: 700 },
    };
    const LEN = { stop: 0.07, aff: 0.1, fric: 0.09, nasal: 0.07, liquid: 0.06, tap: 0.05, glide: 0.05 };
    const vowelFor = (ipa, f0) => {
      const tuned = pitchAdjustedLandmarks(base, f0, voice);
      return tuned.find((v) => v.ipa === ipa) || tuned.find((v) => v.ipa === 'a');
    };
    const set = (k, v, at) => prm(k).setValueAtTime(v, Math.max(ctx.currentTime, at));
    const level = (v, at, ramp = 0.012) => { vg.gain.setTargetAtTime(v, Math.max(ctx.currentTime, at), ramp / 3); };
    const hiss = (lvl, band, q, a, b) => {
      bp.frequency.setValueAtTime(band, a); bp.Q.setValueAtTime(q, a);
      ng.gain.setTargetAtTime(lvl, a, 0.004); ng.gain.setTargetAtTime(0, b - 0.008, 0.004);
    };
    // One consonant in [a, b); vf = the vowel it leads into (for formant transitions); returns nothing
    const consonant = (ph, a, b, vf, f0) => {
      const c = CON[ph];
      if (!c) return;
      if (c.k === 'stop' || c.k === 'aff') {
        const rel = c.k === 'aff' ? a + (b - a) * 0.4 : b - 0.012;
        level(c.v ? 0.12 : 0, a);                   // closure (a voiced stop keeps a murmur)
        bp.frequency.setValueAtTime(c.burst, rel); bp.Q.setValueAtTime(0.8, rel);
        ng.gain.setValueAtTime(0, rel); ng.gain.linearRampToValueAtTime(0.35, rel + 0.003); ng.gain.linearRampToValueAtTime(0, rel + 0.014);
        if (c.k === 'aff') hiss(c.lvl, c.band, c.q, rel + 0.01, b);
        if (c.locus) set('f2', c.locus, b - 0.01);    // the vowel's F2 slides in from the place of closure
      } else if (c.k === 'fric') {
        level(c.v ? 0.3 : 0, a);
        hiss(c.lvl, c.band, c.q, a, b);
        if (c.locus) set('f2', c.locus, b - 0.01);
      } else if (c.k === 'nasal' || c.k === 'liquid' || c.k === 'glide') {
        level(c.k === 'nasal' ? 0.4 : c.k === 'liquid' ? 0.6 : 0.7, a);
        set('f1', c.f1, a); set('f2', c.f2, a); if (c.f3) set('f3', c.f3, a);
      } else if (c.k === 'tap') { // a quick tongue tap: a short dip in the voice
        level(0.6, a); level(0.15, a + 0.015, 0.006); level(0.6, a + 0.035, 0.006);
      }
      void vf; void f0;
    };

    // timeline: vowel starts on the beat
    const notes = P.notes, starts = [];
    let tt = t0;
    for (const n of notes) { starts.push(tt); tt += n.dur * spb; }
    const end = tt;
    const syl = notes.map((n) => analyzeSyllable(n.syl.orig ?? n.syl.text, lang, n.syl.stress));
    noise.start(t0 - 0.4);
    notes.forEach((n, i) => {
      const f0 = midiToFreq(n.midi), s = syl[i], vf = vowelFor(s.vowel, f0);
      const tv = starts[i], tEnd = i + 1 < notes.length ? starts[i + 1] : end;
      // onset consonants end exactly on the beat (taking time from the previous note), at most 45% of it
      const prevLen = i ? starts[i] - starts[i - 1] : 0.4;
      const lens = s.onset.map((ph) => LEN[CON[ph]?.k] || 0.06);
      const total = lens.reduce((a, b) => a + b, 0), k = Math.min(1, (prevLen * 0.45) / (total || 1));
      let a = tv - total * k;
      const voicedOnset = s.onset.some((ph) => CON[ph]?.v || ['nasal', 'liquid', 'glide', 'tap'].includes(CON[ph]?.k));
      prm('f0').setValueAtTime(f0, Math.max(ctx.currentTime, voicedOnset ? a : tv - 0.01)); // pitch moves with voiced consonants
      s.onset.forEach((ph, j) => { const b = a + lens[j] * k; consonant(ph, a, b, vf, f0); a = b; });
      // the vowel, on the beat
      level(1, tv, 0.02);
      set('f1', vf.f1, tv); set('f2', vf.f2, tv); set('f3', vf.f3 || 2700, tv);
      const vib = n.dur * spb > 0.6;
      set('vibrato', 0, tv); if (vib) set('vibrato', 0.45, tv + 0.3);
      // closing consonant at the end of the note, before the next syllable's consonants
      if (s.coda.length) {
        const nextOn = i + 1 < notes.length ? syl[i + 1].onset.length : 0;
        const room = (tEnd - tv) * 0.25, b = tEnd - (nextOn ? Math.min(0.12, (tEnd - tv) * 0.45) : 0.02);
        consonant(s.coda[0], Math.max(tv + 0.1, b - Math.min(0.08, room)), b, vf, f0);
        if (i + 1 < notes.length && !syl[i + 1].onset.length) level(1, b, 0.01);
      }
    });
    level(0, end - 0.06, 0.03);
    noise.stop(end + 0.2);
    setTimeout(() => { try { node.disconnect(); } catch { /* gone */ } }, (end - ctx.currentTime) * 1000 + 600);
    this.startPlaying({ ctx, outs: [out], times: starts, end });
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
    if (!this.takeAnalyser || this.takeAnalyser.context !== ctx) {
      this.takeAnalyser = ctx.createAnalyser(); this.takeAnalyser.fftSize = 4096; this.takeAnalyser.smoothingTimeConstant = 0;
    }
    src.connect(this.takeAnalyser); // the panels analyse the recording itself during playback
    src.start(t0, from);
    const list = [], noteIdx = [];
    notes.forEach((nt, i) => {
      if (T.onsets[i] == null) return;
      const next = T.onsets.slice(i + 1).find((v) => v != null) ?? T.end;
      list.push({ midi: nt.midi, t: t0 + T.onsets[i] - from, d: next - T.onsets[i] - 0.03 });
      noteIdx.push(i);
    });
    const synth = this.tones(ctx, list, 0.1);
    this.startPlaying({ ctx, outs: [voice, synth], times: list.map((e) => e.t), noteIdx, end, take: true });
  }

  /** During a take's playback: the analyser to read instead of the microphone. */
  analysisNode() { return this.playing?.take ? this.takeAnalyser : null; }

  /**
   * The reference (what is written) at the playback position of a take: the note's pitch and, with words,
   * the syllable's vowel resonances tuned to that pitch. Null when no take is playing.
   */
  reference() {
    const p = this.playing;
    if (!p?.take || !this.phrase) return null;
    const ct = p.ctx.currentTime;
    const i = p.times.findIndex((tt, k) => ct >= tt && ct < (p.times[k + 1] ?? p.end));
    const n = p.noteIdx?.[i] != null ? this.phrase.notes[p.noteIdx[i]] : null;
    if (!n) return null;
    const ref = { midi: n.midi };
    if (this.phrase.lang && n.syl) {
      const lang = this.phrase.lang === 'ruLat' ? 'ru' : this.phrase.lang.startsWith('zh') ? 'zh' : this.phrase.lang;
      const ipa = analyzeSyllable(n.syl.orig ?? n.syl.text, lang, n.syl.stress).vowel, voice = this.h.getVoice();
      const v = pitchAdjustedLandmarks(VOICE_PRESETS[voice].vowels, midiToFreq(n.midi), voice).find((x) => x.ipa === ipa);
      if (v) Object.assign(ref, { f1: v.f1, f2: v.f2, f3: v.f3 || VOICE_PRESETS[voice].vowels.find((x) => x.ipa === ipa)?.f3 });
    }
    return ref;
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
  /** Positions of everything along the staff, in content coordinates (scrolling adds an offset). */
  layout() {
    const { w, h } = this.surf;
    const P = this.phrase, notes = P.notes, shown = this.accidentals();
    const sigN = Math.abs(P.sig || 0);
    const zh = P.lang === 'zhS' || P.lang === 'zhT';
    const lyricFont = (gap) => zh ? `500 ${gap * 1.5}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif` : `500 ${gap * 1.2}px Inter, system-ui, sans-serif`;
    const subFont = (gap) => `400 ${gap * 0.95}px Inter, system-ui, sans-serif`;
    const lctx = this.surf.ctx;
    const sylW = (n, gap) => {
      if (!n.syl) return 0;
      lctx.font = lyricFont(gap); let wd = lctx.measureText(n.syl.text).width;
      if (n.syl.sub) { lctx.font = subFont(gap); wd = Math.max(wd, lctx.measureText(n.syl.sub).width); }
      return wd + (n.syl.wordEnd ? 0 : gap * 0.9); // room for a hyphen
    };
    const place = (gap) => {
      let x = 0, lyricRight = -Infinity;
      const heads = [], measStart = [], bars = [], sigs = [], xs = [];
      let ni = 0;
      P.measures.forEach((mz, m) => {
        measStart[m] = x;
        if (mz.showSig) { sigs.push({ x: x + gap * 1.1, meter: mz.meter }); x += gap * 2.6; }
        x += gap * 0.5;
        // pieces of this bar, in time order
        const ps = [];
        notes.forEach((n, i) => n.pieces.forEach((pc, k) => { if (pc.m === m) ps.push({ n, i, k, pc }); }));
        ps.sort((a, b) => a.pc.start - b.pc.start);
        for (const it of ps) {
          const acc = it.k === 0 && shown[it.i] != null;
          if (acc) x += gap * 1.0;
          if (it.k === 0 && it.n.syl) { // keep words from touching: move the note right if its syllable needs room
            const wd = sylW(it.n, gap), want = lyricRight + wd / 2 + gap * 0.35;
            if (x + gap * 0.6 < want) x = want - gap * 0.6;
            lyricRight = x + gap * 0.6 + wd / 2;
          }
          heads.push({ ...it, x: x + gap * 0.6 });
          if (it.k === 0) xs[it.i] = x + gap * 0.6;
          x += gap * (1.25 + 1.45 * Math.sqrt(it.pc.dur)) + (it.pc.type.dots ? gap * 0.5 : 0);
          ni++;
        }
        if (m < P.measures.length - 1) { bars.push(x + gap * 0.2); x += gap * 0.7; }
      });
      return { heads, measStart, bars, sigs, xs, contentW: x };
    };
    let gap = Math.max(7, Math.min(22, h / 10, w / 26));
    const x1 = w - gap - 8;
    const x0Of = (g) => (4.2 + sigN * 0.95) * g + 12;
    let Lp = place(gap);
    // Short (dice) phrases fit the panel: shrink the staff (down to a readable size) before scrolling
    if (this.kind !== 'book') {
      const fit = gap * (x1 - x0Of(gap)) / Lp.contentW;
      if (fit < gap) { gap = Math.max(12, gap * 0.7, fit * 0.98); Lp = place(gap); } // then scroll if still too long
    }
    const x0 = x0Of(gap), avail = x1 - x0;
    // a short phrase stretches to fill the width
    if (Lp.contentW < avail) {
      const k = avail / Lp.contentW;
      const sc = (v) => v * k;
      Lp.heads.forEach((hd) => { hd.x = sc(hd.x); });
      Lp.xs = Lp.xs.map(sc); Lp.measStart = Lp.measStart.map(sc); Lp.bars = Lp.bars.map(sc);
      Lp.sigs.forEach((sg) => { sg.x = sc(sg.x); });
      Lp.contentW = avail;
    }
    const words = !!P.lang;
    const top = h / 2 - 2 * gap - (words ? gap * (zh ? 2.4 : 1.8) : 0); // top staff line (raised to make room for words)
    const bottomD = P.clef === 'treble' ? 30 : 18; // E4 / G2 = bottom line (diatonic number)
    const yOf = (n) => top + 4 * gap - ((n.oct * 7 + LETTERS.indexOf(n.letter)) - bottomD) * gap / 2;
    this.maxScroll = Math.max(0, Lp.contentW - avail);
    const lowest = Math.max(top + 4 * gap, ...notes.map((n) => yOf(n)));
    const lyricY = Math.max(top + 6.9 * gap, lowest + 2.4 * gap);
    Object.assign(Lp, { lyricY, lyricFont: lyricFont(gap), subFont: subFont(gap) });
    const measOf = notes.map((n) => n.m);
    return { ...Lp, gap, top, yOf, x0, x1, avail, shown, measOf, sigN };
  }

  /** Accidental to print for each note (null = none): standard rule, accidentals last to the barline. */
  accidentals() {
    const out = [], sig = keySigMap(this.phrase.sig || 0);
    let state = {}, bar = -1;
    for (const n of this.phrase.notes) {
      if (n.m !== bar) { state = {}; bar = n.m; }
      const key = n.letter + n.oct;
      const cur = state[key] ?? sig[LETTERS.indexOf(n.letter)] ?? 0;
      out.push(n.acc !== cur ? n.acc : null);
      state[key] = n.acc;
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
    const clip = () => { ctx.beginPath(); ctx.rect(L.x0 - gap * 1.6, 0, L.x1 - L.x0 + gap * 1.6 + 8, s.h); ctx.clip(); };
    const bw = gap * 2.2;
    const g = ctx.createLinearGradient(0, top - 3 * gap, 0, top + 7 * gap);
    g.addColorStop(0, 'rgba(124,196,255,0)'); g.addColorStop(0.5, 'rgba(124,196,255,.22)'); g.addColorStop(1, 'rgba(124,196,255,0)');
    ctx.save(); clip();
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(sx(this.barX) - bw / 2, top - 3 * gap, bw, 10 * gap, bw / 2); ctx.fill();
    ctx.restore();

    // Staff, barlines, final double bar
    const LINE = 'rgba(232,234,240,.45)', INK = 'rgba(232,234,240,.85)';
    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    const ex = sx(L.contentW), staffEnd = Math.min(L.x1 + 6, ex + 3);
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(12, top + k * gap); ctx.lineTo(staffEnd, top + k * gap); ctx.stroke(); }
    ctx.save(); clip();
    ctx.beginPath(); ctx.moveTo(ex - 3, top); ctx.lineTo(ex - 3, top + 4 * gap); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex + 1.5, top); ctx.lineTo(ex + 1.5, top + 4 * gap); ctx.stroke();
    ctx.lineWidth = 1;
    for (const bx of L.bars) { ctx.beginPath(); ctx.moveTo(sx(bx), top); ctx.lineTo(sx(bx), top + 4 * gap); ctx.stroke(); }
    // Time signatures (at the start and wherever the meter changes)
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const sg of L.sigs) {
      const x = sx(sg.x), M = METERS[sg.meter];
      if (sg.meter === 'cut') {
        ctx.font = `700 ${gap * 3.1}px "Noto Serif", Georgia, serif`;
        ctx.fillText('C', x, top + 2 * gap + gap * 0.1);
        ctx.lineWidth = 1.6; ctx.strokeStyle = INK;
        ctx.beginPath(); ctx.moveTo(x, top - gap * 0.6); ctx.lineTo(x, top + 4.6 * gap); ctx.stroke();
        ctx.strokeStyle = LINE; ctx.lineWidth = 1;
      } else {
        ctx.font = `700 ${gap * 2.3}px "Noto Serif", Georgia, serif`;
        ctx.fillText(String(M.num), x, top + gap * 1.05);
        ctx.fillText(String(M.den), x, top + gap * 3.05);
      }
    }
    ctx.restore();

    // Clef (Noto Music): fit the glyph by its measured ink box (font metrics vary)
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
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
      const sharps = this.phrase.sig > 0, shift = treble ? 0 : -14;
      const pos = sharps ? [38, 35, 39, 36, 33, 37, 34] : [34, 37, 33, 36, 32, 35, 31];
      for (let k = 0; k < L.sigN; k++) {
        const d = pos[k] + shift;
        drawAcc(ctx, sharps ? 1 : -1, 4.0 * gap + 12 + k * 0.95 * gap, yOf({ oct: Math.floor(d / 7), letter: LETTERS[d % 7] }), gap, 'center');
      }
    }

    // ---- notes ----
    ctx.save(); clip();
    const mid = top + 2 * gap;
    const colorOf = (i) => {
      const r = i < this.idx || this.done ? this.ratings[i] : i === this.idx && this.started ? this.live : null;
      return r?.state && COLORS[r.state] ? COLORS[r.state] : r?.state === 'missed' ? C.faint : C.text;
    };
    const flagged = (hd) => hd.pc.type.base === '8' || hd.pc.type.base === '16';
    // beam groups: flagged notes within one beat (a triplet is always one group)
    const meterBounds = (mi) => {
      const mz = this.phrase.measures[mi], M = METERS[mz.meter], b = [0];
      M.beats.forEach((v) => b.push(b[b.length - 1] + v));
      return b.map((v) => v + mz.start - (mz.offset || 0));
    };
    const groups = [];
    let cur = null;
    for (const hd of L.heads) {
      const bounds = meterBounds(hd.pc.m);
      const beatIdx = bounds.findIndex((b, k) => hd.pc.start >= b - 1e-6 && hd.pc.start < (bounds[k + 1] ?? Infinity) - 1e-6);
      const key = hd.pc.tup || `${hd.pc.m}:${beatIdx}`;
      if (flagged(hd) && cur && cur.key === key) cur.items.push(hd);
      else { cur = flagged(hd) ? { key, items: [hd] } : null; if (cur) groups.push(cur); }
      hd.group = cur;
    }
    for (const gr of groups) {
      const ys = gr.items.map((hd) => yOf(hd.n));
      gr.up = ys.reduce((a, b) => a + b, 0) / ys.length > mid;
    }
    // heads, ledger lines, accidentals, dots, stems, flags
    for (const hd of L.heads) {
      const x = sx(hd.x), y = yOf(hd.n), base = hd.pc.type.base;
      if (x < L.x0 - gap * 3 || x > L.x1 + gap * 3) { hd.vis = false; continue; }
      hd.vis = true; hd.sx = x; hd.y = y;
      const col = colorOf(hd.i);
      ctx.strokeStyle = LINE; ctx.lineWidth = 1;
      for (let ly = top + 5 * gap; ly <= y + 0.1; ly += gap) { ctx.beginPath(); ctx.moveTo(x - gap * 0.95, ly); ctx.lineTo(x + gap * 0.95, ly); ctx.stroke(); }
      for (let ly = top - gap; ly >= y - 0.1; ly -= gap) { ctx.beginPath(); ctx.moveTo(x - gap * 0.95, ly); ctx.lineTo(x + gap * 0.95, ly); ctx.stroke(); }
      ctx.fillStyle = col; ctx.strokeStyle = col;
      if (hd.k === 0 && L.shown[hd.i] != null) drawAcc(ctx, L.shown[hd.i], x - gap * 0.85, y, gap, 'right');
      ctx.save(); ctx.translate(x, y); ctx.beginPath();
      if (base === 'w') { ctx.ellipse(0, 0, gap * 0.78, gap * 0.48, 0, 0, Math.PI * 2); ctx.ellipse(0, 0, gap * 0.42, gap * 0.26, 1.0, 0, Math.PI * 2); }
      else {
        ctx.ellipse(0, 0, gap * 0.62, gap * 0.44, -0.35, 0, Math.PI * 2);
        if (base === 'h') ctx.ellipse(0, 0, gap * 0.5, gap * 0.19, -0.6, 0, Math.PI * 2);
      }
      ctx.fill('evenodd'); ctx.restore();
      if (hd.pc.type.dots) {
        const onLine = Math.round((y - top) / (gap / 2)) % 2 === 0;
        ctx.beginPath(); ctx.arc(x + gap * (base === 'w' ? 1.2 : 1.0), y - (onLine ? gap * 0.5 : 0), gap * 0.17, 0, Math.PI * 2); ctx.fill();
      }
      if (hd.i === 0 && hd.k === 0) this.firstNote = { x, y, r: gap * 1.4 };
      if (base === 'w') continue;
      const up = hd.group ? hd.group.up : y > mid;
      hd.up = up; hd.stemX = up ? x + gap * 0.56 : x - gap * 0.56;
      if (!hd.group || hd.group.items.length === 1) {
        // single note: plain stem, and flags for eighths and sixteenths
        const end = y + (up ? -3.4 * gap : 3.4 * gap);
        ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(hd.stemX, y + (up ? -gap * 0.15 : gap * 0.15)); ctx.lineTo(hd.stemX, end); ctx.stroke();
        const nFlags = base === '8' ? 1 : base === '16' ? 2 : 0;
        for (let f = 0; f < nFlags; f++) {
          const fy = end + (up ? 1 : -1) * f * gap * 0.85, dir = up ? 1 : -1;
          ctx.beginPath(); ctx.moveTo(hd.stemX, fy);
          ctx.bezierCurveTo(hd.stemX + gap * 0.1, fy + dir * gap * 1.0, hd.stemX + gap * 1.15, fy + dir * gap * 1.2, hd.stemX + gap * 0.8, fy + dir * gap * 2.4);
          ctx.bezierCurveTo(hd.stemX + gap * 0.95, fy + dir * gap * 1.5, hd.stemX + gap * 0.2, fy + dir * gap * 1.25, hd.stemX, fy + dir * gap * 0.75);
          ctx.fill();
        }
      }
    }
    // beams (with stems reaching them), secondary beams for sixteenths, triplet numbers
    for (const gr of groups) {
      const it = gr.items.filter((hd) => hd.vis);
      if (it.length !== gr.items.length) continue;
      if (it.length === 1) continue;
      const up = gr.up, dir = up ? -1 : 1, a = it[0], z = it[it.length - 1];
      let slope = (z.y - a.y) / Math.max(1, z.stemX - a.stemX);
      slope = Math.max(-0.25, Math.min(0.25, slope)) * 0.5;
      let y0 = a.y + dir * 3.3 * gap;
      const beamY = (x) => y0 + slope * (x - a.stemX);
      for (const hd of it) { // every stem at least 2.6 spaces long: move the beam away from the heads if needed
        const diff = beamY(hd.stemX) - (hd.y + dir * 2.6 * gap);
        if (up ? diff > 0 : diff < 0) y0 -= diff;
      }
      ctx.strokeStyle = C.text; ctx.fillStyle = C.text;
      for (const hd of it) {
        ctx.strokeStyle = colorOf(hd.i);
        ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(hd.stemX, hd.y + dir * gap * 0.15); ctx.lineTo(hd.stemX, beamY(hd.stemX)); ctx.stroke();
      }
      const th = gap * 0.45;
      const beam = (xa, xb, off) => {
        ctx.beginPath();
        ctx.moveTo(xa, beamY(xa) - dir * off); ctx.lineTo(xb, beamY(xb) - dir * off);
        ctx.lineTo(xb, beamY(xb) - dir * off - dir * th); ctx.lineTo(xa, beamY(xa) - dir * off - dir * th);
        ctx.closePath(); ctx.fill();
      };
      ctx.fillStyle = C.text;
      beam(a.stemX, z.stemX, 0);
      it.forEach((hd, k) => {
        if (hd.pc.type.base !== '16') return;
        const nb = it[k + 1], pb = it[k - 1];
        if (nb && nb.pc.type.base === '16') beam(hd.stemX, nb.stemX, gap * 0.75); // second beam, toward the heads
        else if (!(pb && pb.pc.type.base === '16')) { // lone sixteenth: a short stub toward its neighbour
          const to = nb ? Math.min(hd.stemX + gap * 1.0, nb.stemX) : Math.max(hd.stemX - gap * 1.0, pb.stemX);
          beam(Math.min(hd.stemX, to), Math.max(hd.stemX, to), gap * 0.75);
        }
      });
      if (a.pc.tup) {
        ctx.font = `italic 700 ${gap * 1.25}px "Noto Serif", Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const cx = (a.stemX + z.stemX) / 2;
        ctx.fillText('3', cx, beamY(cx) + dir * gap * 1.1);
      }
    }
    // triplets that aren't beamed (quarter-note triplets): a bracket with 3
    const tups = {};
    for (const hd of L.heads) if (hd.pc.tup && hd.vis && !(hd.group && hd.group.items.length > 1)) (tups[hd.pc.tup] ||= []).push(hd);
    for (const list of Object.values(tups)) {
      const a = list[0], z = list[list.length - 1], up = (a.up ?? true);
      const y = (up ? Math.min(...list.map((h) => h.y)) - 4.2 * gap : Math.max(...list.map((h) => h.y)) + 4.2 * gap);
      ctx.strokeStyle = C.text; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.sx - gap * 0.6, y + (up ? gap * 0.5 : -gap * 0.5)); ctx.lineTo(a.sx - gap * 0.6, y); ctx.lineTo(z.sx + gap * 0.6, y); ctx.lineTo(z.sx + gap * 0.6, y + (up ? gap * 0.5 : -gap * 0.5)); ctx.stroke();
      ctx.fillStyle = '#12151c'; ctx.fillRect((a.sx + z.sx) / 2 - gap * 0.6, y - gap * 0.6, gap * 1.2, gap * 1.2);
      ctx.fillStyle = C.text; ctx.font = `italic 700 ${gap * 1.25}px "Noto Serif", Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('3', (a.sx + z.sx) / 2, y);
    }
    // words: one syllable under each note, hyphens within words, pinyin under Chinese characters
    if (this.phrase.lang) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const firsts = L.heads.filter((hd) => hd.k === 0 && hd.n.syl);
      firsts.forEach((hd, j) => {
        if (!hd.vis) return;
        const sy = hd.n.syl, done = hd.i < this.idx || this.done;
        ctx.fillStyle = done ? C.muted : C.text;
        ctx.font = L.lyricFont; ctx.fillText(sy.text, hd.sx, L.lyricY);
        if (sy.sub) { ctx.font = L.subFont; ctx.fillStyle = C.muted; ctx.fillText(sy.sub, hd.sx, L.lyricY + gap * 1.45); }
        const nx = firsts[j + 1];
        if (!sy.wordEnd && nx?.vis) {
          ctx.font = L.lyricFont;
          const a = hd.sx + ctx.measureText(sy.text).width / 2, b = nx.sx - ctx.measureText(nx.n.syl.text).width / 2;
          if (b - a > gap * 0.5) { ctx.fillStyle = C.muted; ctx.fillText('-', (a + b) / 2, L.lyricY); }
        }
      });
    }
    // ties: a curve from each piece to the next piece of the same note, away from the stems
    for (const n of notes) {
      for (let k = 0; k < n.pieces.length - 1; k++) {
        const a = L.heads.find((hd) => hd.n === n && hd.k === k), b = L.heads.find((hd) => hd.n === n && hd.k === k + 1);
        if (!a?.vis || !b?.vis) continue;
        const down = !(a.up ?? (a.y > mid)) ? -1 : 1, y = a.y + down * gap * 0.75;
        ctx.strokeStyle = colorOf(a.i); ctx.lineWidth = gap * 0.16;
        ctx.beginPath(); ctx.moveTo(a.sx + gap * 0.5, y); ctx.quadraticCurveTo((a.sx + b.sx) / 2, y + down * gap * 0.9, b.sx - gap * 0.5, y); ctx.stroke();
      }
    }
    ctx.restore();
  }
}
