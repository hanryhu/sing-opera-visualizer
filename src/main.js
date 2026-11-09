import { Analyzer } from './dsp/analyzer.js';
import { tuningState, nearestStep, stepName, stepOctave, midiToFreq } from './dsp/pitch.js';
import { renderDemo } from './demo.js';
import { VOICE_PRESETS, extraVowels, roundingPair, SOURCES, pitchAdjustedLandmarks } from './vowels.js';
import { CalibrationUI, calibratedLandmarks } from './calibration.js';
import { SynthUI } from './synth.js';
import { SamplesUI, loadSamples, pickFile } from './sampleplayer.js';
import { FeedbackRecorder } from './feedback.js';
import { Surface, drawGauge, drawTrace, drawF3, drawVowelMap, drawMeter, drawVibrato, mapGeometry, f3Geometry } from './ui/panels.js';
import { analyzeVibrato, RATE_BAND, RATE_BEST, EXTENT_BAND } from './dsp/vibrato.js';

const FFT = 4096;
const PARAMS = new URLSearchParams(location.search);
// Dev only: ?devtest autostarts the synthetic melody silently for visual QA
// (?devtest=a sustains one vowel, for calibration QA).
const MUTE_DEMO = ['devtest', 'devsynth', 'devsample', 'mute'].some((k) => PARAMS.has(k)); // dev URLs are silent
const $ = (id) => document.getElementById(id);
const els = {
  landing: $('landing'), error: $('errorMsg'), toast: $('toast'),
  exitBtn: $('exitBtn'), settingsBtn: $('settingsBtn'), settingsMenu: $('settingsMenu'), voiceDetected: $('voiceDetected'),
  noteBox: $('noteBox'), noteName: $('noteName'), noteOct: $('noteOct'), tuneState: $('tuneState'),
  mapHint: $('mapHint'), clip: $('clipLamp'), detailReadout: $('detailReadout'),
  detailToggle: $('detailToggle'), quarterToggle: $('quarterToggle'),
  calBadge: $('calBadge'), calReset: $('calReset'),
};
const surf = {
  gauge: new Surface($('gauge')),
  trace: new Surface($('trace')),
  f3: new Surface($('f3canvas')),
  map: new Surface($('mapcanvas')),
  meter: new Surface($('metercanvas')),
  vib: new Surface($('vibcanvas')),
};

let session = null; // { ctx, analyser, mode, analyzer, stream?, src?, demo? }

