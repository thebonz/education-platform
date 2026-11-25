import type { GamePack } from './types';
import { ENGLISH_WORD_BANK } from './english-word-bank';

/**
 * Themed activity packs drawn from original HappyClass word bank.
 * All new packs remain hidden until an educator approves language + images.
 */
export const ENGLISH_ILLUSTRATED_GAMES: GamePack[] = [
  {
    product: 'english', slug: 'fruit-market-match', title: 'Fruit Market Match',
    summary: 'Match colourful illustrated fruit with English words, six new fruits in each round.',
    templateKey: 'picture-match', category: 'matching', level: 'kindergarten',
    difficulty: 'easy', accessLevel: 'FREE', sortOrder: 10, revision: 1, published: false,
    data: {
      instructions: 'Look at the fruit picture and match it to the English word. Replay to meet more fruit!',
      roundSize: 6,
      pairs: ENGLISH_WORD_BANK.fruits.map(({ id, word, picture }) => ({ id, word, picture })),
    },
  },
  {
    product: 'english', slug: 'school-treasure-match', title: 'School Treasure Match',
    summary: 'Discover school objects with original pictures and clear American English word practice.',
    templateKey: 'picture-match', category: 'matching', level: 'pre-a1',
    difficulty: 'easy', accessLevel: 'FREE', sortOrder: 11, revision: 1, published: false,
    data: {
      instructions: 'Explore the classroom, hear each item and match the picture to its English word.',
      roundSize: 6,
      pairs: ENGLISH_WORD_BANK.school.map(({ id, word, picture }) => ({ id, word, picture })),
    },
  },
];
