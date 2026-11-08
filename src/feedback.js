// Feedback recorder: up to MAX_SECONDS of (1) a video of the dashboard with sound, (2) a WAV of exactly
// what the analyzer heard, (3) a JSON log of every analyzer frame + settings. Saved as local files.

const MAX_SECONDS = 10;
const OUT_W = 1280;
const HEADER_H = 30;

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

function encodeWav(chunks, sampleRate) {
  const n = chunks.reduce((s, c) => s + c.length, 0);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  let o = 44;
  for (const c of chunks) for (let i = 0; i < c.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, c[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

function pickMime() {
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return (window.MediaRecorder && types.find((t) => MediaRecorder.isTypeSupported(t))) || '';
}

export class FeedbackRecorder {
  /**
   * @param {{getSession:()=>object|null, describe:()=>object, toast:(msg:string)=>void}} hooks
   */
  constructor(hooks) {
    this.h = hooks;
    const $ = (id) => document.getElementById(id);
    this.el = { btn: $('feedbackBtn'), panel: $('feedbackPanel'), close: $('feedbackClose'), summary: $('feedbackSummary'), links: $('feedbackLinks'), saveAll: $('feedbackSaveAll') };
    this.rec = null;
    this.files = [];
    this.el.btn.addEventListener('click', () => (this.rec ? this.stop() : this.start()));
    this.el.close.addEventListener('click', () => { this.el.panel.hidden = true; });
    this.el.saveAll.addEventListener('click', () => this.saveAll());
  }

  get recording() { return !!this.rec; }

  async start() {
    const session = this.h.getSession();
    if (!session) { this.h.toast('Start Sing, Synthesize or Listen first, then press Feedback.'); return; }
    const { ctx, tap } = session;
    const dash = document.getElementById('dashboard').getBoundingClientRect();
    const scale = OUT_W / dash.width;
    const canvas = document.createElement('canvas');
    canvas.width = OUT_W;
    canvas.height = Math.round(dash.height * scale) + HEADER_H;
    const t0 = new Date();
    const rec = {
      session, canvas, g: canvas.getContext('2d'), scale, dash, t0, tStart: performance.now() / 1000,
      chunks: [], frames: [], audio: [], sampleRate: ctx.sampleRate,
    };
    this.rec = rec;

    // (2) exact analyzer input → WAV
    try {
      await ctx.audioWorklet.addModule('src/recorder-worklet.js');
      rec.worklet = new AudioWorkletNode(ctx, 'tap-recorder', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      rec.worklet.port.onmessage = (e) => { if (this.rec === rec) rec.audio.push(e.data); };
      rec.sink = ctx.createGain(); rec.sink.gain.value = 0; // keep the worklet pulled without audible output
      tap.connect(rec.worklet).connect(rec.sink).connect(ctx.destination);
    } catch (err) { rec.audioError = String(err); }

    // (1) dashboard video + the same sound
    const mime = pickMime();
    if (mime && canvas.captureStream) {
      rec.dest = ctx.createMediaStreamDestination();
      tap.connect(rec.dest);
      const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...rec.dest.stream.getAudioTracks()]);
      rec.mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
      rec.mr.ondataavailable = (e) => { if (e.data.size) rec.chunks.push(e.data); };
      rec.mr.start(250);
      rec.mime = mime;
    } else rec.videoError = 'MediaRecorder / canvas capture not supported in this browser';

    this.el.panel.hidden = true;
    this.el.btn.classList.add('recording');
    this.tick();
  }

  tick() {
    const rec = this.rec;
    if (!rec) return;
    const el = performance.now() / 1000 - rec.tStart;
    this.el.btn.textContent = `■ Stop · ${Math.max(0, Math.ceil(MAX_SECONDS - el))}s`;
    if (el >= MAX_SECONDS) { this.stop(); return; }
    setTimeout(() => this.tick(), 200);
  }

  /** Called from the main render loop every frame while recording. */
  onFrame(o, now) {
    const rec = this.rec;
    if (!rec) return;
    if (o) {
      const r = (x) => (x ? Math.round(x * 10) / 10 : 0);
      rec.frames.push({
        t: Math.round((now - rec.tStart) * 1000) / 1000, rmsDb: r(o.rmsDb), peakDb: r(o.peakDb),
        clipped: o.clipped, distorted: o.distorted, voiced: o.voiced, f0: r(o.f0), midiMean: r(o.midiMean),
        f1: r(o.f1), f2: r(o.f2), f3: r(o.f3), ring: r(o.ring),
      });
    }
    this.composite(now);
  }

  composite(now) {
    const { g, scale, dash, canvas, t0, tStart } = this.rec;
    const css = getComputedStyle(document.documentElement);
    g.fillStyle = css.getPropertyValue('--bg') || '#0b0d12';
    g.fillRect(0, 0, canvas.width, canvas.height);
    const d = this.h.describe();
    g.fillStyle = '#e8eaf0'; g.font = '600 14px Inter, system-ui, sans-serif'; g.textBaseline = 'middle';
    g.fillText(`Vocal Analyzer feedback · ${t0.toLocaleString()} · ${d.mode} · ${d.voice} voice · ${(now - tStart).toFixed(1)} s`, 14, HEADER_H / 2);
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
      g.textBaseline = 'middle';
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
    this.el.btn.textContent = '● Feedback';
    const { session } = rec;
    try { session.tap.disconnect(rec.worklet); } catch { /* session may be gone */ }
    try { session.tap.disconnect(rec.dest); } catch { /* ignore */ }
    try { rec.worklet?.disconnect(); rec.sink?.disconnect(); } catch { /* ignore */ }

    const video = rec.mr ? await new Promise((res) => {
      rec.mr.onstop = () => res(new Blob(rec.chunks, { type: rec.mime.split(';')[0] }));
      rec.mr.stop();
    }) : null;
    const name = `sing-feedback-${stamp(rec.t0)}`;
    const seconds = rec.frames.length ? rec.frames[rec.frames.length - 1].t : 0;
    const data = {
      app: 'sing-opera-visualizer', recordedAt: rec.t0.toISOString(), seconds,
      settings: this.h.describe(), sampleRate: rec.sampleRate, userAgent: navigator.userAgent,
      screen: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
      notes: { videoError: rec.videoError, audioError: rec.audioError },
      frames: rec.frames,
    };
    this.files = [];
    if (video && !video.size) rec.videoError = rec.videoError || 'Video was empty (the page was not being drawn — was the tab in the background?)';
    if (video && video.size) this.files.push({ name: `${name}.${rec.mime.includes('mp4') ? 'mp4' : 'webm'}`, blob: video, label: 'Screen + sound (video)' });
    if (rec.audio.length) this.files.push({ name: `${name}.wav`, blob: encodeWav(rec.audio, rec.sampleRate), label: 'Exact analyzer audio (WAV)' });
    this.files.push({ name: `${name}.json`, blob: new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), label: 'Analyzer readings + settings (JSON)' });

    for (const f of this.files) f.url = URL.createObjectURL(f.blob);
    const problems = [rec.videoError, rec.audioError].filter(Boolean);
    this.el.summary.textContent = `Recorded ${seconds.toFixed(1)} s. Save the files and send them along with a note about what you expected to see.`
      + (problems.length ? ` (Note: ${problems.join('; ')})` : '');
    this.el.links.innerHTML = this.files.map((f) =>
      `<li><a href="${f.url}" download="${f.name}">${f.label}</a> <span class="sample-meta">${f.name} · ${(f.blob.size / 1024).toFixed(0)} KB</span></li>`).join('');
    this.el.panel.hidden = false;
  }

  saveAll() {
    for (const f of this.files) {
      const a = document.createElement('a');
      a.href = f.url; a.download = f.name;
      document.body.appendChild(a); a.click(); a.remove();
    }
  }
}
