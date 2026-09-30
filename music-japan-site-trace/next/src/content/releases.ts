export type Locale = 'ja' | 'en';
export type L10n = Record<Locale, string>;

export type Release = {
  id: string;
  title: string;
  artist: string;
  group: 'yuma' | 'brand';
  /** drives how the robot crew dances and what they say */
  genre: 'hiphop' | 'jpop' | 'rnb' | 'jazz' | 'classical' | 'sleep';
  type: string;
  description: L10n;
  href: string;
  platform: 'YouTube' | 'Apple Music';
  /** Apple CDN artwork (1200px). Local copies live in /artwork/<id>-<size>x<size>bb.jpg */
  cdn: string;
  art: string;
  accent: string;
  previews: { title: string; src: string }[];
  credit: string;
};

const cdn = (path: string) => `https://is1-ssl.mzstatic.com/image/thumb/${path}/1200x1200bb.jpg`;

export const releases: Release[] = [
  {
    id: 'tokyo-junkies',
    title: 'TOKYO JUNKIES',
    artist: 'Yuma',
    group: 'yuma',
    genre: 'hiphop',
    type: 'HIP-HOP / J-POP',
    description: {
      ja: '渋谷、六本木、中野、新宿、下北を駆け抜けた若者たちの、くだらなくて最高だった“未完成の青春”を描く一曲。',
      en: 'Shibuya, Roppongi, Nakano, Shinjuku, Shimokita — a song for the young people who ran through them, and for a pointless, perfect, unfinished youth.',
    },
    href: 'https://www.youtube.com/watch?v=zODcrFkELsE',
    platform: 'YouTube',
    cdn: cdn('Music211/v4/81/3e/35/813e3593-8e71-7799-b187-eff59686790c/4550708735521_cover.png'),
    art: 'tokyo-junkies',
    accent: '#e32636',
    previews: [{ title: 'TOKYO JUNKIES', src: '/audio/tokyo-junkies-preview.mp3' }],
    credit: '℗ 2025 Yuma',
  },
  {
    id: 'kokoni-aru',
    title: 'ここにある',
    artist: 'Yuma',
    group: 'yuma',
    genre: 'jpop',
    type: 'J-POP / ELECTRONIC',
    description: {
      ja: '言葉や意味にできない感情を、夜の静けさの中でそっと肯定するJ-Pop／エレクトロニック作品。',
      en: 'A J-pop / electronic piece that quietly affirms, in the stillness of night, the feelings that words and meaning cannot hold.',
    },
    href: 'https://www.youtube.com/watch?v=zJV-EFucoks',
    platform: 'YouTube',
    cdn: cdn('Music211/v4/6c/fc/cc/6cfccce9-f950-6e70-53b9-d31edec1c65f/4550708606692_cover.png'),
    art: 'kokoni-aru',
    accent: '#d5a160',
    previews: [{ title: 'ここにある', src: '/audio/kokoni-aru-preview.mp3' }],
    credit: '℗ 2025 Yuma',
  },
  {
    id: 'beach-sunset',
    title: 'Beach Sunset',
    artist: 'Yuma',
    group: 'yuma',
    genre: 'jpop',
    type: 'J-POP · SINGLE',
    description: {
      ja: '夕焼けに染まる海辺の余韻を、淡い色彩と切なさで描いたサマーJ-Pop。',
      en: 'A summer J-pop song that paints the afterglow of a sunset beach in soft colours and quiet longing.',
    },
    href: 'https://music.apple.com/jp/album/beach-sunset-single/6787415933',
    platform: 'Apple Music',
    cdn: cdn('Music221/v4/cc/c4/82/ccc482ef-8c0a-0229-fa32-352339528175/4550758281023_cover.png'),
    art: 'beach-sunset',
    accent: '#de9a76',
    previews: [{ title: 'Beach Sunset', src: '/audio/beach-sunset-preview.mp3' }],
    credit: '℗ 2026 Music Japan LLC',
  },
  {
    id: 'i-know-but-tried',
    title: 'I know, but tried',
    artist: 'Yuma',
    group: 'yuma',
    genre: 'rnb',
    type: 'R&B · SINGLE',
    description: {
      ja: '結末は分かっていた。それでも挑み、最後には前へ進むことを選ぶ。愛と後悔と手放すことを歌った、率直なR&B。',
      en: 'He knew how it would end, tried anyway, and finally chooses to move forward—a candid R&B confession about love, regret and letting go.',
    },
    href: 'https://music.apple.com/jp/album/i-know-but-tried-single/6771033082',
    platform: 'Apple Music',
    cdn: cdn('Music211/v4/54/db/4e/54db4e60-8d52-2fb5-4e9e-ef40d527886d/4550756733272_cover.png'),
    art: 'i-know-but-tried',
    accent: '#678195',
    previews: [{ title: 'I know, but tried', src: '/audio/i-know-but-tried-preview.mp3' }],
    credit: '℗ 2026 Music Japan LLC',
  },
  {
    id: 'like-a-drug',
    title: 'Like a drug',
    artist: 'Yuma',
    group: 'yuma',
    genre: 'rnb',
    type: 'EP · 6 SONGS',
    description: {
      ja: '魅惑的で、同じだけ危うい街マイアミを舞台にした6曲。美しさと傷が、同じ光の中にある。',
      en: 'Six songs set against a Miami that feels as alluring as it is dangerous—where beauty and bruises share the same glow.',
    },
    href: 'https://music.apple.com/jp/album/like-a-drug-ep/6783291301',
    platform: 'Apple Music',
    cdn: cdn('Music221/v4/89/fd/74/89fd749f-b1af-2ec1-5100-6e0378372c9e/4550757942116_cover.png'),
    art: 'like-a-drug',
    accent: '#c12a36',
    previews: [
      { title: 'To Our Future', src: '/audio/like-a-drug-to-our-future-preview.mp3' },
      { title: 'Dream', src: '/audio/like-a-drug-dream-preview.mp3' },
      { title: 'U can', src: '/audio/like-a-drug-u-can-preview.mp3' },
    ],
    credit: '℗ 2026 Yuma',
  },
  {
    id: 'all-i-need',
    title: 'All I need',
    artist: 'Yuma',
    group: 'yuma',
    genre: 'rnb',
    type: 'R&B · SINGLE',
    description: {
      ja: 'すべてを削ぎ落として辿り着いた、ひとつの答え。必要なのは、ただひとりだけ。生々しいR&Bの告白。',
      en: 'A raw R&B confession that strips everything down to one realization: all he needs is one person.',
    },
    href: 'https://music.apple.com/jp/album/all-i-need-single/6768943324',
    platform: 'Apple Music',
    cdn: cdn('Music221/v4/ed/06/ec/ed06ec42-7833-09f4-361f-3a13b400aaff/4550756476070_cover.png'),
    art: 'all-i-need',
    accent: '#845c45',
    previews: [{ title: 'All I need', src: '/audio/all-i-need-preview.mp3' }],
    credit: '℗ 2026 Music Japan LLC',
  },
  {
    id: 'late-night-jazz',
    title: 'Late Night Jazz Lounge 2026',
    artist: 'Cozy Cafe Jazz BGM',
    group: 'brand',
    genre: 'jazz',
    type: 'JAZZ / RELAXATION',
    description: {
      ja: '都市の雨音と滑らかなピアノで、深夜のラウンジを描く全10曲のジャズ・アルバム。',
      en: 'Smooth piano and city rain for the hour when the city finally slows down.',
    },
    href: 'https://music.apple.com/us/album/late-night-jazz-lounge-2026-smooth-piano-city-rain/6785588546',
    platform: 'Apple Music',
    cdn: cdn('Music211/v4/12/0f/aa/120faa80-16d3-5b2d-422c-1903d9edd96c/artwork.jpg'),
    art: 'late-night-jazz',
    accent: '#b87b3c',
    previews: [{ title: 'Late Night Jazz Lounge 2026', src: '/audio/jazz-preview.mp3' }],
    credit: '℗ 2026 Music Japan LLC',
  },
  {
    id: 'fairytale-classical',
    title: 'Fairytale Classical Music for Study and Reading',
    artist: 'Relaxing Classical Music Live',
    group: 'brand',
    genre: 'classical',
    type: 'CLASSICAL / STUDY',
    description: {
      ja: '童話のページをめくるような穏やかな音像を、学習と読書に寄り添う15曲にまとめた作品。',
      en: 'A gentle classical world created for study, reading and quiet concentration.',
    },
    href: 'https://music.apple.com/us/album/fairytale-classical-music-for-study-and-reading/6787590947',
    platform: 'Apple Music',
    cdn: cdn('Music221/v4/25/1d/25/251d2519-284f-882f-855f-2ea548250999/artwork.jpg'),
    art: 'fairytale-classical',
    accent: '#6d839e',
    previews: [{ title: 'Fairytale Classical Music', src: '/audio/classical-preview.mp3' }],
    credit: '℗ 2026 Music Japan LLC',
  },
  {
    id: 'soft-rain-piano',
    title: 'Soft Rain Piano for Deep Sleep',
    artist: 'Deep Sleep Music Radio',
    group: 'brand',
    genre: 'sleep',
    type: 'SLEEP / AMBIENT',
    description: {
      ja: '柔らかな雨音とピアノを重ね、就寝前から静かな休息へ寄り添う全12曲。',
      en: 'Soft rain and piano, arranged as a calm threshold into deeper sleep.',
    },
    href: 'https://music.apple.com/us/album/soft-rain-piano-for-deep-sleep/6787971338',
    platform: 'Apple Music',
    cdn: cdn('Music211/v4/f2/6b/5f/f26b5fc1-d239-5782-1a30-e38af9b67cf7/artwork.jpg'),
    art: 'soft-rain-piano',
    accent: '#556b7f',
    previews: [{ title: 'Soft Rain Piano for Deep Sleep', src: '/audio/deep-sleep-preview.mp3' }],
    credit: '℗ 2026 Music Japan LLC',
  },
];

/** Same-origin artwork: the backups captured with the site. CDN URLs stay in JSON-LD only. */
export const artwork = (r: Release, size: 480 | 800 | 1200 = 800) => `/artwork/${r.art}-${size}x${size}bb.jpg`;
