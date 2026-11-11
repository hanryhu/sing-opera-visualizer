// Lyrics for Learn: public-domain verse, split into sung syllables with the stresses marked.
// Markup: syllables of a word joined by '-', words by spaces, a stressed syllable starts with "'",
// '_' joins two vowels sung on one note (synalepha / elision), shown as '‿'.
// Chinese lines are written as characters (simplified|traditional|pinyin); every other character is strong.

/** Each language: a list of poems; each poem a list of lines (sung in order). */
const CORPUS = {
  it: [
    [ // Caro mio ben (Giordani, c. 1783)
      "'Ca-ro 'mi-o 'ben, 'cre-di-mi_al-'men,",
      "'sen-za di 'te lan-'gui-sce_il 'cor.",
    ],
    [ // Voi che sapete (Da Ponte, 1786)
      "'Vo-i che sa-'pe-te che 'co-sa_è a-'mor,",
      "'don-ne, ve-'de-te s'io l'ho nel 'cor.",
    ],
    [ // La donna è mobile (Piave, 1851)
      "La 'don-na_è 'mo-bi-le 'qual 'piu-ma_al 'ven-to,",
      "'mu-ta d'ac-'cen-to_e di pen-'sie-ro.",
    ],
    [ // Lascia ch'io pianga (Rossi, 1711)
      "'La-scia ch'i-o 'pian-ga 'mia 'cru-da 'sor-te,",
      "e che so-'spi-ri la li-ber-'tà.",
    ],
    [ // Casta Diva (Romani, 1831)
      "'Ca-sta 'Di-va, che_i-nar-'gen-ti",
      "'que-ste 'sa-cre_an-'ti-che 'pian-te.",
    ],
    [ // Santa Lucia (Cottrau, 1849)
      "Sul 'ma-re 'lu-ci-ca l'a-'stro d'ar-'gen-to,",
      "'pla-ci-da_è l'on-da, 'pro-spe-ro_è_il 'ven-to.",
    ],
    [ // Nel cor più non mi sento (Paisiello, 1788)
      "Nel 'cor più 'non mi 'sen-to",
      "bril-'lar la gio-ven-'tù.",
    ],
  ],
  de: [
    [ // Der Lindenbaum (Müller, 1822)
      "Am 'Brun-nen 'vor dem 'To-re,",
      "da 'steht ein 'Lin-den-baum;",
      "ich 'träumt in 'sei-nem 'Schat-ten",
      "so 'man-chen 'sü-ßen 'Traum.",
    ],
    [ // Die Lorelei (Heine, 1824)
      "Ich 'weiß nicht, was 'soll es be-'deu-ten,",
      "dass 'ich so 'trau-rig 'bin.",
    ],
    [ // Du bist wie eine Blume (Heine, 1827)
      "Du 'bist wie 'ei-ne 'Blu-me,",
      "so 'hold und 'schön und 'rein.",
    ],
    [ // Erlkönig (Goethe, 1782)
      "Wer 'rei-tet so 'spät durch 'Nacht und 'Wind?",
      "Es 'ist der 'Va-ter mit 'sei-nem 'Kind.",
    ],
    [ // Heidenröslein (Goethe, 1789)
      "'Sah ein 'Knab ein 'Rös-lein 'stehn,",
      "'Rös-lein 'auf der 'Hei-den.",
    ],
    [ // An die Freude (Schiller, 1785)
      "'Freu-de, 'schö-ner 'Göt-ter-'fun-ken,",
      "'Toch-ter 'aus E-'ly-si-'um.",
    ],
  ],
  fr: [
    [ // Il pleure dans mon cœur (Verlaine, 1874)
      "Il 'pleu-re dans mon 'cœur",
      "com-me_il 'pleut sur la 'vil-le.",
    ],
    [ // Chanson d'automne (Verlaine, 1866)
      "Les san-'glots 'longs des vi-o-'lons",
      "de l'au-'tom-ne.",
    ],
    [ // Au clair de la lune (traditional)
      "Au 'clair de la 'lu-ne, mon a-'mi Pier-'rot,",
      "'prê-te-moi ta 'plu-me pour é-'cri-re_un 'mot.",
    ],
    [ // Mignonne, allons voir si la rose (Ronsard, 1545)
      "Mi-'gnon-ne_al-'lons 'voir si la 'ro-se",
      "qui ce ma-'tin a-'voit dé-'clo-se.",
    ],
    [ // Plaisir d'amour (Florian, 1784)
      "Plai-'sir d'a-'mour ne 'du-re qu'un mo-'ment,",
      "cha-'grin d'a-'mour 'du-re 'tou-te la 'vi-e.",
    ],
    [ // Frère Jacques (traditional)
      "'Frè-re Jac-'ques, dor-'mez-vous?",
      "'Son-nez les ma-'ti-nes.",
    ],
    [ // Sur le pont d'Avignon (traditional)
      "Sur le 'pont d'A-vi-'gnon,",
      "l'on y 'dan-se, l'on y 'dan-se.",
    ],
  ],
  en: [
    [ // Sonnet 18 (Shakespeare, 1609)
      "Shall 'I com-'pare thee 'to a 'sum-mer's 'day?",
      "Thou 'art more 'love-ly 'and more 'tem-per-'ate.",
    ],
    [ // Song to Celia (Jonson, 1616)
      "'Drink to me 'on-ly 'with thine 'eyes,",
      "and 'I will 'pledge with 'mine.",
    ],
    [ // A Red, Red Rose (Burns, 1794)
      "O, my 'Luve is 'like a 'red, red 'rose,",
      "that's 'new-ly 'sprung in 'June.",
    ],
    [ // The Tyger (Blake, 1794)
      "'Ty-ger, 'Ty-ger, 'burn-ing 'bright",
      "'in the 'for-ests 'of the 'night.",
    ],
    [ // Auld Lang Syne (Burns, 1788)
      "Should 'auld ac-'quain-tance 'be for-'got",
      "and 'nev-er 'brought to 'mind?",
    ],
    [ // Sweet and Low (Tennyson, 1850)
      "'Sweet and 'low, 'sweet and 'low,",
      "'wind of the 'west-ern 'sea.",
    ],
    [ // Who is Silvia? (Shakespeare, 1590s)
      "'Who is 'Sil-vi-a? 'What is 'she,",
      "that 'all our 'swains com-'mend her?",
    ],
  ],
  ru: [
    [ // К *** (Пушкин, 1825)
      "Я 'пом-ню 'чуд-но-е мгно-'ве-нье:",
      "пе-ре-до 'мной я-'ви-лась 'ты,",
      "как ми-мо-'лёт-но-е ви-'де-нье,",
      "как 'ге-ний 'чис-той кра-со-'ты.",
    ],
    [ // Парус (Лермонтов, 1832)
      "Бе-'ле-ет 'па-рус о-ди-'но-кий",
      "в ту-'ма-не 'мо-ря го-лу-'бом.",
    ],
    [ // Зимнее утро (Пушкин, 1829)
      "Мо-'роз и 'солн-це; 'день чу-'дес-ный!",
      "е-'щё ты 'дрем-лешь, 'друг пре-'лест-ный.",
    ],
    [ // Выхожу один я на дорогу (Лермонтов, 1841)
      "Вы-хо-'жу о-'дин я на до-'ро-гу;",
      "сквозь ту-'ман крем-'ни-стый 'путь бле-'стит.",
    ],
    [ // Весенняя гроза (Тютчев, 1828)
      "Лю-'блю гро-'зу в на-'ча-ле 'ма-я,",
      "ког-'да ве-'сен-ний, 'пер-вый 'гром.",
    ],
  ],
  zh: [
    [ // 静夜思 (李白)
      '床床chuáng 前前qián 明明míng 月月yuè 光光guāng',
      '疑疑yí 是是shì 地地dì 上上shàng 霜霜shuāng',
      '举舉jǔ 头頭tóu 望望wàng 明明míng 月月yuè',
      '低低dī 头頭tóu 思思sī 故故gù 乡鄉xiāng',
    ],
    [ // 春晓 (孟浩然)
      '春春chūn 眠眠mián 不不bù 觉覺jué 晓曉xiǎo',
      '处處chù 处處chù 闻聞wén 啼啼tí 鸟鳥niǎo',
      '夜夜yè 来來lái 风風fēng 雨雨yǔ 声聲shēng',
      '花花huā 落落luò 知知zhī 多多duō 少少shǎo',
    ],
    [ // 登鹳雀楼 (王之涣)
      '白白bái 日日rì 依依yī 山山shān 尽盡jìn',
      '黄黃huáng 河河hé 入入rù 海海hǎi 流流liú',
      '欲欲yù 穷窮qióng 千千qiān 里里lǐ 目目mù',
      '更更gèng 上上shàng 一一yī 层層céng 楼樓lóu',
    ],
    [ // 相思 (王维)
      '红紅hóng 豆豆dòu 生生shēng 南南nán 国國guó',
      '春春chūn 来來lái 发發fā 几幾jǐ 枝枝zhī',
      '愿願yuàn 君君jūn 多多duō 采採cǎi 撷擷xié',
      '此此cǐ 物物wù 最最zuì 相相xiāng 思思sī',
    ],
  ],
};