/* ---------------- settings ---------------- */
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
// Voice range: Auto (default — detected from the pitches you sing) or a fixed High / Low preset.
let voiceMode = store.get('va.voiceMode', 'auto');
if (!['auto', 'high', 'low'].includes(voiceMode)) voiceMode = 'auto';
let voice = voiceMode === 'auto' ? store.get('va.voiceAuto', 'low') : voiceMode;
if (!VOICE_PRESETS[voice]) voice = 'low';
let autoNote = '';
/** Set the effective voice preset (landmarks, synth/sample defaults). */
function setVoice(v) {
  voice = v;
  if (voiceMode === 'auto') store.set('va.voiceAuto', v);
  if (session?.mode === 'demo') startDemoSource();
  refreshLandmarks();
  calib?.voiceChanged();
  updateVoiceUI();
}
function setVoiceMode(m) {
  voiceMode = m;
  store.set('va.voiceMode', m);
  setVoice(m === 'auto' ? store.get('va.voiceAuto', voice) : m);
}
function updateVoiceUI() {
  document.querySelectorAll('button[data-voicemode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.voicemode === voiceMode)));
  if (els.voiceDetected) {
    els.voiceDetected.textContent = voiceMode === 'auto'
      ? `Using ${voice === 'high' ? 'High' : 'Low'} voice${autoNote ? ` — your typical pitch ${autoNote}` : ' — sing to detect'}`
      : VOICE_PRESETS[voice].hint;
  }
}
document.querySelectorAll('button[data-voicemode]').forEach((b) =>
  b.addEventListener('click', () => setVoiceMode(b.dataset.voicemode)));

// Display options
const view = {
  detail: store.get('va.detail', '0') === '1',
  quarter: store.get('va.quarter', '0') === '1',
  pitchAware: store.get('va.pitchAware', '1') === '1', // circles follow the sung pitch (resonance tuning)
};
function bindToggle(btn, k) {
  const sync = () => btn.setAttribute('aria-pressed', String(view[k]));
  btn.addEventListener('click', () => { view[k] = !view[k]; store.set(`va.${k}`, view[k] ? '1' : '0'); sync(); });
  sync();
}
bindToggle(els.detailToggle, 'detail');
bindToggle(els.quarterToggle, 'quarter');
bindToggle(document.getElementById('pitchAwareToggle'), 'pitchAware');

// Landmarks: the singer's calibrated vowels replace the defaults
let landmarks = VOICE_PRESETS[voice].vowels, isCalibrated = false;
function refreshLandmarks() {
  const cal = calibratedLandmarks(voice);
  isCalibrated = !!cal;
  landmarks = cal || VOICE_PRESETS[voice].vowels;
  els.calBadge.hidden = !isCalibrated;
}
let calib = null;
calib = new CalibrationUI({
  getVoice: () => voice,
  voiceLabel: (v) => VOICE_PRESETS[v].label,
  ensureSession: async () => { if (!session) await start('mic'); return !!session; }, // calibration sings into the mic
  onSaved: refreshLandmarks,
});
const synth = new SynthUI({
  landmarks: () => landmarks,
  f3For: (ipa) => (VOICE_PRESETS[voice].vowels.find((v) => v.ipa === ipa) || { f3: 2700 }).f3,
  start: () => start('synth'),
  stop: () => stop(),
  isRunning: () => session?.mode === 'synth',
});
// Synthesize mode: drag on the vowel map (sets F1 + F2) or the F3 bar (sets F3)
function dragControl(canvas, toParams) {
  let active = false;
  const apply = (e) => {
    const r = canvas.getBoundingClientRect();
    synth.set(toParams(e.clientX - r.left, e.clientY - r.top, r.width, r.height));
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (session?.mode !== 'synth') return;
    active = true; try { canvas.setPointerCapture(e.pointerId); } catch { /* not all pointers capture */ } apply(e); e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => { if (active) apply(e); });
  const end = () => { active = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
dragControl(document.getElementById('mapcanvas'), (x, y, w, h) => {
  const g = mapGeometry(w, h, view.detail);
  return { f1: g.f1At(y), f2: g.f2At(x) };
});
dragControl(document.getElementById('f3canvas'), (_x, y, w, h) => ({ f3: f3Geometry(w, h).fAt(y) }));

let samplesUI = null;
loadSamples().then((list) => {
  samplesUI = new SamplesUI(list, {
    play: (smp) => start('sample', smp),
    stop: () => stop(),
    playingId: () => (session?.mode === 'sample' ? session.sample.id : null),
  });
  const dev = list.find((x) => x.id === PARAMS.get('devsample'));
  if (dev) { samplesUI.open(); start('sample', dev).then(() => samplesUI.render()); }
});
els.calReset.addEventListener('click', () => {
  try { localStorage.removeItem(`va.calib.${voice}`); } catch { /* ignore */ }
  refreshLandmarks();
});
setVoice(voice);

/* ---------------- audio session ---------------- */

async function start(mode, sample) {
  els.error.hidden = true;
  els.toast.hidden = true;
  setSourceMode(mode === 'sample' ? 'listen' : mode === 'demo' ? null : mode);
  if (session) stop(); // switching source (e.g. mic → synth)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT;
    analyser.smoothingTimeConstant = 0;
    // Every source feeds the analyzer through one tap, so the feedback recorder hears exactly the same signal
    const tap = ctx.createGain();
    tap.connect(analyser);
    const me = { ctx, analyser, tap, mode, analyzer: new Analyzer(ctx.sampleRate) };
    session = me;
    // Loading is async; if the session is stopped meanwhile (tab hidden, another source), abandon quietly.
    const cancelled = () => { if (session === me) return false; ctx.close().catch(() => {}); return true; };

    if (mode === 'sample') {
      // Listening: the original recording. Analysis: an isolated-vocal stem played in sync
      // (offline source separation), so the orchestra doesn't pollute pitch/formants.
      const load = async (url) => ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
      const playBuf = await load(pickFile(sample));
      if (cancelled()) return;
      let anaBuf = null;
      if (sample.analysisFiles) {
        try { anaBuf = await load(pickFile({ files: sample.analysisFiles })); } catch { anaBuf = null; }
        if (cancelled()) return;
      }
      const src = ctx.createBufferSource();
      src.buffer = playBuf;
      src.loop = true; // short clips loop until stopped (or the tab is hidden)
      if (!MUTE_DEMO) {
        const out = ctx.createGain();
        out.gain.setValueAtTime(0, ctx.currentTime);
        out.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.08); // fade in (no click)
        src.connect(out).connect(ctx.destination);
        me.out = out;
      }
      let ana = null;
      if (anaBuf) {
        ana = ctx.createBufferSource();
        ana.buffer = anaBuf;
        ana.loop = true;
        ana.connect(tap);
      } else {
        // Fallback: band-limit the original to the voice range before analysis
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 100;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
        src.connect(hp).connect(lp).connect(tap);
      }
      src.onended = () => { if (session?.src === src) { stop(); samplesUI?.render(); } };
      const t0 = ctx.currentTime + 0.05; // same clock tick for both → sample-aligned
      src.start(t0);
      ana?.start(t0);
      session.src = src;
      session.ana = ana;
      session.sample = sample;
      if (sample.voice && sample.voice !== voice) setVoice(sample.voice);
    } else if (mode === 'synth') {
      await ctx.audioWorklet.addModule('src/synth-worklet.js');
      if (cancelled()) return;
      const node = new AudioWorkletNode(ctx, 'formant-synth', { outputChannelCount: [1] });
      node.connect(tap);
      if (!MUTE_DEMO) {
        const out = ctx.createGain();
        out.gain.value = 0.8; // the worklet itself fades in
        node.connect(out).connect(ctx.destination);
        me.out = out;
      }
      session.synthNode = node;
    } else if (mode === 'mic') {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('insecure'), { name: 'InsecureContext' });
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      if (cancelled()) { stream.getTracks().forEach((t) => t.stop()); return; }
      session.stream = stream;
      ctx.createMediaStreamSource(stream).connect(tap);
    } else {
      startDemoSource();
    }
    await ctx.resume().catch(() => {});
    els.landing.hidden = true;
    // Live dot on the active source button (replaces the old status chip)
    document.body.dataset.live = mode === 'mic' ? 'mic' : mode === 'synth' ? 'synth' : mode === 'sample' ? 'listen' : '';
    if (mode === 'synth') synth.attach(session.synthNode);
    document.body.classList.toggle('synth-on', mode === 'synth'); // shows the inline synth controls
    resetHistory();
  } catch (err) {
    stop();
    showError(err);
  }
}

