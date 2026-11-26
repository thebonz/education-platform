import type { GamePack } from './types';
import { ENGLISH_WORD_BANK } from './english-word-bank';

/**
 * HappyClass original interpretations of observed PUBLIC interaction patterns.
 * No source code, audiovisual assets, screenshots, protected text or member content
 * are taken from the reference site. Hidden until educator approval.
 */
const originalArt = (name: string) => ({ kind: 'image' as const, src: `/illustrations/phonics/${name}.svg`,
  alt: `Original HappyClass pastel illustration of a ${name}` });

const phonicsFamilies = [
  { id: 'at', ending: 'at', words: [
    { id: 'cat', word: 'cat', picture: ENGLISH_WORD_BANK.animals[0].picture },
    { id: 'hat', word: 'hat', picture: originalArt('hat') },
    { id: 'mat', word: 'mat', picture: originalArt('mat') },
  ] },
  { id: 'og', ending: 'og', words: [
    { id: 'dog', word: 'dog', picture: ENGLISH_WORD_BANK.animals[1].picture },
    { id: 'log', word: 'log', picture: originalArt('log') },
    { id: 'fog', word: 'fog', picture: originalArt('fog') },
  ] },
  { id: 'an', ending: 'an', words: [
    { id: 'fan', word: 'fan', picture: originalArt('fan') },
    { id: 'pan', word: 'pan', picture: originalArt('pan') },
    { id: 'van', word: 'van', picture: originalArt('van') },
  ] },
];

// 19 independently drawn objects (17 discoveries + 2 optional extras) in a
// rotating 6-object session. All content is written/illustrated for HappyClass.
const CLASSROOM_ORIGINALS = [
  { id: 'desk', word: 'desk', clue: 'You write on it while sitting at school.' },
  { id: 'computer', word: 'computer', clue: 'It has a screen and a keyboard.' },
  { id: 'globe', word: 'globe', clue: 'A round map of our world.' },
  { id: 'window', word: 'window', clue: 'You can look through it to see outside.' },
  { id: 'door', word: 'door', clue: 'Open it to enter the room.' },
  { id: 'notebook', word: 'notebook', clue: 'Write your notes on its pages.' },
  { id: 'scissors', word: 'scissors', clue: 'Use these carefully to cut paper.' },
  { id: 'crayons', word: 'crayons', clue: 'Use them to draw colourful pictures.' },
  { id: 'glue', word: 'glue', clue: 'It helps pieces of paper stick together.' },
  { id: 'board', word: 'board', clue: 'Your teacher writes on it.' },
].map(({ id, word, clue }) => ({
  id, word, clue,
  picture: { kind: 'image' as const, src: `/illustrations/classroom/${id}.svg`,
    alt: `Original HappyClass drawing of a classroom ${word}` },
}));
const classroomBank = [...ENGLISH_WORD_BANK.school, ...CLASSROOM_ORIGINALS];
const classroomItems = classroomBank.map((item, i, words) => ({
  id: item.id, word: item.word, picture: item.picture,
  clue: 'clue' in item ? item.clue :
    item.id === 'book' ? 'Open it and read a story!' : undefined,
  choices: [item.word, words[(i + 1) % words.length].word, words[(i + 2) % words.length].word],
}));

const animalWords = ENGLISH_WORD_BANK.animals.filter(({ id }) =>
  ['cat', 'dog', 'rabbit', 'bird', 'fish', 'lion', 'turtle', 'duck'].includes(id));
const shadowItems = animalWords.map((item, index, words) => ({
  id: item.id, word: item.word, picture: item.picture,
  silhouette: { kind: 'image' as const, src: `/illustrations/silhouettes/${item.id}.svg`,
    alt: 'Dark shape of an animal to guess' },
  hint: item.id === 'rabbit' ? 'It has two long ears.' :
    item.id === 'fish' ? 'It swims in water.' :
    item.id === 'lion' ? 'It has a fluffy mane.' : undefined,
  choices: [item.word, words[(index + 1) % words.length].word, words[(index + 2) % words.length].word],
}));

export const ENGLISH_PUBLIC_DEMO_INSPIRED: GamePack[] = [
  {
    product: 'english', slug: 'sound-family-village', title: 'Sound Family Village',
    summary: 'Listen to illustrated words and match them with the same written word-family ending.',
    templateKey: 'phonics-family', category: 'phonics', level: 'pre-a1', difficulty: 'easy',
    accessLevel: 'FREE', sortOrder: 14, revision: 1, published: false,
    data: { instructions: 'Pick a picture word and tap the house showing its ending letters. Drag on desktop or tap on a phone.',
      wordsPerRound: 6, families: phonicsFamilies },
  },
  {
    product: 'english', slug: 'little-learning-classroom', title: 'Little Learning Classroom',
    summary: 'Explore 19 original classroom illustrations. Each replay brings six new objects to discover.',
    templateKey: 'classroom-explore', category: 'solo-games', level: 'kindergarten', difficulty: 'easy',
    accessLevel: 'FREE', sortOrder: 15, revision: 2, published: false,
    data: { instructions: 'Tap a classroom picture. Listen to American English and choose the correct word.',
      wordsPerRound: 6, items: classroomItems },
  },
  {
    product: 'english', slug: 'shadow-safari-animals', title: 'Shadow Safari Animals',
    summary: 'Guess animal silhouettes, uncover their original illustrations and learn words through play.',
    templateKey: 'shadow-guess', category: 'solo-games', level: 'pre-a1', difficulty: 'easy',
    accessLevel: 'FREE', sortOrder: 16, revision: 1, published: false,
    data: { instructions: 'Look at the dark shape, choose the animal name and reveal its colourful picture!',
      wordsPerRound: 6, maxMistakes: 4, items: shadowItems },
  },
];
