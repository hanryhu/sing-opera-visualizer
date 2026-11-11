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
      "O, my 'Love is 'like a 'red, red 'rose,",
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

/* More public-domain verse (same markup). Merged into CORPUS below. */
const MORE = {
  en: [
    [ // I Wandered Lonely as a Cloud (Wordsworth, 1807)
      "I 'wan-dered 'lone-ly 'as a 'cloud",
      "that 'floats on 'high o'er 'vales and 'hills,",
    ],
    [ // Music, when soft voices die (Shelley, 1821)
      "'Mu-sic, 'when soft 'voi-ces 'die,",
      "'vi-brates 'in the 'mem-o-'ry;",
    ],
    [ // She Walks in Beauty (Byron, 1814)
      "She 'walks in 'beau-ty, 'like the 'night",
      "of 'cloud-less 'climes and 'star-ry 'skies;",
    ],
    [ // Endymion (Keats, 1818)
      "A 'thing of 'beau-ty 'is a 'joy for 'ev-er:",
      "its 'love-li-'ness in-'creas-es; 'it will 'nev-er",
    ],
    [ // Ariel's Song (Shakespeare, The Tempest)
      "'Full 'fath-om 'five thy 'fa-ther 'lies;",
      "'of his 'bones are 'cor-al 'made;",
    ],
    [ // It Was a Lover and His Lass (Shakespeare)
      "It 'was a 'lov-er 'and his 'lass,",
      "with a 'hey, and a 'ho, and a 'hey non-i-'no,",
    ],
    [ // Introduction to Songs of Innocence (Blake, 1789)
      "'Pip-ing 'down the 'val-leys 'wild,",
      "'pip-ing 'songs of 'plea-sant 'glee,",
    ],
    [ // To the Virgins, to Make Much of Time (Herrick, 1648)
      "'Gath-er ye 'rose-buds 'while ye 'may,",
      "old 'Time is 'still a-'fly-ing;",
    ],
    [ // The Passionate Shepherd to His Love (Marlowe, 1599)
      "Come 'live with 'me and 'be my 'love,",
      "and 'we will 'all the 'plea-sures 'prove",
    ],
    [ // There Is a Garden in Her Face (Campion, 1617)
      "There 'is a 'gar-den 'in her 'face,",
      "where 'ros-es 'and white 'lil-ies 'grow;",
    ],
    [ // Break, Break, Break (Tennyson, 1842)
      "'Break, 'break, 'break,",
      "on thy 'cold 'gray 'stones, O 'Sea!",
    ],
    [ // Crossing the Bar (Tennyson, 1889)
      "'Sun-set and 'eve-ning 'star,",
      "and 'one 'clear 'call for 'me!",
    ],
    [ // In the Bleak Midwinter (C. Rossetti, 1872)
      "In the 'bleak mid-'win-ter",
      "'frost-y 'wind made 'moan,",
    ],
    [ // Who Has Seen the Wind? (C. Rossetti, 1872)
      "'Who has 'seen the 'wind?",
      "'Nei-ther 'I nor 'you:",
    ],
    [ // Bed in Summer (Stevenson, 1885)
      "In 'win-ter 'I get 'up at 'night",
      "and 'dress by 'yel-low 'can-dle-'light.",
    ],
    [ // My Heart Leaps Up (Wordsworth, 1807)
      "My 'heart leaps 'up when 'I be-'hold",
      "a 'rain-bow 'in the 'sky:",
    ],
    [ // Sweet Afton (Burns, 1791)
      "Flow 'gent-ly, sweet 'Af-ton, a-'mong thy green 'braes,",
      "flow 'gent-ly, I'll 'sing thee a 'song in thy 'praise;",
    ],
    [ // To a Skylark (Shelley, 1820)
      "'Hail to 'thee, blithe 'Spir-it!",
      "'Bird thou 'nev-er 'wert,",
    ],
    [ // Kubla Khan (Coleridge, 1816)
      "In 'Xan-a-du did 'Ku-bla 'Khan",
      "a 'state-ly 'plea-sure-'dome de-'cree:",
    ],
    [ // Bright Star (Keats, 1819)
      "'Bright star, would 'I were 'stead-fast 'as thou 'art,",
      "not 'in lone 'splen-dour 'hung a-'loft the 'night",
    ],
    [ // Hymn to Diana (Jonson, 1600)
      "'Queen and 'hunt-ress, 'chaste and 'fair,",
      "'now the 'sun is 'laid to 'sleep,",
    ],
    [ // O Mistress Mine (Shakespeare, Twelfth Night)
      "O 'mis-tress 'mine, 'where are you 'roam-ing?",
      "O, 'stay and 'hear; your 'true love's 'com-ing,",
    ],
    [ // Spring (Nashe, 1600)
      "'Spring, the 'sweet spring, is the 'year's 'plea-sant 'king;",
      "then 'blooms each 'thing, then 'maids dance in a 'ring,",
    ],
    [ // Hope is the thing with feathers (Dickinson)
      "'Hope is the 'thing with 'feath-ers",
      "that 'perch-es 'in the 'soul,",
    ],
  ],
  it: [
    [ // I puritani (Pepoli, 1835)
      "Ah, per 'sem-pre_io ti per-'dei,",
      "'fior d'a-'mo-re, 'mi-a spe-'ran-za;",
    ],
    [ // Rigoletto, Caro nome (Piave, 1851)
      "'Ca-ro 'no-me che_il 'mi-o 'cor",
      "'fe-sti 'pri-mo pal-pi-'tar,",
    ],
    [ // Nabucco, Va, pensiero (Solera, 1842)
      "'Va, pen-'sie-ro, sul-l'a-li do-'ra-te;",
      "'va, ti 'po-sa sui 'cli-vi, sui 'col-li,",
    ],
    [ // L'elisir d'amore (Romani, 1832)
      "U-na fur-'ti-va 'la-gri-ma",
      "ne-gl'oc-chi 'suoi spun-'tò:",
    ],
    [ // Rigoletto, Questa o quella (Piave, 1851)
      "'Que-sta_o 'quel-la per 'me 'pa-ri 'so-no",
      "a 'quan-te d'in-'tor-no mi 've-do;",
    ],
    [ // Aida, Celeste Aida (Ghislanzoni, 1871)
      "Ce-'le-ste_A-'i-da, 'for-ma di-'vi-na,",
      "'mi-sti-co 'ser-to di 'lu-ce_e 'fior,",
    ],
    [ // La traviata, Sempre libera (Piave, 1853)
      "'Sem-pre 'li-be-ra deg-g'io",
      "fol-leg-'gia-re di 'gio-ia_in 'gio-ia,",
    ],
    [ // La traviata, Libiamo (Piave, 1853)
      "Li-'bia-mo, li-'bia-mo ne' 'lie-ti 'ca-li-ci",
      "che la bel-'lez-za_in-fio-'ra,",
    ],
    [ // Rigoletto, Bella figlia dell'amore (Piave, 1851)
      "'Bel-la 'fi-glia del-l'a-'mo-re,",
      "'schia-vo 'son dei 'vez-zi 'tuo-i;",
    ],
    [ // Chiare, fresche et dolci acque (Petrarca)
      "'Chia-re, 'fre-sche_et 'dol-ci_ac-que,",
      "o-ve le 'bel-le 'mem-bra",
    ],
    [ // Inferno I (Dante)
      "Nel 'mez-zo del cam-'min di 'no-stra 'vi-ta",
      "mi ri-tro-'vai per 'u-na 'sel-va_o-'scu-ra,",
    ],
    [ // L'infinito (Leopardi, 1819)
      "'Sem-pre 'ca-ro mi 'fu que-st'er-mo 'col-le,",
      "e 'que-sta 'sie-pe, che da 'tan-ta 'par-te",
    ],
    [ // Amarilli, mia bella (Caccini, 1602)
      "A-ma-'ril-li, 'mi-a 'bel-la,",
      "non 'cre-di, o del 'mio 'cor 'dol-ce de-'si-o,",
    ],
    [ // Lasciatemi morire (Rinuccini, 1608)
      "La-'scia-te-mi mo-'ri-re!",
      "e che 'vo-le-te che mi con-'for-te",
    ],
    [ // Serse, Ombra mai fu (1738)
      "'Om-bra 'mai 'fu",
      "di ve-ge-'ta-bi-le, 'ca-ra_ed a-'ma-bi-le,",
    ],
    [ // Già il sole dal Gange (Scarlatti)
      "'Già_il 'so-le dal 'Gan-ge",
      "più 'chia-ro sfa-'vil-la,",
    ],
    [ // Se tu m'ami (Rolli)
      "Se tu 'm'a-mi, se so-'spi-ri",
      "'sol per 'me, gen-'til pa-'stor,",
    ],
    [ // O del mio dolce ardor (Gluck, 1786)
      "O del 'mi-o 'dol-ce_ar-'dor",
      "bra-'ma-to_og-'get-to,",
    ],
    [ // Vittoria, mio core! (Carissimi)
      "Vit-'to-ria, vit-'to-ria, 'mi-o 'co-re!",
      "non la-gri-'mar più,",
    ],
    [ // Il mio bel foco (Marcello)
      "Il 'mi-o 'bel 'fo-co,",
      "o 'lon-ta-no_o vi-'ci-no",
    ],
    [ // Tu lo sai (Torelli)
      "Tu lo 'sai quan-to t'a-'ma-i,",
      "tu lo 'sai, lo sai cru-'del.",
    ],
    [ // Il barbiere di Siviglia, Una voce poco fa (Sterbini, 1816)
      "'U-na 'vo-ce 'po-co 'fa",
      "'qui nel 'cor mi ri-suo-'nò;",
    ],
    [ // Il barbiere di Siviglia, Largo al factotum (Sterbini, 1816)
      "'Lar-go_al fac-'to-tum del-la cit-'tà.",
      "'Pre-sto_a bot-'te-ga che_l'al-ba_è già 'qua.",
    ],
  ],
  de: [
    [ // Wandrers Nachtlied II (Goethe, 1780)
      "'Ü-ber 'al-len 'Gip-feln",
      "'ist 'Ruh,",
    ],
    [ // Gretchen am Spinnrade (Goethe)
      "'Mei-ne 'Ruh ist 'hin,",
      "mein 'Herz ist 'schwer;",
    ],
    [ // Im wunderschönen Monat Mai (Heine, 1823)
      "Im 'wun-der-'schö-nen 'Mo-nat 'Mai,",
      "als 'al-le 'Knos-pen 'spran-gen,",
    ],
    [ // Ich grolle nicht (Heine, 1823)
      "Ich 'grol-le 'nicht, und 'wenn das 'Herz auch 'bricht,",
      "'e-wig ver-'lor-nes 'Lieb, ich 'grol-le 'nicht.",
    ],
    [ // Gute Nacht (Müller, 1823)
      "'Fremd bin ich 'ein-ge-'zo-gen,",
      "'fremd zieh ich 'wie-der 'aus.",
    ],
    [ // Das Wandern (Müller, 1821)
      "Das 'Wan-dern 'ist des 'Mül-lers 'Lust,",
      "das 'Wan-dern!",
    ],
    [ // An die Musik (Schober, 1817)
      "Du 'hol-de 'Kunst, in 'wie viel 'grau-en 'Stun-den,",
      "wo 'mich des 'Le-bens 'wil-der 'Kreis um-'strickt,",
    ],
    [ // Der Tod und das Mädchen (Claudius, 1775)
      "Vor-'ü-ber! ach, vor-'ü-ber!",
      "geh, 'wil-der 'Kno-chen-mann!",
    ],
    [ // Mondnacht (Eichendorff, 1837)
      "Es 'war, als 'hätt der 'Him-mel",
      "die 'Er-de 'still ge-'küsst,",
    ],
    [ // Du bist die Ruh (Rückert, 1821)
      "Du 'bist die 'Ruh,",
      "der 'Frie-de 'mild,",
    ],
    [ // Mignon (Goethe, 1795)
      "Kennst 'du das 'Land, wo 'die Zi-'tro-nen 'blühn,",
      "im 'dunk-len 'Laub die 'Gold-O-'ran-gen 'glühn,",
    ],
    [ // Ein Fichtenbaum steht einsam (Heine, 1823)
      "Ein 'Fich-ten-baum steht 'ein-sam",
      "im 'Nor-den auf 'kah-ler 'Höh.",
    ],
    [ // Frühlingsglaube (Uhland, 1812)
      "Die 'lin-den 'Lüf-te 'sind er-'wacht,",
      "sie 'säu-seln 'und we-ben 'Tag und 'Nacht,",
    ],
    [ // Weißt du, wie viel Sternlein stehen (Hey, 1837)
      "'Weißt du, 'wie viel 'Stern-lein 'ste-hen",
      "'an dem 'blau-en 'Him-mels-'zelt?",
    ],
    [ // Wiegenlied (Des Knaben Wunderhorn)
      "Gu-ten 'A-bend, gut' 'Nacht,",
      "mit 'Ro-sen be-'dacht,",
    ],
    [ // Stille Nacht (Mohr, 1818)
      "'Stil-le 'Nacht, 'hei-li-ge 'Nacht!",
      "'Al-les 'schläft, 'ein-sam 'wacht",
    ],
    [ // Abendlied (Claudius, 1779)
      "Der 'Mond ist 'auf-ge-'gan-gen,",
      "die 'gold-nen 'Stern-lein 'pran-gen",
    ],
    [ // Nähe des Geliebten (Goethe, 1795)
      "Ich 'den-ke 'dein, wenn 'mir der 'Son-ne 'Schim-mer",
      "vom 'Mee-re 'strahlt;",
    ],
    [ // Ach, wie ist's möglich dann (folk song)
      "Ach, 'wie ist's 'mög-lich 'dann,",
      "dass 'ich dich 'las-sen 'kann!",
    ],
    [ // Am Meer (Heine, 1823)
      "Das 'Meer er-'glänz-te 'weit hin-'aus",
      "im 'letz-ten 'A-bend-schei-ne;",
    ],
    [ // Die Forelle (Schubart, 1783)
      "In 'ei-nem 'Bäch-lein 'hel-le,",
      "da 'schoss in 'fro-her 'Eil",
    ],
    [ // Ständchen (Rellstab, 1828)
      "'Lei-se 'fle-hen 'mei-ne 'Lie-der",
      "'durch die 'Nacht zu 'dir;",
    ],
    [ // Frühlingsnacht (Eichendorff, 1837)
      "'Ü-bern 'Gar-ten 'durch die 'Lüf-te",
      "'hört ich 'Wan-der-'vö-gel 'ziehn,",
    ],
    [ // Erster Verlust (Goethe, 1785)
      "Ach, wer 'bringt die 'schö-nen 'Ta-ge,",
      "'je-ne 'Ta-ge der 'ers-ten 'Lie-be,",
    ],
  ],
  fr: [
    [ // Demain, dès l'aube (Hugo, 1856)
      "De-'main, dès 'l'au-be_à 'l'heu-re_où 'blan-chit la cam-'pa-gne,",
      "je par-ti-'rai.",
    ],
    [ // L'Invitation au voyage (Baudelaire, 1857)
      "Mon en-'fant, ma 'sœur,",
      "'son-ge_à la dou-'ceur",
    ],
    [ // Villanelle (Gautier, 1838)
      "Quand vien-'dra la sai-'son nou-'vel-le,",
      "quand au-'ront dis-pa-'ru les 'froids,",
    ],
    [ // À la claire fontaine (traditional)
      "À la 'clai-re fon-'tai-ne",
      "m'en al-'lant pro-me-'ner,",
    ],
    [ // Il est né, le divin Enfant (traditional)
      "Il est 'né, le di-'vin En-'fant,",
      "'jou-ez, haut-'bois, ré-son-'nez, mu-'set-tes!",
    ],
    [ // Alouette (traditional)
      "A-lou-'et-te, gen-'til-le_a-lou-'et-te,",
      "a-lou-'et-te, je te plu-me-'rai.",
    ],
    [ // Le Temps des cerises (Clément, 1866)
      "Quand nous chan-te-'rons le 'temps des ce-'ri-ses,",
      "et 'gai ros-si-'gnol et 'mer-le mo-'queur",
    ],
    [ // Sonnets pour Hélène (Ronsard, 1578)
      "Quand vous se-'rez bien 'vieil-le_au 'soir, à la chan-'del-le,",
      "as-'si-se_au-'près du 'feu, de-vi-'dant et fi-'lant,",
    ],
    [ // Si mes vers avaient des ailes (Hugo, 1838)
      "Mes 'vers fui-'raient, doux et 'frê-les,",
      "vers 'vo-tre jar-'din si 'beau,",
    ],
    [ // Ah! vous dirai-je, maman (traditional)
      "Ah! vous di-'rai-je, ma-'man,",
      "ce qui 'cau-se mon tour-'ment?",
    ],
    [ // Auprès de ma blonde (traditional)
      "Au-'près de ma 'blon-de,",
      "qu'il fait 'bon, fait 'bon, fait 'bon,",
    ],
    [ // Venise (Musset, 1830)
      "Dans Ve-'ni-se la 'rou-ge,",
      "pas un ba-'teau qui 'bou-ge,",
    ],
    [ // Le Lac (Lamartine, 1820)
      "Ô 'temps, sus-'pends ton 'vol! et 'vous, heu-res pro-'pi-ces,",
      "sus-pen-'dez vo-tre 'cours!",
    ],
    [ // Carmen, Habanera (Meilhac & Halévy, 1875)
      "L'a-'mour est un oi-'seau re-'bel-le",
      "que 'nul ne 'peut ap-pri-voi-'ser,",
    ],
    [ // Faust, Salut, demeure (Barbier & Carré, 1859)
      "Sa-'lut, de-'meu-re 'chas-te_et 'pu-re,",
      "où se de-'vi-ne la pré-'sen-ce",
    ],
    [ // Samson et Dalila (Lemaire, 1877)
      "Mon 'cœur s'ou-vre_à ta 'voix",
      "'com-me s'ou-vrent les 'fleurs",
    ],
    [ // Oceano Nox (Hugo, 1836)
      "Oh! com-'bien de ma-'rins, com-'bien de ca-pi-'tai-nes",
      "qui sont par-'tis jo-'yeux pour des 'cour-ses loin-'tai-nes,",
    ],
    [ // Harmonie du soir (Baudelaire, 1857)
      "Voi-ci ve-'nir les 'temps où vi-'brant sur sa 'ti-ge",
      "cha-que 'fleur s'é-va-'pore_ain-si qu'un en-cen-'soir;",
    ],
    [ // Fantaisie (Nerval, 1832)
      "Il est un 'air pour qui je don-ne-'rais",
      "tout Ros-'si-ni, tout Mo-'zart et tout 'We-ber,",
    ],
    [ // J'ai du bon tabac (traditional)
      "J'ai du 'bon ta-'bac dans ma ta-ba-'tiè-re,",
      "j'ai du 'bon ta-'bac, tu n'en au-ras 'pas.",
    ],
    [ // Il était une bergère (traditional)
      "Il é-'tait u-ne ber-'gè-re,",
      "et ron, 'ron, ron, pe-tit pa-ta-'pon;",
    ],
    [ // Dodo, l'enfant do (traditional)
      "Do-'do, l'en-'fant 'do,",
      "l'en-'fant dor-mi-ra bien-'tôt.",
    ],
    [ // Chanson d'automne (Verlaine, 1866), continued
      "'Bles-sent mon 'cœur",
      "d'u-ne lan-'gueur mo-no-'to-ne.",
    ],
  ],
  ru: [
    [ // Я вас любил (Пушкин, 1829)
      "Я 'вас лю-'бил: лю-'бовь е-'щё, быть 'мо-жет,",
      "в ду-'ше мо-'ей у-'гас-ла 'не со-'всем;",
    ],
    [ // Зимний вечер (Пушкин, 1825)
      "'Бу-ря 'мгло-ю 'не-бо 'кро-ет,",
      "'вих-ри 'снеж-ны-е кру-'тя;",
    ],
    [ // На холмах Грузии (Пушкин, 1829)
      "На хол-'мах 'Гру-зи-и ле-'жит 'ноч-на-я 'мгла;",
      "шу-'мит А-'раг-ва пре-до 'мно-ю.",
    ],
    [ // Тучи (Лермонтов, 1840)
      "'Туч-ки не-'бес-ны-е, 'веч-ны-е 'стран-ни-ки!",
      "'Сте-пью ла-'зур-но-ю, 'цепь-ю жем-'чуж-но-ю",
    ],
    [ // Горные вершины (Лермонтов, 1840)
      "'Гор-ны-е вер-'ши-ны",
      "'спят во 'тьме 'ноч-ной;",
    ],
    [ // Умом Россию не понять (Тютчев, 1866)
      "У-'мом Рос-'си-ю не по-'нять,",
      "ар-'ши-ном 'об-щим не из-'ме-рить:",
    ],
    [ // К. Б. (Тютчев, 1870)
      "Я 'встре-тил 'вас, и 'всё бы-'ло-е",
      "в от-'жив-шем 'серд-це 'о-жи-'ло;",
    ],
    [ // Шёпот, робкое дыханье (Фет, 1850)
      "'Шё-пот, 'роб-ко-е ды-'ха-нье,",
      "'тре-ли со-ло-'вья,",
    ],
    [ // Я пришёл к тебе с приветом (Фет, 1843)
      "Я при-'шёл к те-'бе с при-'ве-том,",
      "рас-ска-'зать, что 'солн-це 'вста-ло,",
    ],
    [ // Узник (Пушкин, 1822)
      "'Си-жу за ре-'шёт-кой в тем-'ни-це сы-'рой.",
      "Вскорм-'лён-ный в не-'во-ле о-'рёл мо-ло-'дой,",
    ],
    [ // Ангел (Лермонтов, 1831)
      "По 'не-бу по-'лу-но-чи 'ан-гел ле-'тел,",
      "и 'ти-ху-ю 'пес-ню он 'пел;",
    ],
    [ // Цветок (Пушкин, 1828)
      "Цве-'ток за-'сох-ший, без-у-'хан-ный,",
      "за-'бы-тый в 'кни-ге 'ви-жу 'я;",
    ],
    [ // Крестьянские дети (Некрасов, 1861)
      "Од-'наж-ды, в сту-'дё-ну-ю 'зим-ню-ю 'по-ру,",
      "я из 'ле-су 'вы-шел; был 'силь-ный мо-'роз.",
    ],
    [ // Калинка (Ларионов, 1860)
      "Ка-'лин-ка, ка-'лин-ка, ка-'лин-ка мо-'я!",
      "В са-'ду я-'го-да ма-'лин-ка, ма-'лин-ка мо-'я!",
    ],
    [ // Во поле берёза стояла (народная)
      "Во 'по-ле бе-'рё-за сто-'я-ла,",
      "во 'по-ле ку-'дря-ва-я сто-'я-ла,",
    ],
    [ // Пророк (Пушкин, 1826)
      "Ду-'хов-ной 'жаж-до-ю то-'мим,",
      "в пу-'сты-не 'мрач-ной 'я вла-'чил-ся,",
    ],
    [ // Exegi monumentum (Пушкин, 1836)
      "Я 'па-мят-ник се-'бе воз-'двиг не-ру-ко-'твор-ный,",
      "к не-'му не за-рас-'тёт на-'род-на-я тро-'па,",
    ],
    [ // Берёза (Есенин, 1913)
      "'Бе-ла-я бе-'рё-за",
      "под мо-'им ок-'ном",
    ],
    [ // Ночь, улица, фонарь, аптека (Блок, 1912)
      "'Ночь, 'у-ли-ца, фо-'нарь, ап-'те-ка,",
      "бес-'смыс-лен-ный и 'туск-лый 'свет.",
    ],
    [ // Сказка о царе Салтане (Пушкин, 1831)
      "Три де-'ви-цы под ок-'ном",
      "'пря-ли 'позд-но 'ве-чер-'ком.",
    ],
    [ // Руслан и Людмила (Пушкин, 1828)
      "У лу-ко-'мо-рья 'дуб зе-'лё-ный;",
      "зла-'та-я 'цепь на 'ду-бе 'том:",
    ],
    [ // Весенние воды (Тютчев, 1830)
      "Е-'щё в по-'лях бе-'ле-ет 'снег,",
      "а 'во-ды 'уж 'вес-ной шу-'мят,",
    ],
    [ // Няне (Пушкин, 1826)
      "По-'дру-га 'дней мо-'их су-'ро-вых,",
      "го-'луб-ка 'дрях-ла-я мо-'я!",
    ],
    [ // Чудная картина (Фет, 1842)
      "'Чуд-на-я кар-'ти-на,",
      "как ты мне род-'на:",
    ],
    [ // Зимняя дорога (Пушкин, 1826)
      "Сквозь вол-'ни-сты-е ту-'ма-ны",
      "про-би-'ра-ет-ся лу-'на,",
    ],
  ],
  zh: [
    [ // 鹿柴 (王维)
      '空空kōng 山山shān 不不bù 见見jiàn 人人rén',
      '但但dàn 闻聞wén 人人rén 语語yǔ 响響xiǎng',
    ],
    [ // 竹里馆 (王维)
      '独獨dú 坐坐zuò 幽幽yōu 篁篁huáng 里裏lǐ',
      '弹彈tán 琴琴qín 复復fù 长長cháng 啸嘯xiào',
    ],
    [ // 江雪 (柳宗元)
      '千千qiān 山山shān 鸟鳥niǎo 飞飛fēi 绝絕jué',
      '万萬wàn 径徑jìng 人人rén 踪蹤zōng 灭滅miè',
    ],
    [ // 独坐敬亭山 (李白)
      '众眾zhòng 鸟鳥niǎo 高高gāo 飞飛fēi 尽盡jìn',
      '孤孤gū 云雲yún 独獨dú 去去qù 闲閒xián',
    ],
    [ // 寻隐者不遇 (贾岛)
      '松松sōng 下下xià 问問wèn 童童tóng 子子zǐ',
      '言言yán 师師shī 采採cǎi 药藥yào 去去qù',
    ],
    [ // 悯农 (李绅)
      '锄鋤chú 禾禾hé 日日rì 当當dāng 午午wǔ',
      '汗汗hàn 滴滴dī 禾禾hé 下下xià 土土tǔ',
    ],
    [ // 咏鹅 (骆宾王)
      '鹅鵝é 鹅鵝é 鹅鵝é',
      '曲曲qū 项項xiàng 向向xiàng 天天tiān 歌歌gē',
      '白白bái 毛毛máo 浮浮fú 绿綠lǜ 水水shuǐ',
      '红紅hóng 掌掌zhǎng 拨撥bō 清清qīng 波波bō',
    ],
    [ // 鸟鸣涧 (王维)
      '人人rén 闲閒xián 桂桂guì 花花huā 落落luò',
      '夜夜yè 静靜jìng 春春chūn 山山shān 空空kōng',
    ],
    [ // 早发白帝城 (李白)
      '朝朝zhāo 辞辭cí 白白bái 帝帝dì 彩彩cǎi 云雲yún 间間jiān',
      '千千qiān 里里lǐ 江江jiāng 陵陵líng 一一yí 日日rì 还還huán',
    ],
    [ // 望庐山瀑布 (李白)
      '日日rì 照照zhào 香香xiāng 炉爐lú 生生shēng 紫紫zǐ 烟煙yān',
      '遥遙yáo 看看kàn 瀑瀑pù 布布bù 挂掛guà 前前qián 川川chuān',
    ],
    [ // 绝句 (杜甫)
      '两兩liǎng 个個gè 黄黃huáng 鹂鸝lí 鸣鳴míng 翠翠cuì 柳柳liǔ',
      '一一yì 行行háng 白白bái 鹭鷺lù 上上shàng 青青qīng 天天tiān',
    ],
    [ // 咏柳 (贺知章)
      '碧碧bì 玉玉yù 妆妝zhuāng 成成chéng 一一yí 树樹shù 高高gāo',
      '万萬wàn 条條tiáo 垂垂chuí 下下xià 绿綠lǜ 丝絲sī 绦縧tāo',
    ],
    [ // 回乡偶书 (贺知章)
      '少少shào 小小xiǎo 离離lí 家家jiā 老老lǎo 大大dà 回回huí',
      '乡鄉xiāng 音音yīn 无無wú 改改gǎi 鬓鬢bìn 毛毛máo 衰衰shuāi',
    ],
    [ // 九月九日忆山东兄弟 (王维)
      '独獨dú 在在zài 异異yì 乡鄉xiāng 为為wéi 异異yì 客客kè',
      '每每měi 逢逢féng 佳佳jiā 节節jié 倍倍bèi 思思sī 亲親qīn',
    ],
    [ // 出塞 (王昌龄)
      '秦秦qín 时時shí 明明míng 月月yuè 汉漢hàn 时時shí 关關guān',
      '万萬wàn 里里lǐ 长長cháng 征征zhēng 人人rén 未未wèi 还還huán',
    ],
    [ // 凉州词 (王之涣)
      '黄黃huáng 河河hé 远遠yuǎn 上上shàng 白白bái 云雲yún 间間jiān',
      '一一yí 片片piàn 孤孤gū 城城chéng 万萬wàn 仞仞rèn 山山shān',
    ],
    [ // 山行 (杜牧)
      '远遠yuǎn 上上shàng 寒寒hán 山山shān 石石shí 径徑jìng 斜斜xié',
      '白白bái 云雲yún 生生shēng 处處chù 有有yǒu 人人rén 家家jiā',
    ],
    [ // 清明 (杜牧)
      '清清qīng 明明míng 时時shí 节節jié 雨雨yǔ 纷紛fēn 纷紛fēn',
      '路路lù 上上shàng 行行xíng 人人rén 欲欲yù 断斷duàn 魂魂hún',
    ],
    [ // 枫桥夜泊 (张继)
      '月月yuè 落落luò 乌烏wū 啼啼tí 霜霜shuāng 满滿mǎn 天天tiān',
      '江江jiāng 枫楓fēng 渔漁yú 火火huǒ 对對duì 愁愁chóu 眠眠mián',
    ],
    [ // 赠汪伦 (李白)
      '李李lǐ 白白bái 乘乘chéng 舟舟zhōu 将將jiāng 欲欲yù 行行xíng',
      '忽忽hū 闻聞wén 岸岸àn 上上shàng 踏踏tà 歌歌gē 声聲shēng',
    ],
    [ // 饮湖上初晴后雨 (苏轼)
      '水水shuǐ 光光guāng 潋瀲liàn 滟灩yàn 晴晴qíng 方方fāng 好好hǎo',
      '山山shān 色色sè 空空kōng 蒙濛méng 雨雨yǔ 亦亦yì 奇奇qí',
    ],
    [ // 小池 (杨万里)
      '泉泉quán 眼眼yǎn 无無wú 声聲shēng 惜惜xī 细細xì 流流liú',
      '树樹shù 阴陰yīn 照照zhào 水水shuǐ 爱愛ài 晴晴qíng 柔柔róu',
    ],
    [ // 泊船瓜洲 (王安石)
      '京京jīng 口口kǒu 瓜瓜guā 洲洲zhōu 一一yì 水水shuǐ 间間jiān',
      '钟鍾zhōng 山山shān 只只zhǐ 隔隔gé 数數shù 重重chóng 山山shān',
    ],
    [ // 赋得古原草送别 (白居易)
      '离離lí 离離lí 原原yuán 上上shàng 草草cǎo',
      '一一yí 岁歲suì 一一yì 枯枯kū 荣榮róng',
    ],
    [ // 宿建德江 (孟浩然)
      '移移yí 舟舟zhōu 泊泊bó 烟煙yān 渚渚zhǔ',
      '日日rì 暮暮mù 客客kè 愁愁chóu 新新xīn',
    ],
    [ // 望洞庭 (刘禹锡)
      '湖湖hú 光光guāng 秋秋qiū 月月yuè 两兩liǎng 相相xiāng 和和hé',
      '潭潭tán 面面miàn 无無wú 风風fēng 镜鏡jìng 未未wèi 磨磨mó',
    ],
  ],
};
for (const k of Object.keys(MORE)) CORPUS[k].push(...MORE[k]);