/** Menu entries: id, label, corpus, script. */
export const LANGS = [
  { id: 'it', label: 'IT' }, { id: 'de', label: 'DE' }, { id: 'fr', label: 'FR' }, { id: 'en', label: 'EN' },
  { id: 'ru', label: 'RU (я)' }, { id: 'ruLat', label: 'RU (Aa)' }, { id: 'zhS', label: 'ZH (简)' }, { id: 'zhT', label: 'ZH (繁)' },
];

/* ---------------- Russian → Latin, with an accent on the stressed vowel ---------------- */
const TR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: "'", э: 'e', ю: 'yu', я: 'ya',
};
const ACUTE = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', y: 'ý' };
const RU_VOWELS = 'аеёиоуыэюя';
function latin(cyr, stressed, prevChar) {
  let out = '', accented = !stressed;
  for (let i = 0; i < cyr.length; i++) {
    const ch = cyr[i], lower = ch.toLowerCase(), prev = i ? cyr[i - 1].toLowerCase() : prevChar;
    let s = TR[lower] ?? ch;
    // е after a vowel, ь, ъ or at the start of a word sounds "ye"
    if (lower === 'е' && (!prev || RU_VOWELS.includes(prev) || prev === 'ь' || prev === 'ъ' || prev === ' ')) s = 'ye';
    if (!accented && RU_VOWELS.includes(lower)) {
      // accent the vowel letter (the a in ya, the o in yo ...)
      s = s.replace(/[aeiouy](?!.*[aeiou])/, (v) => ACUTE[v]);
      if (lower === 'ы') s = 'ý';
      accented = true;
    }
    if (ch !== lower && s) s = s[0].toUpperCase() + s.slice(1);
    out += s;
  }
  return out;
}