function startDemoSource(only = PARAMS.get('devtest') || undefined) {
  const { ctx, tap } = session;
  if (session.src) { try { session.src.stop(); } catch { /* already stopped */ } }
  const demo = renderDemo(ctx.sampleRate, voice, { only });
  const buf = ctx.createBuffer(1, demo.samples.length, ctx.sampleRate);
  buf.copyToChannel(demo.samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = false; // plays the phrase once, then the session ends
  src.connect(tap);
  if (!MUTE_DEMO) {
    const out = ctx.createGain();
    out.gain.value = 0.5;
    src.connect(out).connect(ctx.destination);
  }
  src.onended = () => { if (session?.src === src) stop(); };
  src.start();
  session.src = src;
  session.demo = { samples: demo.samples, t0: ctx.currentTime, wall0: performance.now() };
}

function stop() { // never returns to the landing page
  if (feedback?.recording) feedback.stop();
  const wasSynth = session?.mode === 'synth';
  if (session) {
    session.stream?.getTracks().forEach((t) => t.stop());
    // Fade audible output out over ~60 ms before closing, so stopping doesn't click
    const { ctx, out, src, ana, stream } = session;
    stream?.getTracks().forEach((t) => t.stop());
    if (out && ctx.state === 'running') {
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
      out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.06);
      setTimeout(() => { try { src?.stop(); ana?.stop(); } catch { /* noop */ } ctx.close().catch(() => {}); }, 90);
    } else {
      try { src?.stop(); } catch { /* noop */ }
      try { ana?.stop(); } catch { /* noop */ }
      ctx.close().catch(() => {});
    }
  }
  session = null;
  delete document.body.dataset.live;
  if (wasSynth) synth.detach();
  document.body.classList.remove('synth-on');
}