/* Chinese folk songs (traditional / anonymous) */
CORPUS.zh.push(
  [ // 茉莉花 (江苏民歌)
    '好好hǎo 一一yì 朵朵duǒ 美美měi 丽麗lì 的的de 茉茉mò 莉莉lì 花花huā',
    '芬芬fēn 芳芳fāng 美美měi 丽麗lì 满滿mǎn 枝枝zhī 桠椏yā',
    '又又yòu 香香xiāng 又又yòu 白白bái 人人rén 人人rén 夸誇kuā',
  ],
  [ // 小白菜 (河北民歌)
    '小小xiǎo 白白bái 菜菜cài 呀呀ya 地地dì 里裏lǐ 黄黃huáng 呀呀ya',
    '两兩liǎng 三三sān 岁歲suì 呀呀ya 没沒méi 了了le 娘娘niáng 呀呀ya',
  ],
  [ // 孟姜女 (江南民歌)
    '正正zhēng 月月yuè 里裏lǐ 来來lái 是是shì 新新xīn 春春chūn',
    '家家jiā 家家jiā 户戶hù 户戶hù 点點diǎn 红紅hóng 灯燈dēng',
  ],
  [ // 凤阳花鼓 (安徽民歌)
    '左左zuǒ 手手shǒu 锣鑼luó 右右yòu 手手shǒu 鼓鼓gǔ',
    '手手shǒu 拿拿ná 着著zhe 锣鑼luó 鼓鼓gǔ 来來lái 唱唱chàng 歌歌gē',
  ],
  [ // 月儿弯弯照九州 (宋代民歌)
    '月月yuè 儿兒ér 弯彎wān 弯彎wān 照照zhào 九九jiǔ 州州zhōu',
    '几幾jǐ 家家jiā 欢歡huān 乐樂lè 几幾jǐ 家家jiā 愁愁chóu',
  ],
  [ // 太阳出来喜洋洋 (四川民歌)
    '太太tài 阳陽yáng 出出chū 来來lái 喜喜xǐ 洋洋yáng 洋洋yáng',
    '挑挑tiāo 起起qǐ 扁扁biǎn 担擔dàn 上上shàng 山山shān 冈岡gāng',
  ],
  [ // 敕勒歌 (北朝民歌)
    '敕敕chì 勒勒lè 川川chuān 阴陰yīn 山山shān 下下xià',
    '天天tiān 似似sì 穹穹qióng 庐廬lú 笼籠lǒng 盖蓋gài 四四sì 野野yě',
    '天天tiān 苍蒼cāng 苍蒼cāng 野野yě 茫茫máng 茫茫máng',
    '风風fēng 吹吹chuī 草草cǎo 低低dī 见見xiàn 牛牛niú 羊羊yáng',
  ],
  [ // 江南 (汉乐府)
    '江江jiāng 南南nán 可可kě 采採cǎi 莲蓮lián',
    '莲蓮lián 叶葉yè 何何hé 田田tián 田田tián',
  ],
  [ // 长歌行 (汉乐府)
    '青青qīng 青青qīng 园園yuán 中中zhōng 葵葵kuí',
    '朝朝zhāo 露露lù 待待dài 日日rì 晞晞xī',
  ],
  [ // 木兰辞 (北朝民歌)
    '唧唧jī 唧唧jī 复復fù 唧唧jī 唧唧jī',
    '木木mù 兰蘭lán 当當dāng 户戶hù 织織zhī',
  ],
);

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
      return { text: lang === 'zhS' ? simp : trad, sub: tok.slice(2), orig: tok.slice(2), stress: i % 2 === 0, wordEnd: true };
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
      const orig = text; // as written in the source script (Cyrillic for Russian): for the singing voice
      if (lang === 'ruLat') {
        // keep punctuation, transliterate letters
        const m = text.match(/^(.*?)([.,;:!?]*)$/);
        text = latin(m[1].replace(/‿/g, ' '), stress, prevChar).replace(/ /g, '‿') + m[2];
        prevChar = raw.replace(/[_.,;:!?]/g, '').replace(/^'/, '').slice(-1).toLowerCase();
      }
      out.push({ text, orig, stress, wordEnd: k === syls.length - 1 });
    });
  }
  return out;
}

