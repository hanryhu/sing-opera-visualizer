import { t, isZh } from './i18n.js';
// Record: up to MAX_SECONDS of the dashboard as a video with sound, settings burned into a header line.
// The app draws the frames itself (no screen-share prompt, works on phones); the audio track is exactly
// what the analyzer hears (shared tap node). One file, saved locally.

const MAX_SECONDS = 30; // time limit; measured ~80-170 KB/s, so typically ~2.5-5 MB (worst case ~10 MB)
const OUT_W = 1280;
const HEADER_H = 52;

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

function pickMime() {
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return (window.MediaRecorder && types.find((t) => MediaRecorder.isTypeSupported(t))) || '';
}

function browserName() {
  const ua = navigator.userAgent;
  const m = ua.match(/(Edg|OPR|Chrome|Firefox|Version)\/(\d+)/);
  const name = m ? { Edg: 'Edge', OPR: 'Opera', Version: 'Safari' }[m[1]] || m[1] : 'browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
  return `${name} ${m ? m[2] : ''}${os ? ' / ' + os : ''}`;
}

export class FeedbackRecorder {
  /**
   * @param {{getSession:()=>object|null, describe:()=>object, toast:(msg:string)=>void}} hooks
   */
  constructor(hooks) {
    this.h = hooks;
    const $ = (id) => document.getElementById(id);
    this.el = { btn: $('feedbackBtn'), panel: $('feedbackPanel'), close: $('feedbackClose'), summary: $('feedbackSummary'), links: $('feedbackLinks') };
    this.rec = null;
    this.idleHtml = this.el.btn.innerHTML; // record icon
    this.el.btn.addEventListener('click', () => (this.rec ? this.stop() : this.start()));
    this.el.close.addEventListener('click', () => { this.el.panel.hidden = true; });
    // Never keep recording a tab the user has left
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.rec) this.stop(); });
  }

  get recording() { return !!this.rec; }

  start() {
    const session = this.h.getSession();
    if (!session) { this.h.toast(t('Start Sing, Synthesize or Listen first, then press Record.')); return; }
    const mime = pickMime();
    const canvas = document.createElement('canvas');
    if (!mime || !canvas.captureStream) { this.h.toast(t('Recording is not supported in this browser.')); return; }
    const { ctx, tap } = session;
    const dash = document.getElementById('dashboard').getBoundingClientRect();
    const scale = OUT_W / dash.width;
    canvas.width = OUT_W;
    canvas.height = Math.round(dash.height * scale) + HEADER_H;
    const rec = {
      session, canvas, g: canvas.getContext('2d'), scale, dash, mime,
      t0: new Date(), tStart: performance.now() / 1000, chunks: [], sampleRate: ctx.sampleRate,
    };
    rec.dest = ctx.createMediaStreamDestination();
    tap.connect(rec.dest);
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...rec.dest.stream.getAudioTracks()]);
    rec.mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 });
    rec.mr.ondataavailable = (e) => { if (e.data.size) rec.chunks.push(e.data); };
    rec.mr.start(250);
    this.rec = rec;
    this.composite(rec.tStart);
    this.el.panel.hidden = true;
    this.el.btn.classList.add('recording');
    this.tick();
  }

  tick() {
    const rec = this.rec;
    if (!rec) return;
    const el = performance.now() / 1000 - rec.tStart;
    this.el.btn.innerHTML = `<span class="rec-stop" aria-hidden="true"></span><span class="rec-secs">${Math.max(0, Math.ceil(MAX_SECONDS - el))}</span>`;
    this.el.btn.setAttribute('aria-label', 'Stop recording');
    if (el >= MAX_SECONDS) { this.stop(); return; }
    setTimeout(() => this.tick(), 200);
  }

  /** Called from the main render loop every frame while recording. */
  onFrame(_o, now) { if (this.rec) this.composite(now); }

  settingsLine() {
    const d = this.h.describe();
    const on = (b) => (b ? 'on' : 'off');
    const parts = [
      `Detail ${on(d.view.detail)}`, `¼ tones ${on(d.view.quarter)}`,
      `calibrated ${d.calibrated ? 'yes' : 'no'}`,
    ];
    if (d.synth) parts.push(`synth F0 midi ${d.synth.midi} F1 ${d.synth.f1} F2 ${d.synth.f2} F3 ${d.synth.f3} ${d.synth.db} dB${d.synth.vibrato ? ' vib' : ''}`);
    parts.push(browserName(), `${(this.rec.sampleRate / 1000).toFixed(1)} kHz`, `${innerWidth}×${innerHeight}`);
    return parts.join(' · ');
  }

  composite(now) {
    const { g, scale, dash, canvas, t0, tStart } = this.rec;
    const css = getComputedStyle(document.documentElement);
    g.fillStyle = css.getPropertyValue('--bg') || '#0b0d12';
    g.fillRect(0, 0, canvas.width, canvas.height);
    const d = this.h.describe();
    g.textBaseline = 'middle';
    g.fillStyle = '#e8eaf0'; g.font = '600 14px Inter, system-ui, sans-serif';
    g.fillText(`Sing Together · ${t0.toLocaleString()} · ${d.mode} · ${d.voice} voice · ${(now - tStart).toFixed(1)} s`, 14, 16);
    g.fillStyle = '#8b93a7'; g.font = '500 12px Inter, system-ui, sans-serif';
    g.fillText(this.settingsLine(), 14, 36);
    g.save();
    g.translate(0, HEADER_H);
    g.scale(scale, scale);
    const at = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - dash.left, y: r.top - dash.top, w: r.width, h: r.height, visible: r.width > 0 && r.height > 0 }; };
    for (const p of document.querySelectorAll('#dashboard .panel')) {
      const r = at(p);
      g.fillStyle = css.getPropertyValue('--panel') || '#12161e';
      g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, 14); g.fill();
    }
    for (const c of document.querySelectorAll('#dashboard canvas')) {
      const r = at(c);
      if (r.visible && c.width) g.drawImage(c, r.x, r.y, r.w, r.h);
    }
    const texts = ['#noteName', '#noteOct', '#tuneState', '#detailReadout', '#mapHint', '#clipLamp', '#dashboard .panel-label'];
    for (const el of document.querySelectorAll(texts.join(','))) {
      if (el.closest('[hidden]') || !el.textContent.trim()) continue;
      const r = at(el);
      if (!r.visible) continue;
      const cs = getComputedStyle(el);
      g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      g.fillStyle = cs.color;
      const txt = el.textContent.trim().replace(/\s+/g, ' ');
      g.fillText(cs.textTransform === 'uppercase' ? txt.toUpperCase() : txt, r.x, r.y + r.h / 2);
    }
    g.restore();
  }

  async stop() {
    const rec = this.rec;
    if (!rec) return;
    this.rec = null;
    this.el.btn.classList.remove('recording');
    this.el.btn.innerHTML = this.idleHtml;
    this.el.btn.setAttribute('aria-label', 'Record');
    try { rec.session.tap.disconnect(rec.dest); } catch { /* session may already be gone */ }
    const seconds = performance.now() / 1000 - rec.tStart;
    const blob = await new Promise((res) => {
      rec.mr.onstop = () => res(new Blob(rec.chunks, { type: rec.mime.split(';')[0] }));
      rec.mr.stop();
    });
    if (!blob.size) {
      this.h.toast(t('The recording came out empty — keep this tab in front while recording.'));
      return;
    }
    const name = `sing-record-${stamp(rec.t0)}.${rec.mime.includes('mp4') ? 'mp4' : 'webm'}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); // save straight away
    this.el.summary.textContent = isZh() ? `已将 ${seconds.toFixed(1)} 秒保存到下载文件夹。如果没有下载，请使用下方链接。` : `Saved ${seconds.toFixed(1)} s to your Downloads folder. If it didn't download, use the link below.`;
    this.el.links.innerHTML = `<li><a href="${url}" download="${name}">${name}</a> <span class="sample-meta">${(blob.size / 1024).toFixed(0)} KB</span></li>`;
    this.el.panel.hidden = false;
  }
}