function showError(err) {
  const name = err?.name || '';
  let msg = 'Could not start audio: ' + (err?.message || name || 'unknown error');
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    msg = 'Microphone permission was blocked. Allow microphone access for this site (click the lock/site icon in the address bar), then try again.';
  } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    msg = 'No microphone was found. Plug one in or check your system sound settings, then try again.';
  } else if (name === 'NotReadableError') {
    msg = 'The microphone is in use by another app. Close it and try again.';
  } else if (name === 'InsecureContext') {
    msg = 'Microphone access needs a secure page (https:// or http://localhost).';
  }
  if (!els.landing.hidden) { els.error.textContent = msg; els.error.hidden = false; return; }
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(showError.t);
  showError.t = setTimeout(() => { els.toast.hidden = true; }, 7000);
}

/* ---------------- source switch: Sing / Synthesize / Listen ---------------- */
let sourceMode = null;
function setSourceMode(m) {
  sourceMode = m;
  document.querySelectorAll('button[data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === m)));
}
const DEFAULT_SAMPLE = { low: 'tenor', high: 'soprano' };
async function chooseSource(m) {
  els.landing.hidden = true; // leaving the landing page is one-way
  setSourceMode(m);
  if (m === 'mic') {
    if (!document.getElementById('synthPanel').hidden) synth.close();
    if (samplesUI && !document.getElementById('samplesPanel').hidden) samplesUI.close();
    await start('mic');
  } else if (m === 'synth') {
    if (samplesUI && !document.getElementById('samplesPanel').hidden) samplesUI.close();
    setSourceMode('synth');
    synth.open();
  } else if (m === 'listen') {
    if (!document.getElementById('synthPanel').hidden) synth.close();
    if (!samplesUI) return;
    setSourceMode('listen');
    samplesUI.open();
    // Start hearing something right away: the clip for the current voice type
    if (session?.mode !== 'sample') {
      const smp = samplesUI.samples.find((x) => x.id === DEFAULT_SAMPLE[voice]) || samplesUI.samples[0];
      if (smp) { await start('sample', smp); samplesUI.render(); }
    }
  }
}
document.querySelectorAll('button[data-mode]').forEach((b) => b.addEventListener('click', () => chooseSource(b.dataset.mode)));

/* ---------------- feedback recorder ---------------- */
let feedback = null;
feedback = new FeedbackRecorder({
  getSession: () => session,
  describe: () => ({
    mode: session?.mode === 'mic' ? 'Sing' : session?.mode === 'synth' ? 'Synthesize'
      : session?.mode === 'sample' ? `Listen (${session.sample.id})` : session?.mode === 'demo' ? 'Dev melody' : 'idle',
    voice, view: { ...view }, calibrated: isCalibrated, landmarks,
    synth: session?.mode === 'synth' ? { ...synth.state } : undefined,
  }),
  toast: (msg) => { els.toast.textContent = msg; els.toast.hidden = false; setTimeout(() => { els.toast.hidden = true; }, 5000); },
});
// Closing a source panel stops its sound but stays on the dashboard
document.getElementById('synthClose').addEventListener('click', () => setSourceMode(null));
document.getElementById('samplesClose').addEventListener('click', () => setSourceMode(null));

// Exit: stop everything and go back to the start page
els.exitBtn.addEventListener('click', () => {
  if (feedback?.recording) feedback.stop();
  if (!document.getElementById('synthPanel').hidden) synth.close();
  if (samplesUI && !document.getElementById('samplesPanel').hidden) samplesUI.close();
  if (!document.getElementById('calPanel').hidden) calib.close();
  stop();
  setSourceMode(null);
  closeSettings();
  els.landing.hidden = false;
});

// Settings menu: voice range, quarter tones, follow pitch, calibrate, help
function closeSettings() { els.settingsMenu.hidden = true; els.settingsBtn.setAttribute('aria-expanded', 'false'); }
els.settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = els.settingsMenu.hidden;
  els.settingsMenu.hidden = !open;
  els.settingsBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    updateVoiceUI();
    // Phones: the menu is a fixed full-width sheet; place it just under the gear button
    els.settingsMenu.style.top = matchMedia('(max-width: 760px)').matches ? `${els.settingsBtn.getBoundingClientRect().bottom + 8}px` : '';
  }
});
document.addEventListener('click', (e) => { if (!els.settingsMenu.hidden && !e.target.closest('.settings-wrap')) closeSettings(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSettings(); });
for (const id of ['calibToggle', 'helpBtn']) document.getElementById(id).addEventListener('click', closeSettings);

// Collapsible panels (remembered). The grid is rebuilt so the open panels share the space.
let collapsed = {};
try { collapsed = JSON.parse(store.get('va.collapsed', '{}')) || {}; } catch { collapsed = {}; }
function applyLayout() {
  const dash = document.getElementById('dashboard');
  const c = (k) => !!collapsed[k];
  document.querySelectorAll('#dashboard .panel[data-panel]').forEach((p) => {
    const on = c(p.dataset.panel);
    p.classList.toggle('collapsed', on);
    const btn = p.querySelector('.collapse-btn');
    btn.setAttribute('aria-expanded', String(!on));
    btn.title = on ? 'Show panel' : 'Hide panel';
    btn.setAttribute('aria-label', btn.title);
  });
  const mobile = matchMedia('(max-width: 760px)').matches;
  const H = '38px', grow = 'minmax(0, 1fr)';
  const rows = [], areas = [];
  const add = (r, a) => { rows.push(r); areas.push(a); };
  add(c('pitch') ? H : mobile ? 'auto' : grow, '"tuner tuner"');
  const mid = mobile ? '400px' : grow;
  if (c('f3') && c('vowel')) add(H, '"f3 map"');
  else if (c('f3')) { add(H, '"f3 f3"'); add(mid, '"map map"'); }
  else if (c('vowel')) { add(H, '"map map"'); add(mid, '"f3 f3"'); }
  else add(mid, '"f3 map"');
  add(c('input') ? H : mobile ? '150px' : grow, '"meter meter"');
  dash.style.gridTemplateRows = rows.join(' ');
  dash.style.gridTemplateAreas = areas.join(' ');
}
document.querySelectorAll('#dashboard .panel[data-panel] .collapse-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const k = btn.closest('.panel').dataset.panel;
    collapsed[k] = !collapsed[k];
    store.set('va.collapsed', JSON.stringify(collapsed));
    applyLayout();
  });
});
matchMedia('(max-width: 760px)').addEventListener('change', applyLayout);
applyLayout();

