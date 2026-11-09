// Vowel calibration: capture the singer's own F1/F2/F3 per vowel, persist per voice preset.

import { CALIBRATION_ORDER, REQUIRED, landmarksFromCalibration } from './vowels.js';
import { t, isZh, exampleFor } from './i18n.js';

const CAPTURE_SECONDS = 3;
const SKIP_SECONDS = 0.5; // ignore the onset
const MIN_FRAMES = 30;
const EXAMPLES = {
  a: 'as in “casa”', e: 'as in “sera”', i: 'as in “vita”', o: 'as in “sole”',
  u: 'as in “luna”', ɛ: 'as in “bello”', ɔ: 'as in “nove”',
};

const key = (voice) => `va.calib.${voice}`;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

export function loadCalibration(voice) {
  try {
    const raw = localStorage.getItem(key(voice));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Landmarks to draw for a voice: the singer's own if calibrated, else null. */
export function calibratedLandmarks(voice) {
  const c = loadCalibration(voice);
  return c && REQUIRED.every((v) => c[v]) ? landmarksFromCalibration(c) : null;
}

export class CalibrationUI {
  /**
   * @param {{getVoice:()=>string, voiceLabel:(v:string)=>string, ensureSession:()=>Promise<boolean>, onSaved:()=>void}} hooks
   */
  constructor(hooks) {
    this.h = hooks;
    const $ = (id) => document.getElementById(id);
    this.el = {
      panel: $('calPanel'), toggle: $('calibToggle'), close: $('calClose'), chips: $('calChips'),
      vowel: $('calVowel'), example: $('calExample'), record: $('calRecord'), bar: $('calBar'),
      msg: $('calMsg'), save: $('calSave'), defaults: $('calDefaults'), voice: $('calVoice'),
    };
    this.draft = {};
    this.selected = 'a';
    this.rec = null;

    this.el.toggle.addEventListener('click', () => (this.el.panel.hidden ? this.open() : this.close()));
    this.el.close.addEventListener('click', () => this.close());
    this.el.record.addEventListener('click', () => this.record());
    this.el.save.addEventListener('click', () => this.save());
    this.el.defaults.addEventListener('click', () => this.useDefaults());
    this.el.chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ipa]');
      if (b && !this.rec) { this.selected = b.dataset.ipa; this.render(); }
    });
  }

  open() {
    this.draft = { ...(loadCalibration(this.h.getVoice()) || {}) };
    this.selected = CALIBRATION_ORDER.find((v) => !this.draft[v]) || 'a';
    this.el.panel.hidden = false;
    this.el.toggle.setAttribute('aria-pressed', 'true');
    this.setMsg('');
    this.render();
  }

  close() {
    this.rec = null;
    this.el.panel.hidden = true;
    this.el.toggle.setAttribute('aria-pressed', 'false');
  }

  /** Voice preset changed while open: reload that preset's saved vowels. */
  voiceChanged() { if (!this.el.panel.hidden) this.open(); }

  render() {
    const v = this.selected;
    this.el.voice.textContent = this.h.voiceLabel(this.h.getVoice());
    this.el.chips.innerHTML = CALIBRATION_ORDER.map((ipa) => {
      const cls = ['cal-chip', this.draft[ipa] ? 'done' : '', REQUIRED.includes(ipa) ? '' : 'optional'].join(' ');
      return `<button role="tab" class="${cls}" data-ipa="${ipa}" aria-selected="${ipa === v}" title="${exampleFor(ipa, EXAMPLES[ipa])}">${ipa}</button>`;
    }).join('');
    this.el.vowel.textContent = v;
    this.el.example.textContent = exampleFor(v, EXAMPLES[v]);
    this.el.record.textContent = t(this.rec ? 'Listening…' : this.draft[v] ? 'Record again' : 'Record');
    this.el.record.disabled = !!this.rec;
    this.el.save.disabled = !REQUIRED.every((x) => this.draft[x]);
  }

  setMsg(text, bad = false) {
    this.el.msg.textContent = text;
    this.el.msg.classList.toggle('bad', bad);
  }

  async record() {
    if (this.rec) return;
    if (!(await this.h.ensureSession())) { this.setMsg(t('Start the microphone first.'), true); return; }
    this.rec = { vowel: this.selected, t0: performance.now() / 1000, frames: [] };
    this.setMsg(isZh() ? `现在唱 “${this.selected}”…` : `Sing “${this.selected}” now…`);
    this.render();
  }

  /** Called every animation frame with the analyzer output. */
  tick(o, now) {
    if (!this.rec) return;
    const r = this.rec;
    const el = now - r.t0;
    this.el.bar.style.width = `${Math.min(100, (el / CAPTURE_SECONDS) * 100)}%`;
    if (el > SKIP_SECONDS && o?.voiced && o.f1 && o.f2) r.frames.push(o);
    if (el < CAPTURE_SECONDS) return;

    this.rec = null;
    this.el.bar.style.width = '0%';
    if (r.frames.length < MIN_FRAMES) {
      this.setMsg(t('Not enough steady voice — sing a little louder and hold the vowel.'), true);
    } else {
      const res = {
        f1: Math.round(median(r.frames.map((f) => f.f1))),
        f2: Math.round(median(r.frames.map((f) => f.f2))),
        f3: Math.round(median(r.frames.filter((f) => f.f3).map((f) => f.f3)) || 0),
      };
      this.draft[r.vowel] = res;
      const next = CALIBRATION_ORDER.find((v) => !this.draft[v]);
      const ready = REQUIRED.every((x) => this.draft[x]);
      this.setMsg(isZh()
        ? `✓ 已录下 ${r.vowel}（F1 ${res.f1} · F2 ${res.f2} Hz）${ready ? '，可以保存。' : ''}`
        : `✓ ${r.vowel} captured (F1 ${res.f1} · F2 ${res.f2} Hz)${ready ? ' — ready to save.' : ''}`);
      if (next) this.selected = next;
    }
    this.render();
  }

  save() {
    try { localStorage.setItem(key(this.h.getVoice()), JSON.stringify(this.draft)); } catch { /* ignore */ }
    this.setMsg(t('Saved. The vowel map now uses your vowels.'));
    this.h.onSaved();
  }

  useDefaults() {
    try { localStorage.removeItem(key(this.h.getVoice())); } catch { /* ignore */ }
    this.draft = {};
    this.selected = 'a';
    this.setMsg(t('Back to the default vowel landmarks.'));
    this.render();
    this.h.onSaved();
  }
}
