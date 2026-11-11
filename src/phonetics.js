// Rough pronunciation of a sung syllable for the formant voice: its consonants (IPA-like symbols) and a
// plain vowel (a e i o u ɛ ɔ). Spelling rules per language; good enough to follow the words.

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, ''); // remove accents / tone marks
const LATIN_V = 'aeiouyàáâäèéêëìíîïòóôöùúûüœæ';
const CYR_V = 'аеёиоуыэюя';

const CYR_C = { б: 'b', в: 'v', г: 'g', д: 'd', ж: 'ʒ', з: 'z', й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', п: 'p', р: 'r', с: 's', т: 't', ф: 'f', х: 'h', ц: 'ts', ч: 'tʃ', ш: 'ʃ', щ: 'ʃ' };

/** Consonant letters → sounds, longest spelling first. `next` is the following letter (for c/g softening). */
function consonants(cl, lang, next) {
  if (lang === 'ru') return [...cl].map((c) => CYR_C[c]).filter(Boolean);
  const out = [];
  let i = 0;
  const soft = (k) => /[eiéèêëìíîïy]/.test(cl[k + 1] ?? next ?? '');
  while (i < cl.length) {
    const r = cl.slice(i);
    const take = (n, ...ph) => { out.push(...ph); i += n; };
    if (lang === 'zh') { // pinyin initials
      if (r.startsWith('zh') || r.startsWith('ch')) take(2, 'tʃ');
      else if (r.startsWith('sh')) take(2, 'ʃ');
      else if (/^[jq]/.test(r)) take(1, 'tʃ');
      else if (r[0] === 'x') take(1, 'ʃ');
      else if (/^[zc]/.test(r)) take(1, 'ts');
      else if (r[0] === 'r') take(1, 'ʒ');
      else if (/^[wy]/.test(r)) take(1, 'j');
      else take(1, r[0]);
      continue;
    }
    if (r.startsWith('tsch')) take(4, 'tʃ');
    else if (r.startsWith('sch')) take(3, lang === 'it' ? 's' : 'ʃ', ...(lang === 'it' ? ['k'] : []));
    else if (r.startsWith('ch')) take(2, lang === 'it' ? 'k' : lang === 'fr' ? 'ʃ' : lang === 'de' ? 'h' : 'tʃ');
    else if (r.startsWith('sh')) take(2, 'ʃ');
    else if (r.startsWith('th')) take(2, lang === 'en' ? 'θ' : 't');
    else if (r.startsWith('gh') && lang === 'en') i += 2; // night, though: silent
    else if (r.startsWith('ph')) take(2, 'f');
    else if (r.startsWith('gn')) take(2, 'n');
    else if (r.startsWith('gl') && lang === 'it') take(2, 'l');
    else if (r.startsWith('qu')) take(2, 'k');
    else if (r.startsWith('ck')) take(2, 'k');
    else if (r[0] === 'c') take(1, soft(i) ? (lang === 'it' ? 'tʃ' : 's') : 'k');
    else if (r[0] === 'g') take(1, soft(i) ? (lang === 'it' || lang === 'en' ? 'dʒ' : lang === 'fr' ? 'ʒ' : 'g') : 'g');
    else if (r[0] === 'j') take(1, lang === 'fr' ? 'ʒ' : lang === 'en' ? 'dʒ' : 'j');
    else if (r[0] === 'z') take(1, lang === 'it' || lang === 'de' ? 'ts' : 'z');
    else if (r[0] === 'w') take(1, lang === 'de' ? 'v' : 'w');
    else if (r[0] === 'x') take(1, 'k', 's');
    else if (r[0] === 'h') { if (lang === 'de' || lang === 'en') take(1, 'h'); else i++; }
    else if (r[0] === 's') take(1, lang === 'de' && /[aeiouäöü]/.test(r[1] ?? next ?? '') && i === 0 ? 'z' : 's');
    else if ('ptkbdfvmnlr'.includes(r[0])) take(1, r[0]);
    else if (r[0] === 'ß') take(1, 's');
    else i++;
  }
  return out;
}

/** Pinyin final: glide in, nucleus, glide out (Mandarin e is ɤ, a mid back vowel; ui is u-e-i). */
function zhFinal(py) {
  let p = strip(py).replace(/u:/g, 'ü');
  const init = (p.match(/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcs])/) || [''])[0];
  let f = p.slice(init.length);
  // y-/w- spellings, and u after j q x is ü
  if (init === '') f = f.replace(/^yi/, 'i').replace(/^yu/, 'ü').replace(/^y/, 'i').replace(/^wu/, 'u').replace(/^w/, 'u');
  if (/^[jqx]$/.test(init)) f = f.replace(/^u/, 'ü');
  if (/^(zh|ch|sh|r|z|c|s)$/.test(init) && f === 'i') return 'ɤ'; // zhi chi shi ri zi ci si
  const T = {
    a: 'a', o: { from: 'u', v: 'o' }, e: 'ɤ', i: 'i', u: 'u', ü: 'i', er: 'ɤ',
    ai: { v: 'a', to: 'i' }, ei: { v: 'e', to: 'i' }, ao: { v: 'a', to: 'u' }, ou: { v: 'o', to: 'u' },
    ia: { from: 'i', v: 'a' }, ie: { from: 'i', v: 'e' }, ua: { from: 'u', v: 'a' }, uo: { from: 'u', v: 'o' }, üe: { from: 'i', v: 'e' },
    iao: { from: 'i', v: 'a', to: 'u' }, iu: { from: 'i', v: 'o', to: 'u' }, iou: { from: 'i', v: 'o', to: 'u' },
    uai: { from: 'u', v: 'a', to: 'i' }, ui: { from: 'u', v: 'e', to: 'i' }, uei: { from: 'u', v: 'e', to: 'i' },
    an: 'a', en: 'ə', ang: 'a', eng: 'ɤ', ong: 'u', in: 'i', ing: 'i', un: { from: 'u', v: 'ə' }, uen: { from: 'u', v: 'ə' },
    ün: 'i', ian: { from: 'i', v: 'ɛ' }, uan: { from: 'u', v: 'a' }, üan: { from: 'i', v: 'ɛ' },
    iang: { from: 'i', v: 'a' }, uang: { from: 'u', v: 'a' }, iong: { from: 'i', v: 'u' }, ueng: { from: 'u', v: 'ɤ' },
  };
  if (/^[bpmf]o$/.test(init + f)) return { from: 'u', v: 'o' };
  return T[f] ?? (/a/.test(f) ? 'a' : /o/.test(f) ? 'o' : /e/.test(f) ? 'ɤ' : /i/.test(f) ? 'i' : 'u');
}