/* ---------------- analysis + render loop ---------------- */
const timeBuf = new Float32Array(FFT);
const specBuf = new Float32Array(FFT / 2);
let autoHist = [], lastAutoCheck = 0, pitchHist = [], vibHist = [], formantTrail = [], f3Trail = [], levelHist = [], lastPair = null;
const BASE_SPAN = 5, MAX_SPAN = 13; // semitones visible in the pitch trace (max ≈ an octave + margin)
const ZOOM_HOLD = 10; // s to keep a zoomed-out view after it was last needed
let lastVib = null; // last confident vibrato reading (bridges brief dropouts)
// Vibrato box has its own hide/show inside the pitch panel (remembered)
let vibHidden = store.get('va.vibHidden', '0') === '1';
function applyVibHidden() {
  const wrap = document.getElementById('vibWrap'), btn = document.getElementById('vibToggle');
  wrap.classList.toggle('off', vibHidden);
  btn.textContent = vibHidden ? 'VIBRATO' : '×';
  btn.title = vibHidden ? 'Show vibrato' : 'Hide vibrato';
  btn.setAttribute('aria-label', btn.title);
  btn.setAttribute('aria-pressed', String(!vibHidden));
}
document.getElementById('vibToggle').addEventListener('click', () => {
  vibHidden = !vibHidden;
  store.set('va.vibHidden', vibHidden ? '1' : '0');
  applyVibHidden();
});
applyVibHidden();
let heldSpan = BASE_SPAN, lastWideT = -100, viewSpan = BASE_SPAN, lastDistortT = -10, lastFrameT = 0, viewCenter = 60, peakHold = -100, peakHoldT = 0, clipT = -10;
function resetHistory() { pitchHist = []; vibHist = []; formantTrail = []; f3Trail = []; levelHist = []; lastPair = null; }