/**
 * Lines of verse for a phrase: a poem from the start, continuing with another poem if needed.
 * @returns {{sylls:{text:string, sub?:string, stress:boolean, wordEnd:boolean}[]}[]}
 */
const bags = {}, lastPoem = {};
export function lyricLines(lang, count = 8) {
  const key = lang === 'ruLat' ? 'ru' : lang === 'zhS' || lang === 'zhT' ? 'zh' : lang;
  const poems = CORPUS[key];
  if (!poems) return [];
  // a shuffled deck per language: every poem comes up once before any repeats
  if (!bags[key]?.length) {
    const last = lastPoem[key];
    bags[key] = [...poems.keys()].sort(() => Math.random() - 0.5);
    if (bags[key].length > 1 && bags[key][bags[key].length - 1] === last) bags[key].unshift(bags[key].pop());
  }
  // the phrase starts with the next poem from the deck; long phrases continue with random others
  const first = bags[key].pop();
  lastPoem[key] = first;
  const order = [first, ...[...poems.keys()].filter((k) => k !== first).sort(() => Math.random() - 0.5)];
  const lines = [];
  for (const pi of order) {
    for (const line of poems[pi]) lines.push({ sylls: parseLine(line, lang) });
    if (lines.length >= count) break;
  }
  return lines;
}
