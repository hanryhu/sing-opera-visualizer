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

/** The plain vowel the syllable is sung on. */
function vowelOf(w, lang, stressed) {
  const PLAIN = (v) => ({ y: 'i', ø: 'e', ə: 'e', ɪ: 'i', ʌ: 'a', ɑ: 'a', æ: 'a', ʊ: 'u' }[v] || v);
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
  if (lang === 'zh') {
    const p = strip(w);
    if (/^(zh|ch|sh|r|z|c|s)i$/.test(p)) return 'e';
    if (/^[jqxy]u/.test(p) || /ü/.test(w)) return 'i';
    if (/a/.test(p)) return 'a';
    if (/o/.test(p)) return 'o';
    if (/ie|ei/.test(p)) return 'e';
    if (/e/.test(p)) return 'e';
    if (/i/.test(p)) return 'i';
    return 'u';
  }
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
    if (/ee|ea|ie|^(e|thee|me|he|she|we|be)$/.test(w)) return 'i';
    if (/oo/.test(w)) return 'u';
    if (/ou|ow/.test(w)) return 'a';
    if (/ai|ay|ey/.test(w)) return 'e';
    if (/oa|o$/.test(w)) return 'o';
    if (/igh|^i$/.test(w)) return 'a';
    if (/y$/.test(w)) return w.length > 2 ? 'i' : 'a';
    if (/ar/.test(w)) return 'a';
    if (/er|ir|ur/.test(w)) return 'e';
    if (/or|aw|au/.test(w)) return 'ɔ';
    const m = w.match(/[aeiou]/);
    return m ? PLAIN({ a: 'æ', e: 'ɛ', i: 'ɪ', o: 'ɔ', u: 'ʌ' }[m[0]]) : 'e';
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
  const onset = consonants(raw.slice(0, i), lang, raw[i]).slice(-2);
  let coda = consonants(raw.slice(j).replace(/[ьъ]/g, ''), lang, '');
  if (lang === 'fr' && /^(s|t|x|z|d|ent|es|nt)$/.test(raw.slice(j))) coda = []; // silent final letters
  if (lang === 'fr' && /[aeiouy][nm]$/.test(raw)) coda = []; // nasal vowel, no n
  if (lang === 'zh') coda = /ng?$/.test(raw) ? ['n'] : [];
  return { onset, vowel: vowelOf(raw, lang, stressed), coda: coda.slice(0, 1) };
}