function readFrame(now) {
  const { analyser, ctx, demo } = session;
  // Fallback for a suspended context (e.g. autoplay policy): feed the demo buffer directly.
  if (demo && ctx.state !== 'running') {
    const t = ((performance.now() - demo.wall0) / 1000) * ctx.sampleRate;
    const end = FFT + (Math.floor(t) % (demo.samples.length - FFT));
    timeBuf.set(demo.samples.subarray(end - FFT, end));
    return null;
  }
  analyser.getFloatTimeDomainData(timeBuf);
  analyser.getFloatFrequencyData(specBuf);
  return specBuf;
}

const prune = (arr, now, keep) => { while (arr.length && now - arr[0].t > keep) arr.shift(); };

function frame() {
  requestAnimationFrame(frame);
  render();
}
window.__vaRender = () => render(); // dev hook: step one frame while the page is throttled/hidden
function render() {
  window.__vaFrames = (window.__vaFrames || 0) + 1;
  const now = performance.now() / 1000;
  let o = null;
  if (session) {
    const spec = readFrame(now);
    o = session.analyzer.process(timeBuf, spec, now);
    window.__va = { o, ctxState: session.ctx.state, demo: (v) => startDemoSource(v) };
  }

  // ---- Tuner ----
  let state = null, cents = null, rawCents = null;
  if (o?.tracking) {
    const nearest = nearestStep(o.midiMean, view.quarter);
    cents = (o.midiMean - nearest) * 100;
    state = tuningState(cents, view.quarter);
    rawCents = o.voiced ? (o.midiRaw - nearest) * 100 : null;
    els.noteName.textContent = stepName(nearest);
    els.noteOct.textContent = stepOctave(nearest);
    els.noteBox.className = 'note ' + state;
    els.tuneState.textContent = state === 'in' ? 'in tune'
      : state === 'near' ? (cents > 0 ? 'a little sharp' : 'a little flat')
      : 'between notes';
    // Auto-zoom, tuned for comfort: zoom OUT promptly when the pitch has spread over a wide range in the last
    // 3 s; HOLD that zoom until it hasn't been needed for ZOOM_HOLD s (even after those notes scroll off);
    // zoom back IN slowly. While zoomed out the view doesn't pan unless the pitch nears an edge.
    const dt = Math.min(0.5, now - (lastFrameT || now));
    const recent = pitchHist.filter((p) => now - p.t < 3).map((p) => p.midi).sort((a, b) => a - b);
    let needSpan = BASE_SPAN, needCenter = nearest;
    if (recent.length > 10) {
      const lo = recent[Math.floor(recent.length * 0.05)], hi = recent[Math.floor(recent.length * 0.95)];
      if (hi - lo > BASE_SPAN - 2) { needSpan = Math.min(MAX_SPAN, hi - lo + 3); needCenter = (lo + hi) / 2; }
    }
    if (needSpan >= heldSpan - 1 && needSpan > BASE_SPAN) { heldSpan = Math.max(heldSpan, needSpan); lastWideT = now; }
    if (now - lastWideT > ZOOM_HOLD) heldSpan = BASE_SPAN; // wide view unused for a while: release
    const zoomingIn = heldSpan < viewSpan;
    viewSpan += (heldSpan - viewSpan) * (1 - Math.exp(-dt / (zoomingIn ? 2.0 : 0.5)));
    // Vertical framing, same rule at every zoom level (motion-sickness friendly): stay still while the
    // pitch is inside the middle of the view; ease when it nears the top/bottom 25%; jump once (no
    // glide) if it leaves the view entirely.
    const target = needSpan > BASE_SPAN ? needCenter : nearest;
    const half = viewSpan / 2;
    const off = o.midiMean - viewCenter;
    if (Math.abs(off) > half) viewCenter = target;
    else if (Math.abs(off) > half * 0.5) viewCenter += (target - viewCenter) * (1 - Math.exp(-dt / 0.8));
    window.__vaZoom = { viewSpan, heldSpan, sinceWide: now - lastWideT }; // dev/QA readout
    els.detailReadout.textContent = `${cents >= 0 ? '+' : '−'}${Math.abs(cents).toFixed(0)}¢ · ${o.f0 ? o.f0.toFixed(1) + ' Hz' : ''}`;
  } else {
    els.detailReadout.textContent = '';
    els.noteName.textContent = '–';
    els.noteOct.textContent = '';
    els.noteBox.className = 'note';
    els.tuneState.textContent = !session ? '' : session.mode === 'mic' ? 'sing a note' : 'waiting for a voice';
  }
  lastFrameT = now;
  if (o?.voiced) pitchHist.push({ t: now, midi: o.midiRaw, mean: o.midiMean, state });
  // Auto voice range: typical (median) sung pitch over the last 20 s of singing, with hysteresis.
  // Low voices (tenor/baritone/bass) rarely centre above E4; high voices (alto-soprano) rarely below F#4.
  if (voiceMode === 'auto' && session?.mode === 'mic' && o?.tracking) {
    autoHist.push({ t: now, m: o.midiMean });
    while (autoHist.length && now - autoHist[0].t > 20) autoHist.shift();
    if (autoHist.length > 90 && now - lastAutoCheck > 0.5) {
      lastAutoCheck = now;
      const ms = autoHist.map((p) => p.m).sort((a, b) => a - b);
      const med = ms[ms.length >> 1];
      autoNote = `${stepName(Math.round(med))}${stepOctave(Math.round(med))}`;
      const target = med < 63.5 ? 'low' : med > 65.5 ? 'high' : voice;
      if (target !== voice) setVoice(target); else updateVoiceUI();
    }
  }
  prune(pitchHist, now, 5);
  els.detailReadout.hidden = !view.detail;
  drawGauge(surf.gauge, cents, rawCents, state, view);
  drawTrace(surf.trace, pitchHist, now, viewCenter, { ...view, span: viewSpan });
  // Vibrato: rate + extent of the held note, against published reference bands
  if (o?.voiced && o.midiFast) vibHist.push({ t: now, midi: o.midiFast });
  prune(vibHist, now, 1.5);
  const vib = session ? analyzeVibrato(vibHist, now, 2048 / session.ctx.sampleRate) : null; // 2048-sample pitch window
  if (vib?.present) lastVib = { ...vib, t: now };
  const vibShown = vib && !vib.present && lastVib && now - lastVib.t < 0.4 ? lastVib : vib; // ride over brief dropouts
  if (!vibHidden) drawVibrato(surf.vib, vibShown, { detail: view.detail, rateBand: RATE_BAND, rateBest: RATE_BEST, extentBand: EXTENT_BAND });

  // ---- Formants ----
  const cur = o?.f1 && o?.f2 ? { f1: o.f1, f2: o.f2 } : null;
  // Pitch-aware landmarks: move circles the way trained singers tune resonances at this pitch
  const sungF0 = o?.tracking ? midiToFreq(o.midiMean) : 0;
  const shown = view.pitchAware && sungF0 ? pitchAdjustedLandmarks(landmarks, sungF0, voice) : landmarks;
  if (cur && o.voiced) formantTrail.push({ t: now, ...cur });
  if (o?.f3 && o.voiced) f3Trail.push({ t: now, f3: o.f3 });
  prune(formantTrail, now, 1.6);
  prune(f3Trail, now, 1.3);
  if (o?.distorted) lastDistortT = now;
  const tooLoud = now - lastDistortT < 0.6;
  const highPitch = !!(o?.f0 && o.f0 > 400); // F0 above close-vowel F1: i/u read as more open
  const uncertain = tooLoud || highPitch;
  els.mapHint.textContent = tooLoud
    ? 'Too loud — input is clipping, vowel reading paused. Lower mic level or step back.'
    : 'High pitch: closed vowels (i, u, e, o) read as more open';
  els.mapHint.hidden = !(cur && uncertain);
  const synthOn = session?.mode === 'synth';
  drawVowelMap(surf.map, shown, cur, formantTrail, now, {
    uncertain, detail: view.detail, calibrated: isCalibrated, f0: sungF0,
    target: synthOn ? { f1: synth.state.f1, f2: synth.state.f2 } : null,
    extras: view.detail ? extraVowels(voice) : [],
  });
  if (cur && o.voiced) lastPair = roundingPair(cur.f1, cur.f2, shown) || lastPair;
  drawF3(surf.f3, o?.f3 || 0, f3Trail, o?.ring || 0, now, { ...view, pair: lastPair, target: synthOn ? synth.state.f3 : 0, cluster: o?.cluster });
  calib.tick(o, now);

  // ---- Level ----
  const rms = o ? o.rmsDb : -100;
  if (o && o.peakDb > peakHold) { peakHold = o.peakDb; peakHoldT = now; }
  else if (now - peakHoldT > 1) peakHold -= 0.6;
  if (o?.clipped) clipT = now;
  const clipping = now - clipT < 2; // CLIP appears only when the input actually clipped recently
  els.clip.hidden = !clipping;
  els.clip.classList.toggle('on', clipping);
  if (o) levelHist.push({ t: now, db: o.rmsDb, clip: o.clipped });
  prune(levelHist, now, 8.5);
  drawMeter(surf.meter, rms, peakHold, view, levelHist, now);
  feedback?.onFrame(o, now);
}
requestAnimationFrame(frame);