/** The plain vowel the syllable is sung on. */
function vowelOf(w, lang, stressed) {
  const PLAIN = (v) => ({ y: 'i', ø: 'e', ɪ: 'i', ʌ: 'a', ɑ: 'a', æ: 'a', ʊ: 'u' }[v] || v);
  if (lang === 'ru') {
    const m = w.match(/[аеёиоуыэюя]/);
    if (!m) return 'a';
    const v = m[0];
    if (v === 'а' || v === 'я') return 'a';
    if (v === 'о') return stressed ? 'o' : 'a'; // akanye: unstressed o sounds like a
    if (v === 'е' || v === 'э') return stressed ? 'e' : 'i';
    if (v === 'ё') return 'o';
    if (v === 'и' || v === 'ы') return 'i';
    return 'u';
  }
  if (lang === 'zh') return zhFinal(w);
  if (lang === 'fr') {
    if (/eau|au/.test(w)) return 'o';
    if (/ou|où/.test(w)) return 'u';
    if (/oi/.test(w)) return 'a';
    if (/ai|ei|è|ê/.test(w)) return 'ɛ';
    if (/é/.test(w)) return 'e';
    if (/œu|eu|œ/.test(w)) return 'e';
    if (/(an|am|en|em)(?![aeiouy])/.test(w)) return 'a';
    if (/(on|om)(?![aeiouy])/.test(w)) return 'ɔ';
    if (/(in|ain|ein|un)(?![aeiouy])/.test(w)) return 'ɛ';
    if (/u/.test(w)) return 'i';
    if (/[iyî]/.test(w)) return 'i';
    if (/[oô]/.test(w)) return 'ɔ';
    if (/[aàâ]/.test(w)) return 'a';
    return 'e';
  }
  if (lang === 'de') {
    if (/äu|eu/.test(w)) return 'ɔ';
    if (/ä/.test(w)) return 'ɛ';
    if (/ö/.test(w)) return 'e';
    if (/ü/.test(w)) return 'i';
    if (/ie/.test(w)) return 'i';
    if (/ei|ai|au/.test(w)) return 'a';
    const m = w.match(/[aeiou]/);
    return m ? m[0] : 'e';
  }
  if (lang === 'en') {
    const AI = { v: 'a', to: 'i' }, EI = { v: 'e', to: 'i' }, OU = { v: 'o', to: 'u' }, AU = { v: 'a', to: 'u' };
    if (/^(i|eye|eyes|aye)$/.test(w) || /igh/.test(w) || /i[^aeiou]e$/.test(w) || /^[^aeiou]*ie$/.test(w)) return AI;
    if (/^[^aeiouy]+y$/.test(w)) return stressed ? AI : 'i';   // my, thy, sky (stressed) — -ly, -ty (unstressed)
    if (/ee|ea|ie|^(e|thee|me|he|she|we|be)$/.test(w)) return 'i';
    if (/oo/.test(w)) return 'u';
    if (/oy|oi/.test(w)) return { v: 'ɔ', to: 'i' };
    if (/(l|r|gr|kn|bl|fl|gl|sh|sn|thr|sl|cr)ow$/.test(w)) return OU; // low, know, snow (but now, how: au)
    if (/ou|ow/.test(w)) return AU;
    if (/ai|ay|ey/.test(w) || /a[^aeiou]e$/.test(w)) return EI;
    if (/(^|[^r])ove$|^(c|s)ome$|^(d|n)one$/.test(w)) return 'a'; // love, come, done
    if (/oa|o[^aeiou]e$|o$/.test(w)) return OU;
    if (/u[^aeiou]e$/.test(w)) return 'u';
    if (/ar/.test(w)) return 'a';
    if (/er|ir|ur|ear/.test(w)) return 'ə';
    if (/or|aw|au/.test(w)) return 'ɔ';
    const m = w.match(/[aeiou]/);
    return m ? PLAIN({ a: 'æ', e: 'ɛ', i: 'ɪ', o: 'ɔ', u: 'ʌ' }[m[0]]) : 'ə';
  }
  // Italian: i/u beside another vowel are glides (pie-, uo-, -ia); è = ɛ, ò = ɔ
  const x = w.replace(/^(sc|c|g)i(?=[aeou])/, '$1').replace(/gli(?=[aeou])/, 'gl');
  const m = x.match(/[aeiouàèéìòóù]/);
  if (!m) return 'a';
  let v = m[0];
  if ((v === 'i' || v === 'u') && /[aeoàèéòó]/.test(x[m.index + 1] || '')) v = x[m.index + 1];
  return { à: 'a', è: 'ɛ', é: 'e', ì: 'i', ò: 'ɔ', ó: 'o', ù: 'u' }[v] || v;
}

