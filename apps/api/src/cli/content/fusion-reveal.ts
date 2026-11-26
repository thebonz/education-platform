import type { GamePack } from './types';
import { ENGLISH_WORD_BANK } from './english-word-bank';

/**
 * Owner-created picture vocabulary for the HappyClass dual-pattern experiment.
 * No third-party gameplay code, worksheets or media are included. The draft
 * is hidden until printing, voice and teacher suitability have been checked.
 */
const cardBank = [
  { group: 'animals', id: 'cat', choices: ['cat', 'dog', 'duck'], hint: 'It says meow.' },
  { group: 'animals', id: 'dog', choices: ['dog', 'frog', 'pig'], hint: 'It says woof.' },
  { group: 'animals', id: 'rabbit', choices: ['rabbit', 'turtle', 'fish'], hint: 'It has long ears.' },
  { group: 'animals', id: 'fish', choices: ['fish', 'cow', 'bird'], hint: 'It swims in water.' },
  { group: 'animals', id: 'bird', choices: ['bird', 'pig', 'lion'], hint: 'It has wings.' },
  { group: 'animals', id: 'lion', choices: ['lion', 'duck', 'frog'], hint: 'It has a mane.' },
  { group: 'fruits', id: 'apple', choices: ['apple', 'banana', 'pear'], hint: 'It can be red or green.' },
  { group: 'fruits', id: 'banana', choices: ['banana', 'orange', 'cherry'], hint: 'This long fruit is yellow.' },
  { group: 'fruits', id: 'orange', choices: ['orange', 'lemon', 'grape'], hint: 'A round citrus fruit.' },
  { group: 'fruits', id: 'pear', choices: ['pear', 'apple', 'lemon'], hint: 'A green fruit with a wide bottom.' },
  { group: 'school', id: 'book', choices: ['book', 'bag', 'clock'], hint: 'Open its pages to read.' },
  { group: 'school', id: 'pencil', choices: ['pencil', 'ruler', 'eraser'], hint: 'You can write or draw with it.' },
] as const;

const items = cardBank.map(({ group, id, choices, hint }) => {
  const source = ENGLISH_WORD_BANK[group].find((entry) => entry.id === id);
  if (!source) throw new Error(`Missing HappyClass Fusion Reveal picture: ${group}/${id}`);
  return { id, word: source.word, picture: source.picture, choices: [...choices], hint };
});

export const FUSION_REVEAL_DEMOS: GamePack[] = [{
  product: 'english',
  slug: 'happyclass-fusion-reveal',
  title: 'Fusion Reveal Cards',
  summary: 'Discover 12 original pictures by aligning two patterned layers, then guess each English word. Teachers can print matching A/B cards.',
  templateKey: 'fusion-reveal',
  category: 'solo-games',
  level: 'kindergarten',
  difficulty: 'easy',
  accessLevel: 'FREE',
  sortOrder: 17,
  revision: 1,
  published: false,
  data: {
    instructions: 'Slide the transparent decoder across the pattern, discover the hidden picture and choose the word. Teachers can print 145 mm matching cards.',
    stripeCount: 40,
    cardsPerRound: 3,
    items,
  },
}];
