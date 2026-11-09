import { t } from './i18n.js';
// Synthesizer panel: user-set F0 / F1 / F2 / F3 / volume driving the formant-synth worklet.

import { NOTE_NAMES, midiToFreq } from './dsp/pitch.js';

const KEY = 'va.synth';
const DEFAULTS = { midi: 57, f1: 780, f2: 1430, f3: 2600, db: -12, vibrato: false };

const noteLabel = (m) => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

export class SynthUI {
  /**
   * @param {{landmarks:()=>{ipa:string,f1:number,f2:number,f3?:number}[], f3For:(ipa:string)=>number,
   *          start:()=>Promise<void>, stop:()=>void, isRunning:()=>boolean}} hooks
   */
  constructor(hooks) {
    this.h = hooks;
    const $ = (id) => document.getElementById(id);
    this.el = {
      panel: $('synthPanel'), toggle: $('synthToggle'), close: $('synthClose'), chips: $('synthVowels'),
      vib: $('synthVibrato'), play: $('synthPlay'),
    };
    this.sliders = {
      midi: $('sMidi'), f1: $('sF1'), f2: $('sF2'), f3: $('sF3'), db: $('sDb'),
    };
    this.out = { midi: $('oMidi'), f1: $('oF1'), f2: $('oF2'), f3: $('oF3'), db: $('oDb') };
    // Inline dashboard controls (shown only while synthesizing) mirror the dialog
    this.inline = { midi: $('iMidi'), db: $('iDb') };
    this.inlineOut = { midi: $('ioMidi'), db: $('ioDb') };
    this.node = null;

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* ignore */ }
    this.state = { ...DEFAULTS, ...saved };

    for (const [k, input] of [...Object.entries(this.sliders), ...Object.entries(this.inline)]) {
      input?.addEventListener('input', () => this.set({ [k]: Number(input.value) }));
    }
    this.makeDraggable();
    this.el.vib.addEventListener('change', () => { this.state.vibrato = this.el.vib.checked; this.apply(); });
        this.el.close.addEventListener('click', () => this.close());
    this.el.play.addEventListener('click', () => (this.h.isRunning() ? this.h.stop() : this.h.start()));
    this.el.chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ipa]');
      if (!b) return;
      const v = this.h.landmarks().find((x) => x.ipa === b.dataset.ipa);
      if (!v) return;
      Object.assign(this.state, { f1: Math.round(v.f1), f2: Math.round(v.f2), f3: Math.round(this.h.f3For(v.ipa)) });
      this.apply();
    });
    this.render();
  }

  /** Set one or more parameters (from the dialog, the inline sliders, or dragging on the map / F3 bar). */
  set(partial) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const lim = { midi: [36, 84], f1: [200, 1200], f2: [500, 3200], f3: [1800, 4000], db: [-40, 0] };
    for (const [k, v] of Object.entries(partial)) {
      if (lim[k]) this.state[k] = Math.round(clamp(v, ...lim[k]));
      else this.state[k] = v;
    }
    if (this.state.f2 < this.state.f1 + 100) this.state.f2 = Math.min(3200, this.state.f1 + 100); // keep F2 above F1
    this.apply();
  }

  /** Drag the dialog by its title bar (desktop); remembers where it was left. */
  makeDraggable() {
    const panel = this.el.panel, head = panel.querySelector('.cal-head');
    const POS = 'va.synthPos';
    const place = (x, y) => {
      const r = panel.getBoundingClientRect();
      const nx = Math.max(8, Math.min(innerWidth - r.width - 8, x));
      const ny = Math.max(8, Math.min(innerHeight - 40, y));
      Object.assign(panel.style, { left: `${nx}px`, top: `${ny}px`, right: 'auto', bottom: 'auto' });
      return [nx, ny];
    };
    const desktop = () => matchMedia('(min-width: 761px)').matches;
    this.restorePos = () => {
      if (!desktop()) { Object.assign(panel.style, { left: '', top: '', right: '', bottom: '' }); return; }
      try { const p = JSON.parse(localStorage.getItem(POS) || 'null'); if (p) place(p[0], p[1]); } catch { /* ignore */ }
    };
    let drag = null;
    head.addEventListener('pointerdown', (e) => {
      if (!desktop() || e.target.closest('button')) return;
      const r = panel.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      try { head.setPointerCapture(e.pointerId); } catch { /* not all pointers capture */ }
      panel.classList.add('dragging');
    });
    head.addEventListener('pointermove', (e) => { if (drag) place(e.clientX - drag.dx, e.clientY - drag.dy); });
    const end = () => {
      if (!drag) return;
      drag = null;
      panel.classList.remove('dragging');
      const r = panel.getBoundingClientRect();
      try { localStorage.setItem(POS, JSON.stringify([r.left, r.top])); } catch { /* ignore */ }
    };
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
    addEventListener('resize', () => this.restorePos());
  }

  /** Called by main when a synth session starts / ends. */
  attach(node) { this.node = node; this.apply(); this.renderPlay(); }
  detach() { this.node = null; this.renderPlay(); }

  open() {
    this.el.panel.hidden = false;
    this.restorePos?.();
    this.el.toggle?.setAttribute('aria-pressed', 'true');
    this.render();
    if (!this.h.isRunning()) this.h.start();
  }

  close() {
    this.el.panel.hidden = true;
    this.el.toggle?.setAttribute('aria-pressed', 'false');
    if (this.h.isRunning()) this.h.stop();
  }

  apply() {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* ignore */ }
    this.render();
    if (!this.node) return;
    const P = this.node.parameters;
    const t = this.node.context.currentTime;
    P.get('f0').setValueAtTime(midiToFreq(this.state.midi), t);
    P.get('f1').setValueAtTime(this.state.f1, t);
    P.get('f2').setValueAtTime(this.state.f2, t);
    P.get('f3').setValueAtTime(this.state.f3, t);
    P.get('gain').setValueAtTime(this.state.db <= -40 ? 0 : Math.pow(10, this.state.db / 20), t);
    P.get('vibrato').setValueAtTime(this.state.vibrato ? 1 : 0, t);
  }

  render() {
    const s = this.state;
    for (const [k, input] of Object.entries(this.sliders)) input.value = String(s[k]);
    this.el.vib.checked = !!s.vibrato;
    this.out.midi.textContent = `${noteLabel(s.midi)} · ${midiToFreq(s.midi).toFixed(1)} Hz`;
    this.out.f1.textContent = `${s.f1} Hz`;
    this.out.f2.textContent = `${s.f2} Hz`;
    this.out.f3.textContent = `${s.f3} Hz`;
    this.out.db.textContent = s.db <= -40 ? t('muted') : `${s.db} dB`;
    for (const [k, input] of Object.entries(this.inline)) if (input && document.activeElement !== input) input.value = String(s[k]);
    if (this.inlineOut.midi) this.inlineOut.midi.textContent = this.out.midi.textContent;
    if (this.inlineOut.db) this.inlineOut.db.textContent = this.out.db.textContent;
    this.el.chips.innerHTML = this.h.landmarks().map((v) => {
      const on = Math.abs(v.f1 - s.f1) < 2 && Math.abs(v.f2 - s.f2) < 2;
      return `<button class="cal-chip" data-ipa="${v.ipa}" aria-pressed="${on}" title="Set F1/F2/F3 to [${v.ipa}]">${v.ipa}</button>`;
    }).join('');
    this.renderPlay();
  }

  renderPlay() {
    const running = this.h.isRunning();
    this.el.play.textContent = t(running ? 'Stop sound' : 'Play');
    this.el.play.className = running ? 'btn btn-secondary' : 'btn btn-primary';
  }
}
