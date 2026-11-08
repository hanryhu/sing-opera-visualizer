// Samples panel: play an openly licensed aria excerpt per voice part through the analyzer.

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function loadSamples() {
  try { return (await import('./samples.js')).SAMPLES || []; } catch { return []; }
}

/** Pick the first file the browser can decode (Ogg Vorbis, else MP3/AAC). */
export function pickFile(sample) {
  const a = document.createElement('audio');
  const ok = (f) => (f.endsWith('.ogg') ? a.canPlayType('audio/ogg; codecs="vorbis"')
    : f.endsWith('.mp3') ? a.canPlayType('audio/mpeg') : a.canPlayType('audio/mp4'));
  return sample.files.find(ok) || sample.files[sample.files.length - 1];
}

export class SamplesUI {
  /**
   * @param {{play:(s:object)=>Promise<void>, stop:()=>void, playingId:()=>string|null}} hooks
   */
  constructor(samples, hooks) {
    this.samples = samples;
    this.h = hooks;
    const $ = (id) => document.getElementById(id);
    this.el = { panel: $('samplesPanel'), toggle: $('samplesToggle'), close: $('samplesClose'), list: $('samplesList') };
    this.el.toggle.addEventListener('click', () => (this.el.panel.hidden ? this.open() : this.close()));
    this.el.close.addEventListener('click', () => this.close());
    this.el.list.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      const s = this.samples.find((x) => x.id === b.dataset.id);
      if (this.h.playingId() === s.id) this.h.stop(); else await this.h.play(s);
      this.render();
    });
    this.render();
  }

  open() {
    document.querySelectorAll('.cal-panel').forEach((p) => { if (p !== this.el.panel && !p.hidden) p.querySelector('.icon-btn')?.click(); });
    this.el.panel.hidden = false;
    this.el.toggle.setAttribute('aria-pressed', 'true');
    this.render();
  }

  close() {
    this.el.panel.hidden = true;
    this.el.toggle.setAttribute('aria-pressed', 'false');
    if (this.h.playingId()) this.h.stop();
  }

  render() {
    const playing = this.h.playingId();
    this.el.list.innerHTML = this.samples.length ? this.samples.map((s) => `
      <li class="sample${playing === s.id ? ' on' : ''}">
        <button class="sample-play" data-id="${esc(s.id)}" aria-label="${playing === s.id ? 'Stop' : 'Play'} ${esc(s.part)}">${playing === s.id ? '■' : '▶'}</button>
        <div class="sample-text">
          <div><b>${esc(s.part)}</b> · <i>${esc(s.aria)}</i></div>
          <div class="sample-meta">${esc(s.singer)}${s.year ? `, ${esc(s.year)}` : ''} · ${esc(s.composer)}, ${esc(s.opera)}</div>
        </div>
      </li>`).join('') : '<li class="sample-meta">Samples are not available.</li>';
  }
}