/* ---------------- parsing ---------------- */
/** A line → [{text, stress, wordEnd}] (text already in the display script; hyphens are added when drawing). */
function parseLine(line, lang) {
  if (lang === 'zhS' || lang === 'zhT') {
    return line.split(' ').map((tok, i) => {
      const [simp, trad] = [tok[0], tok[1]];
      return { text: lang === 'zhS' ? simp : trad, sub: tok.slice(2), stress: i % 2 === 0, wordEnd: true };
    });
  }
  const out = [];
  const words = line.split(' ').filter(Boolean);
  for (const w of words) {
    const syls = w.split('-');
    let prevChar = ' ';
    syls.forEach((raw, k) => {
      const stress = raw.startsWith("'");
      let text = (stress ? raw.slice(1) : raw).replace(/_/g, '‿'); // only the leading ' is a stress mark
      if (lang === 'ruLat') {
        // keep punctuation, transliterate letters
        const m = text.match(/^(.*?)([.,;:!?]*)$/);
        text = latin(m[1].replace(/‿/g, ' '), stress, prevChar).replace(/ /g, '‿') + m[2];
        prevChar = raw.replace(/[_.,;:!?]/g, '').replace(/^'/, '').slice(-1).toLowerCase();
      }
      out.push({ text, stress, wordEnd: k === syls.length - 1 });
    });
  }
  return out;
}

/**
 * Lines of verse for a phrase: a poem from the start, continuing with another poem if needed.
 * @returns {{sylls:{text:string, sub?:string, stress:boolean, wordEnd:boolean}[]}[]}
 */
export function lyricLines(lang, count = 8) {
  const key = lang === 'ruLat' ? 'ru' : lang === 'zhS' || lang === 'zhT' ? 'zh' : lang;
  const poems = CORPUS[key];
  if (!poems) return [];
  const order = [...poems.keys()].sort(() => Math.random() - 0.5);
  const lines = [];
  for (const pi of order) {
    for (const line of poems[pi]) lines.push({ sylls: parseLine(line, lang) });
    if (lines.length >= count) break;
  }
  return lines;
}