/**
 * @param {string} text the syllable (Cyrillic for Russian, pinyin for Chinese)
 * @returns {{onset:string[], vowel:string, coda:string[]}}
 */
export function analyzeSyllable(text, lang, stressed) {
  const raw = text.toLowerCase().replace(/[‿'’.,;:!?«»"-]/g, ' ').trim().split(/\s+/)[0] || '';
  const V = lang === 'ru' ? CYR_V : LATIN_V;
  const isV = (c) => V.includes(c) || V.includes(strip(c));
  let i = 0;
  while (i < raw.length && !isV(raw[i])) i++;
  let j = raw.length;
  while (j > i && !isV(raw[j - 1])) j--;
  let onset = consonants(raw.slice(0, i), lang, raw[i]).slice(-2);
  let coda = consonants(raw.slice(j).replace(/[ьъ]/g, ''), lang, '');
  if (lang === 'fr' && /^(s|t|x|z|d|ent|es|nt)$/.test(raw.slice(j))) coda = []; // silent final letters
  if (lang === 'en') coda = coda.filter((ph) => ph !== 'w' && ph !== 'j'); // now, day: part of the vowel
  if (lang === 'fr' && /[aeiouy][nm]$/.test(raw)) coda = []; // nasal vowel, no n
  if (lang === 'zh') {
    coda = /ng?$/.test(raw) ? ['n'] : [];
    onset = onset.filter((ph) => ph !== 'j' && ph !== 'w'); // y-/w- are part of the final's glide
  }
  const v = vowelOf(raw, lang, stressed), o = typeof v === 'string' ? { v } : v;
  return { onset, vowel: o.v, from: o.from, to: o.to, coda: coda.slice(0, 1) };
}
