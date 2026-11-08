import { Analyzer } from './dsp/analyzer.js';
import { tuningState, nearestStep, stepName, stepOctave } from './dsp/pitch.js';
import { renderDemo } from './demo.js';
import { VOICE_PRESETS, extraVowels, roundingPair, SOURCES } from './vowels.js';
import { CalibrationUI, calibratedLandmarks } from './calibration.js';
import { SynthUI } from './synth.js';
import { SamplesUI, loadSamples, pickFile } from './sampleplayer.js';
import { Surface, drawGauge, drawTrace, drawF3, drawVowelMap, drawMeter } from './ui/panels.js';

const FFT = 4096;
const PARAMS = new URLSearchParams(location.search);
// Dev only: ?devtest autostarts the synthetic melody silently for visual QA
// (?devtest=a sustains one vowel, for calibration QA).
const MUTE_DEMO = PARAMS.has('devtest') || PARAMS.has('devsynth'); // dev URLs are silent
const $ = (id) => document.getElementById(id);
const els = {
  landing: $('landing'), startBtn: $('startBtn'), error: $('errorMsg'),
  stopBtn: $('stopBtn'), chip: $('sourceChip'),
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
};

let session = null; // { ctx, analyser, mode, analyzer, stream?, src?, demo? }

/* ---------------- settings ---------------- */
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
let voice = store.get('va.voice', 'low');
if (!VOICE_PRESETS[voice]) voice = 'low';
function setVoice(v) {
  voice = v;
  store.set('va.voice', v);
  document.querySelectorAll('.segmented button').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.voice === v)));
  if (session?.mode === 'demo') startDemoSource();
  refreshLandmarks();
  calib?.voiceChanged();
}
document.querySelectorAll('.segmented button').forEach((b) =>
  b.addEventListener('click', () => setVoice(b.dataset.voice)));

// Display options
const view = { detail: store.get('va.detail', '0') === '1', quarter: store.get('va.quarter', '0') === '1' };
function bindToggle(btn, k) {
  const sync = () => btn.setAttribute('aria-pressed', String(view[k]));
  btn.addEventListener('click', () => { view[k] = !view[k]; store.set(`va.${k}`, view[k] ? '1' : '0'); sync(); });
  sync();
}
bindToggle(els.detailToggle, 'detail');
bindToggle(els.quarterToggle, 'quarter');

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
  ensureSession: async () => { if (!session) await start('mic'); return !!session; },
  onSaved: refreshLandmarks,
});
const synth = new SynthUI({
  landmarks: () => landmarks,
  f3For: (ipa) => (VOICE_PRESETS[voice].vowels.find((v) => v.ipa === ipa) || { f3: 2700 }).f3,
  start: () => start('synth'),
  stop: (toLanding) => stop(!toLanding),
  isRunning: () => session?.mode === 'synth',
});
let samplesUI = null;
loadSamples().then((list) => {
  samplesUI = new SamplesUI(list, {
    play: (smp) => start('sample', smp),
    stop: () => stop(true),
    playingId: () => (session?.mode === 'sample' ? session.sample.id : null),
  });
  document.getElementById('samplesBtn').addEventListener('click', () => { els.landing.hidden = true; samplesUI.open(); });
});
els.calReset.addEventListener('click', () => {
  try { localStorage.removeItem(`va.calib.${voice}`); } catch { /* ignore */ }
  refreshLandmarks();
});
setVoice(voice);

/* ---------------- audio session ---------------- */

async function start(mode, sample) {
  els.error.hidden = true;
  if (session) stop(true); // switching source (e.g. mic → synth)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT;
    analyser.smoothingTimeConstant = 0;
    session = { ctx, analyser, mode, analyzer: new Analyzer(ctx.sampleRate) };

    if (mode === 'sample') {
      const res = await fetch(pickFile(sample));
      if (!res.ok) throw new Error(`could not load ${sample.part} sample`);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(analyser);
      const out = ctx.createGain();
      out.gain.value = 0.9;
      src.connect(out).connect(ctx.destination);
      src.onended = () => { if (session?.src === src) { stop(true); samplesUI?.render(); } };
      src.start();
      session.src = src;
      session.sample = sample;
      if (sample.voice && sample.voice !== voice) setVoice(sample.voice);
    } else if (mode === 'synth') {
      await ctx.audioWorklet.addModule('src/synth-worklet.js');
      const node = new AudioWorkletNode(ctx, 'formant-synth', { outputChannelCount: [1] });
      node.connect(analyser);
      if (!MUTE_DEMO) {
        const out = ctx.createGain();
        out.gain.value = 0.8;
        node.connect(out).connect(ctx.destination);
      }
      session.synthNode = node;
    } else if (mode === 'mic') {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('insecure'), { name: 'InsecureContext' });
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      session.stream = stream;
      ctx.createMediaStreamSource(stream).connect(analyser);
    } else {
      startDemoSource();
    }
    await ctx.resume().catch(() => {});
    els.landing.hidden = true;
    els.stopBtn.hidden = false;
    els.chip.hidden = false;
    els.chip.textContent = mode === 'mic' ? 'Listening' : mode === 'synth' ? 'Synthesizing'
      : mode === 'sample' ? `Playing · ${sample.part}` : 'Dev synth';
    els.chip.classList.toggle('synth', mode === 'synth');
    if (mode === 'synth') synth.attach(session.synthNode);
    resetHistory();
  } catch (err) {
    stop(true);
    showError(err);
  }
}

