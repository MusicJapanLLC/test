export type Source = 'talk' | 'songs' | 'movies' | 'books' | 'science' | 'comedy' | 'words';
export type Real = 'real' | 'textbook' | 'cringe';

/** One learnable item (chunk card or word). Keys are short because the data ships as one JSON file. */
export interface Card {
  id: string;
  k: 'c' | 'w';
  s: Source;
  sc: string[];
  h: string;
  ja: string;
  l: [string, string][];
  re?: Real;
  vb?: string[];
  f?: number;
  ipa?: string;
  d?: string;
  sl?: string;
  y?: string;
  n?: string;
  q?: [string, string];
  r?: string;
  c?: string;
  u?: string;
  x?: [string, string, string][];
  v?: [string, string][];
  pos?: string;
  t?: string;
  rare?: 1;
  e?: 1;
}

export type QuizKind = 'meaning' | 'gap' | 'real' | 'vibe' | 'listen' | 'build' | 'word';

export interface Quiz {
  kind: QuizKind;
  card: Card;
  prompt: string;
  line?: string;
  options: string[];
  answer: number;
  /** for the build quiz: shuffled tiles */
  tiles?: string[];
  review?: boolean;
}

export type Slide =
  | { type: 'card'; card: Card; review?: boolean }
  | { type: 'quiz'; quiz: Quiz }
  | { type: 'intro' }
  | { type: 'goal' };

export const SOURCE_LABEL: Record<Source, string> = {
  talk: 'Real Talk',
  songs: 'Songs',
  movies: 'Movies & TV',
  books: 'Classic Books',
  science: 'Science',
  comedy: 'Comedy',
  words: 'Words',
};

export const SOURCE_ICON: Record<Source, string> = {
  talk: '💬', songs: '🎵', movies: '🎬', books: '📚', science: '🔬', comedy: '🎤', words: '🔤',
};

export const SCENE_LABEL: Record<string, string> = {
  cafe: 'Cafe', bar: 'Bar & Party', pickup: 'Pickup', crush: 'Crush', dm: 'DMs & Texts', gym: 'Gym', work: 'Work',
  business: 'Business', money: 'Money', paperwork: 'Paperwork', travel: 'Travel', phone: 'Phone', online: 'Online',
  friends: 'Friends', conflict: 'Fights & Sorry', feelings: 'Feelings', daily: 'Daily', food: 'Food', music: 'Music',
  study: 'Study', faith: 'Faith', health: 'Health', shopping: 'Shopping',
};

export const VIBE_LABEL: Record<string, string> = {
  warm: 'Warm', chill: 'Chill', cold: 'Cold', rude: 'Rude', flirty: 'Flirty', worksafe: 'Work-safe', funny: 'Funny', deep: 'Deep',
};
