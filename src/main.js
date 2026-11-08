import { Analyzer } from './dsp/analyzer.js';
import { noteName, noteOctave, tuningState } from './dsp/pitch.js';
import { renderDemo } from './demo.js';
import { VOICE_PRESETS } from './vowels.js';
import { Surface, drawGauge, drawTrace, drawF3, drawVowelMap, drawMeter } from './ui/panels.js';

const FFT = 4096;
const $ = (id) => document.getElementById(id);
const els = {
  landing: $('landing'), startBtn: $('startBtn'), demoBtn: $('demoBtn'), error: $('errorMsg'),
  stopBtn: $('stopBtn'), chip: $('sourceChip'),
  noteBox: $('noteBox'), noteName: $('noteName'), noteOct: $('noteOct'), tuneState: $('tuneState'),
  mapHint: $('mapHint'), clip: $('clipLamp'),
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
}
document.querySelectorAll('.segmented button').forEach((b) =>
  b.addEventListener('click', () => setVoice(b.dataset.voice)));
setVoice(voice);

/* ---------------- audio session ---------------- */

async function start(mode) {
  els.error.hidden = true;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT;
    analyser.smoothingTimeConstant = 0;
    session = { ctx, analyser, mode, analyzer: new Analyzer(ctx.sampleRate) };

    if (mode === 'mic') {
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
    els.chip.textContent = mode === 'mic' ? 'Listening' : 'Demo voice';
    resetHistory();
  } catch (err) {
    stop(true);
    showError(err);
  }
}

function startDemoSource() {
  const { ctx, analyser } = session;
  if (session.src) { try { session.src.stop(); } catch { /* already stopped */ } }
  const demo = renderDemo(ctx.sampleRate, voice);
  const buf = ctx.createBuffer(1, demo.samples.length, ctx.sampleRate);
  buf.copyToChannel(demo.samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const out = ctx.createGain();
  out.gain.value = 0.5;
  src.connect(analyser);
  src.connect(out).connect(ctx.destination);
  src.start();
  session.src = src;
  session.demo = { samples: demo.samples, t0: ctx.currentTime, wall0: performance.now() };
}

function stop(silent) {
  if (session) {
    session.stream?.getTracks().forEach((t) => t.stop());
    try { session.src?.stop(); } catch { /* noop */ }
    session.ctx.close().catch(() => {});
  }
  session = null;
  if (!silent) els.landing.hidden = false;
  els.stopBtn.hidden = true;
  els.chip.hidden = true;
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
els.demoBtn.addEventListener('click', () => start('demo'));
els.stopBtn.addEventListener('click', () => stop());

/* ---------------- analysis + render loop ---------------- */
const timeBuf = new Float32Array(FFT);
const specBuf = new Float32Array(FFT / 2);
let pitchHist = [], formantTrail = [], f3Trail = [];
let viewCenter = 60, peakHold = -100, peakHoldT = 0, clipT = -10;
function resetHistory() { pitchHist = []; formantTrail = []; f3Trail = []; }

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
  const now = performance.now() / 1000;
  let o = null;
  if (session) {
    const spec = readFrame(now);
    o = session.analyzer.process(timeBuf, spec, now);
    window.__va = { o, ctxState: session.ctx.state };
  }

  // ---- Tuner ----
  let state = null, cents = null, rawCents = null;
  if (o?.tracking) {
    const nearest = Math.round(o.midiMean);
    cents = (o.midiMean - nearest) * 100;
    state = tuningState(cents);
    rawCents = o.voiced ? (o.midiRaw - nearest) * 100 : null;
    els.noteName.textContent = noteName(nearest);
    els.noteOct.textContent = noteOctave(nearest);
    els.noteBox.className = 'note ' + state;
    els.tuneState.textContent = state === 'in' ? 'in tune'
      : state === 'near' ? (cents > 0 ? 'a little sharp' : 'a little flat')
      : 'between notes';
    viewCenter += (nearest - viewCenter) * 0.15;
  } else {
    els.noteName.textContent = '–';
    els.noteOct.textContent = '';
    els.noteBox.className = 'note';
    els.tuneState.textContent = session ? 'sing a note' : '';
  }
  if (o?.voiced) pitchHist.push({ t: now, midi: o.midiRaw, mean: o.midiMean, state });
  prune(pitchHist, now, 5);
  drawGauge(surf.gauge, cents, rawCents, state);
  drawTrace(surf.trace, pitchHist, now, viewCenter);

  // ---- Formants ----
  const cur = o?.f1 && o?.f2 ? { f1: o.f1, f2: o.f2 } : null;
  if (cur && o.voiced) formantTrail.push({ t: now, ...cur });
  if (o?.f3 && o.voiced) f3Trail.push({ t: now, f3: o.f3 });
  prune(formantTrail, now, 1.6);
  prune(f3Trail, now, 1.3);
  const uncertain = !!(o?.f0 && o.f0 > 520);
  els.mapHint.hidden = !(cur && uncertain);
  drawVowelMap(surf.map, VOICE_PRESETS[voice].vowels, cur, formantTrail, now, { uncertain });
  drawF3(surf.f3, o?.f3 || 0, f3Trail, o?.ring || 0, now);

  // ---- Level ----
  const rms = o ? o.rmsDb : -100;
  if (o && o.peakDb > peakHold) { peakHold = o.peakDb; peakHoldT = now; }
  else if (now - peakHoldT > 1) peakHold -= 0.6;
  if (o?.clipped) clipT = now;
  els.clip.classList.toggle('on', now - clipT < 1.5);
  drawMeter(surf.meter, rms, peakHold);
}
requestAnimationFrame(frame);

// Dev hook: ?demo autostarts the demo voice (useful for visual QA).
if (new URLSearchParams(location.search).has('demo')) start('demo');