function startDemoSource(only = PARAMS.get('devtest') || undefined) {
  const { ctx, analyser } = session;
  if (session.src) { try { session.src.stop(); } catch { /* already stopped */ } }
  const demo = renderDemo(ctx.sampleRate, voice, { only });
  const buf = ctx.createBuffer(1, demo.samples.length, ctx.sampleRate);
  buf.copyToChannel(demo.samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = false; // plays the phrase once, then the session ends
  src.connect(analyser);
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

function stop(silent) {
  const wasSynth = session?.mode === 'synth';
  if (session) {
    session.stream?.getTracks().forEach((t) => t.stop());
    try { session.src?.stop(); } catch { /* noop */ }
    session.ctx.close().catch(() => {});
  }
  session = null;
  if (!silent) els.landing.hidden = false;
  els.stopBtn.hidden = true;
  els.chip.hidden = true;
  if (wasSynth) synth.detach();
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
  els.error.textContent = msg;
  els.error.hidden = false;
}

els.startBtn.addEventListener('click', () => start('mic'));
document.getElementById('synthBtn').addEventListener('click', () => synth.open());
els.stopBtn.addEventListener('click', () => stop());

/* ---------------- analysis + render loop ---------------- */
const timeBuf = new Float32Array(FFT);
const specBuf = new Float32Array(FFT / 2);
let pitchHist = [], formantTrail = [], f3Trail = [], levelHist = [], lastPair = null;
let lastFrameT = 0, viewCenter = 60, peakHold = -100, peakHoldT = 0, clipT = -10;
function resetHistory() { pitchHist = []; formantTrail = []; f3Trail = []; levelHist = []; lastPair = null; }

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
    // Time-based easing (frame-rate independent); snap on big leaps
    const dt = Math.min(0.5, now - (lastFrameT || now));
    if (Math.abs(nearest - viewCenter) > 3) viewCenter = nearest;
    else viewCenter += (nearest - viewCenter) * (1 - Math.exp(-dt / 0.08));
    els.detailReadout.textContent = `${cents >= 0 ? '+' : '−'}${Math.abs(cents).toFixed(0)}¢ · ${o.f0 ? o.f0.toFixed(1) + ' Hz' : ''}`;
  } else {
    els.detailReadout.textContent = '';
    els.noteName.textContent = '–';
    els.noteOct.textContent = '';
    els.noteBox.className = 'note';
    els.tuneState.textContent = session ? 'sing a note' : '';
  }
  lastFrameT = now;
  if (o?.voiced) pitchHist.push({ t: now, midi: o.midiRaw, mean: o.midiMean, state });
  prune(pitchHist, now, 5);
  els.detailReadout.hidden = !view.detail;
  drawGauge(surf.gauge, cents, rawCents, state, view);
  drawTrace(surf.trace, pitchHist, now, viewCenter, view);

  // ---- Formants ----
  const cur = o?.f1 && o?.f2 ? { f1: o.f1, f2: o.f2 } : null;
  if (cur && o.voiced) formantTrail.push({ t: now, ...cur });
  if (o?.f3 && o.voiced) f3Trail.push({ t: now, f3: o.f3 });
  prune(formantTrail, now, 1.6);
  prune(f3Trail, now, 1.3);
  const uncertain = !!(o?.f0 && o.f0 > 400); // F0 above close-vowel F1: i/u read as more open
  els.mapHint.hidden = !(cur && uncertain);
  drawVowelMap(surf.map, landmarks, cur, formantTrail, now, {
    uncertain, detail: view.detail, calibrated: isCalibrated,
    extras: view.detail ? extraVowels(voice) : [],
  });
  if (cur && o.voiced) lastPair = roundingPair(cur.f1, cur.f2, landmarks) || lastPair;
  drawF3(surf.f3, o?.f3 || 0, f3Trail, o?.ring || 0, now, { ...view, pair: lastPair });
  calib.tick(o, now);

  // ---- Level ----
  const rms = o ? o.rmsDb : -100;
  if (o && o.peakDb > peakHold) { peakHold = o.peakDb; peakHoldT = now; }
  else if (now - peakHoldT > 1) peakHold -= 0.6;
  if (o?.clipped) clipT = now;
  els.clip.classList.toggle('on', now - clipT < 1.5);
  if (o) levelHist.push({ t: now, db: o.rmsDb, clip: o.clipped });
  prune(levelHist, now, 8.5);
  drawMeter(surf.meter, rms, peakHold, view, levelHist, now);
}
requestAnimationFrame(frame);

// Never leave the demo voice playing in a background tab.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && session && session.mode !== 'mic') { stop(true); samplesUI?.render(); }
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