// Never leave the demo voice playing in a background tab.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && session && session.mode !== 'mic') { stop(); samplesUI?.render(); }
});

// Autostart from URL (see MUTE_DEMO above).
if (PARAMS.has('devtest')) start('demo');
else if (PARAMS.has('devsynth')) synth.open();

/* ---------------- help ---------------- */
const help = document.getElementById('helpDialog');
const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
document.getElementById('helpSources').innerHTML = SOURCES.map((src) =>
  `<li>${src.url ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.cite)}</a>` : esc(src.cite)}` +
  `<span class="use">${esc(src.use)}</span></li>`).join('');
loadSamples().then((list) => {
  if (!list.length) return;
  document.getElementById('helpSources').insertAdjacentHTML('beforeend', list.map((smp) =>
    `<li><a href="${esc(smp.source)}" target="_blank" rel="noopener">${esc(smp.credit)}</a>` +
    `<span class="use">Sample (${esc(smp.part)}) · ${esc(smp.license)} · ${esc(smp.excerpt || 'excerpt')}</span></li>`).join(''));
});
document.getElementById('helpBtn').addEventListener('click', () => help.showModal());
document.getElementById('helpClose').addEventListener('click', () => help.close());
help.addEventListener('click', (e) => { if (e.target === help) help.close(); });
