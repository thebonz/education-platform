import type { GamePack } from './types';
import { ENGLISH_WORD_BANK } from './english-word-bank';

/**
 * Original HappyClass content + original licensed-by-owner SVG illustrations in
 * apps/web/public/illustrations. NOT Easy Peasy English media or lesson data.
 * Held unpublished until teacher reviews English speech, age suitability and images.
 */
export const PICTURE_PUZZLE_DEMOS: GamePack[] = [
  {
    product: 'english',
    slug: 'happyclass-picture-puzzle',
    title: 'HappyClass Picture Puzzle',
    summary: 'Explore 12 original illustrations in rotating 3-picture puzzle adventures; replay for new words.',
    templateKey: 'picture-puzzle',
    category: 'solo-games',
    level: 'kindergarten',
    difficulty: 'easy',
    accessLevel: 'FREE',
    sortOrder: 9,
    revision: 2,
    published: false,
    data: {
      instructions: 'Explore a rotating group of three pictures. Swap pieces to complete each picture and hear the English word. Play again for the next picture set.',
      size: 3,
      picturesPerRound: 3,
      rounds: [
        { id: 'cat', picture: { kind: 'image', src: '/illustrations/puzzle-cat.svg', alt: 'An orange kitten sitting in a green flower meadow' }, label: 'cat' },
        { id: 'apple', picture: { kind: 'image', src: '/illustrations/puzzle-apple.svg', alt: 'A red apple with a butterfly in a sunny meadow' }, label: 'apple' },
        { id: 'bus', picture: { kind: 'image', src: '/illustrations/puzzle-bus.svg', alt: 'A yellow school bus on the way through green hills' }, label: 'bus' },
        ...ENGLISH_WORD_BANK.animals.filter(({ id }) => ['dog', 'fish', 'bird', 'rabbit'].includes(id))
          .map(({ id, picture, word }) => ({ id, picture, label: word })),
        ...ENGLISH_WORD_BANK.fruits.filter(({ id }) => ['banana', 'orange', 'pear'].includes(id))
          .map(({ id, picture, word }) => ({ id, picture, label: word })),
        ...ENGLISH_WORD_BANK.school.filter(({ id }) => ['book', 'pencil'].includes(id))
          .map(({ id, picture, word }) => ({ id, picture, label: word })),
      ],
    },
  },
];
