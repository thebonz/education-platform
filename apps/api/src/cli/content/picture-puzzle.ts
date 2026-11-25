import type { GamePack } from './types';

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
    summary: 'Swap colourful pieces to discover a picture, then listen to its English name.',
    templateKey: 'picture-puzzle',
    category: 'solo-games',
    level: 'kindergarten',
    difficulty: 'easy',
    accessLevel: 'FREE',
    sortOrder: 9,
    revision: 1,
    published: false,
    data: {
      instructions: 'Swap any two picture pieces. Complete the illustration and listen to the English word.',
      size: 3,
      rounds: [
        { id: 'cat', picture: { kind: 'image', src: '/illustrations/puzzle-cat.svg', alt: 'An orange kitten sitting in a green flower meadow' }, label: 'cat' },
        { id: 'apple', picture: { kind: 'image', src: '/illustrations/puzzle-apple.svg', alt: 'A red apple with a butterfly in a sunny meadow' }, label: 'apple' },
        { id: 'bus', picture: { kind: 'image', src: '/illustrations/puzzle-bus.svg', alt: 'A yellow school bus on the way through green hills' }, label: 'bus' },
      ],
    },
  },
];
