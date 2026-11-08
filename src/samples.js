// Short opera-aria excerpts, one per voice part, for demo playback.
// Source recordings: Istituto Centrale per i Beni Sonori ed Audiovisivi (ICBSA),
// via Wikimedia Commons, all licensed CC BY-SA 4.0. Each file is an excerpt of the
// original, downmixed to mono, loudness-normalised, cut at breaths to loop cleanly (50 ms fades) and
// re-encoded (Ogg Vorbis + MP3, 96 kbps).
// `analysisFiles` are Demucs (htdemucs_ft) isolated-vocal stems of the same clips,
// sample-aligned and equal in length to `files`, for feeding the analyzer only.
// Full attribution: samples/CREDITS.md
//
// `year` is a number only where Commons gives a specific date; otherwise null,
// with the date range Commons records in `date`.

const LICENSE = 'CC BY-SA 4.0';
const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';
const ARCHIVE = 'Istituto Centrale per i Beni Sonori ed Audiovisivi (ICBSA)';

const credit = (singer, part, opera, aria, label, date) =>
  `${singer} (${part}), Verdi: ${opera}, "${aria}" (${label}, ${date}). ` +
  `${ARCHIVE}, via Wikimedia Commons, ${LICENSE}. Excerpt, converted to mono.`;

export const SAMPLES = [
  {
    id: 'bass', part: 'Bass',
    aria: 'Il lacerato spirito', opera: 'Simon Boccanegra', composer: 'Verdi',
    singer: 'Oreste Luppi', year: 1905, date: '1905', label: 'Fonotipia',
    files: ['samples/bass.ogg', 'samples/bass.mp3'], voice: 'low',
    analysisFiles: ['samples/bass.vocals.ogg', 'samples/bass.vocals.mp3'],
    license: LICENSE, licenseUrl: LICENSE_URL,
    source: 'https://commons.wikimedia.org/wiki/File:ICBSA_Verdi_-_Simon_Boccanegra,_Il_lacerato_spirito.ogg',
    credit: credit('Oreste Luppi', 'bass', 'Simon Boccanegra', 'Il lacerato spirito', 'Fonotipia', '1905'),
    excerpt: '1:52.2–2:15.2 of original (23.0 s loop)',
  },
  {
    id: 'baritone', part: 'Baritone',
    aria: 'Di Provenza il mar, il suol', opera: 'La traviata', composer: 'Verdi',
    singer: 'Riccardo Stracciari', year: null, date: 'between 1900 and 1950', label: 'Columbia',
    files: ['samples/baritone.ogg', 'samples/baritone.mp3'], voice: 'low',
    analysisFiles: ['samples/baritone.vocals.ogg', 'samples/baritone.vocals.mp3'],
    license: LICENSE, licenseUrl: LICENSE_URL,
    source: 'https://commons.wikimedia.org/wiki/File:ICBSA_Verdi_-_La_traviata,_Di_Provenza.ogg',
    credit: credit('Riccardo Stracciari', 'baritone', 'La traviata', 'Di Provenza', 'Columbia', 'recorded between 1900 and 1950'),
    excerpt: '0:21.8–0:47.6 of original (25.8 s loop)',
  },
  {
    id: 'tenor', part: 'Tenor',
    aria: "O tu che in seno agli angeli", opera: 'La forza del destino', composer: 'Verdi',
    singer: 'Enrico Caruso', year: null, date: 'between 1900 and 1921', label: 'Grammofono',
    files: ['samples/tenor.ogg', 'samples/tenor.mp3'], voice: 'low',
    analysisFiles: ['samples/tenor.vocals.ogg', 'samples/tenor.vocals.mp3'],
    license: LICENSE, licenseUrl: LICENSE_URL,
    source: "https://commons.wikimedia.org/wiki/File:ICBSA_Verdi_-_La_forza_del_destino,_O_tu_che_in_seno_agl'angeli.ogg",
    credit: credit('Enrico Caruso', 'tenor', 'La forza del destino', "O tu che in seno agl'angeli", 'Grammofono', 'recorded before 1921'),
    excerpt: '1:22.7–1:46.3 of original (23.6 s loop)',
  },
  {
    id: 'alto', part: 'Alto',
    aria: 'Ai nostri monti ritorneremo', opera: 'Il trovatore', composer: 'Verdi',
    singer: 'Louise Homer', year: null, date: 'between 1900 and 1921', label: 'Gramophone',
    files: ['samples/alto.ogg', 'samples/alto.mp3'], voice: 'high',
    analysisFiles: ['samples/alto.vocals.ogg', 'samples/alto.vocals.mp3'],
    license: LICENSE, licenseUrl: LICENSE_URL,
    source: 'https://commons.wikimedia.org/wiki/File:ICBSA_Verdi_-_Il_trovatore,_Ai_nostri_monti_ritorneremo.ogg',
    credit: credit('Louise Homer', 'contralto, with Enrico Caruso, tenor', 'Il trovatore', 'Ai nostri monti ritorneremo', 'Gramophone', 'recorded before 1921'),
    excerpt: "1:01.7–1:30.7 of original (29.0 s loop; Azucena alone, before the tenor enters)",
  },
  {
    id: 'mezzo', part: 'Mezzo-soprano',
    aria: 'Stride la vampa', opera: 'Il trovatore', composer: 'Verdi',
    singer: 'Ebe Stignani', year: null, date: 'between 1939 and 1942', label: 'Cetra',
    files: ['samples/mezzo.ogg', 'samples/mezzo.mp3'], voice: 'high',
    analysisFiles: ['samples/mezzo.vocals.ogg', 'samples/mezzo.vocals.mp3'],
    license: LICENSE, licenseUrl: LICENSE_URL,
    source: 'https://commons.wikimedia.org/wiki/File:ICBSA_Verdi_-_Il_trovatore,_Stride_la_vampa.ogg',
    credit: credit('Ebe Stignani', 'mezzo-soprano', 'Il trovatore', 'Stride la vampa', 'Cetra', '1939–1942'),
    excerpt: '0:06.7–0:28.2 of original (21.5 s loop)',
  },
  {
    id: 'soprano', part: 'Soprano',
    aria: 'Ave Maria', opera: 'Otello', composer: 'Verdi',
    singer: 'Rosa Ponselle', year: null, date: 'between 1900 and 1959', label: 'Grammofono',
    files: ['samples/soprano.ogg', 'samples/soprano.mp3'], voice: 'high',
    analysisFiles: ['samples/soprano.vocals.ogg', 'samples/soprano.vocals.mp3'],
    license: LICENSE, licenseUrl: LICENSE_URL,
    source: 'https://commons.wikimedia.org/wiki/File:ICBSA_Verdi_-_Otello,_Ave_Maria.ogg',
    credit: credit('Rosa Ponselle', 'soprano', 'Otello', 'Ave Maria', 'Grammofono', 'recorded between 1900 and 1959'),
    excerpt: '0:52.8–1:21.6 of original (28.8 s loop)',
  },
];
