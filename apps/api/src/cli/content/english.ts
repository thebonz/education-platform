import { emoji, GamePack } from './types';
import { ENGLISH_WORD_BANK } from './english-word-bank';

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const ENGLISH_GAMES: GamePack[] = [
  {
    product: 'english', slug: 'alphabet-bingo', title: 'Alphabet Bingo', templateKey: 'bingo',
    summary: 'Listen to each letter, find it on your board and get a line to call BINGO!',
    category: 'bingo', level: 'kindergarten', difficulty: 'easy', accessLevel: 'FREE', sortOrder: 1, revision: 2, published: true,
    data: {
      instructions: 'Listen to the letter. Find it on your board and tap it. Complete a row, a column or a diagonal to win!',
      boardSize: 4, win: 'line', showCallText: false,
      items: letters.map((l) => ({ id: l.toLowerCase(), text: l, say: l })),
    },
  },
  {
    product: 'english', slug: 'vocabulary-matching', title: 'Animal Match', templateKey: 'picture-match',
    summary: 'Explore 12 illustrated animals. Every replay brings a fresh group of 6 English words.',
    category: 'matching', level: 'pre-a1', difficulty: 'easy', accessLevel: 'FREE', sortOrder: 2, revision: 3, published: true,
    data: {
      instructions: 'Look at the illustrated animals, listen to American English and match the words. Play again for a different set!',
      roundSize: 6,
      pairs: ENGLISH_WORD_BANK.animals.map(({ id, word, picture }) => ({ id, word, picture })),
    },
  },
  {
    product: 'english', slug: 'hidden-picture', title: 'Hidden Picture', templateKey: 'hidden-picture',
    summary: 'Reveal an illustrated animal with six questions. Play again to discover a new picture and new questions!',
    category: 'hidden-picture', level: 'pre-a1', difficulty: 'easy', accessLevel: 'FREE', sortOrder: 3, revision: 3, published: true,
    data: {
      instructions: 'Each correct answer opens a tile. Look at the illustrated animal and guess its English name!',
      // Legacy fallback for saved/admin-edited content; six additional scenes rotate per replay.
      picture: ENGLISH_WORD_BANK.animals.find((x) => x.id === 'cat')!.picture, pictureAnswer: 'cat', pictureChoices: ['cat', 'dog', 'rabbit'],
      scenes: [
        { picture: ENGLISH_WORD_BANK.animals.find((x) => x.id === 'cat')!.picture, answer: 'cat', choices: ['cat', 'dog', 'rabbit'] },
        { picture: ENGLISH_WORD_BANK.animals.find((x) => x.id === 'dog')!.picture, answer: 'dog', choices: ['cow', 'dog', 'lion'] },
        { picture: ENGLISH_WORD_BANK.animals.find((x) => x.id === 'lion')!.picture, answer: 'lion', choices: ['lion', 'turtle', 'bee'] },
        { picture: ENGLISH_WORD_BANK.animals.find((x) => x.id === 'fish')!.picture, answer: 'fish', choices: ['bird', 'frog', 'fish'] },
        { picture: ENGLISH_WORD_BANK.animals.find((x) => x.id === 'bird')!.picture, answer: 'bird', choices: ['bird', 'duck', 'cow'] },
        { picture: ENGLISH_WORD_BANK.animals.find((x) => x.id === 'rabbit')!.picture, answer: 'rabbit', choices: ['pig', 'rabbit', 'bee'] },
      ],
      questionsPerRound: 6,
      questions: [
        { id: 'q1', prompt: 'Which one is a colour?', choices: ['red', 'run', 'rice'], answer: 'red' },
        { id: 'q2', prompt: 'How many legs does a spider have?', choices: ['six', 'eight', 'ten'], answer: 'eight' },
        { id: 'q3', prompt: 'Choose the fruit.', choices: ['banana', 'bread', 'bus'], answer: 'banana' },
        { id: 'q4', prompt: 'Which animal can fly?', choices: ['fish', 'bird', 'cow'], answer: 'bird' },
        { id: 'q5', prompt: 'What do you wear on your feet?', choices: ['a hat', 'shoes', 'gloves'], answer: 'shoes' },
        { id: 'q6', prompt: 'Which number comes after nine?', choices: ['eight', 'ten', 'eleven'], answer: 'ten' },
        { id: 'q7', prompt: 'Which fruit is yellow and curved?', choices: ['banana', 'pear', 'cherry'], answer: 'banana', picture: ENGLISH_WORD_BANK.fruits.find((x) => x.id === 'banana')!.picture },
        { id: 'q8', prompt: 'What do you use to tell the time?', choices: ['clock', 'bag', 'pen'], answer: 'clock', picture: ENGLISH_WORD_BANK.school.find((x) => x.id === 'clock')!.picture },
        { id: 'q9', prompt: 'What do we use to write?', choices: ['pencil', 'apple', 'turtle'], answer: 'pencil' },
        { id: 'q10', prompt: 'What colour is grass?', choices: ['green', 'blue', 'purple'], answer: 'green' },
        { id: 'q11', prompt: 'Which animal can swim?', choices: ['fish', 'rabbit', 'bee'], answer: 'fish' },
        { id: 'q12', prompt: 'Which word means a group of seven days?', choices: ['week', 'year', 'hour'], answer: 'week' },
      ],
    },
  },
  {
    product: 'english', slug: 'bubble-word-garden', title: 'Bubble Word Garden', templateKey: 'bubble-spelling',
    summary: 'Grow English words from a 30-word illustrated library of animals, fruit and school objects.',
    category: 'spelling', level: 'primary', difficulty: 'medium', accessLevel: 'FREE', sortOrder: 4, revision: 3, published: true,
    data: {
      instructions: 'Look at the picture and listen. Tap the bubbles in order. Choose a unit and replay to discover new words.',
      extraBubbles: 2, wordsPerRound: 6,
      units: [
        { id: 'fruit', title: 'Fruit Market', words: ENGLISH_WORD_BANK.fruits.map(({ id, word, picture }) => ({ id, word, picture })) },
        { id: 'school', title: 'School Things', words: ENGLISH_WORD_BANK.school.map(({ id, word, picture }) => ({ id, word, picture })) },
        { id: 'animals', title: 'Animal World', words: ENGLISH_WORD_BANK.animals.map(({ id, word, picture }) => ({ id, word, picture })) },
        { id: 'farm', title: 'Farm Animals', words: ENGLISH_WORD_BANK.animals.filter(({ id }) => ['cow','pig','duck','dog','bird','bee','rabbit'].includes(id)).map(({ id, word, picture }) => ({ id, word, picture })) },
        { id: 'pets', title: 'Pets & Wildlife', words: ENGLISH_WORD_BANK.animals.filter(({ id }) => ['cat','rabbit','fish','bird','frog','lion','turtle'].includes(id)).map(({ id, word, picture }) => ({ id, word, picture })) },
      ],
    },
  },
  {
    product: 'english', slug: 'spelling-challenge', title: 'Spelling Challenge', templateKey: 'spelling',
    summary: 'Fill in the missing letters to complete each word.',
    category: 'spelling', level: 'a1', difficulty: 'medium', accessLevel: 'FREE', sortOrder: 5, revision: 2, published: true,
    data: {
      instructions: 'Listen and look at the picture. Type the whole word, then press Check.',
      mode: 'missing',
      items: [
        { id: 'rabbit', answer: 'rabbit', picture: emoji('🐰'), missing: [1, 3] },
        { id: 'orange', answer: 'orange', picture: emoji('🍊'), missing: [2, 5] },
        { id: 'purple', answer: 'purple', prompt: 'A colour: red + blue', picture: emoji('🟣'), missing: [1, 4] },
        { id: 'kitchen', answer: 'kitchen', prompt: 'The room where we cook', picture: emoji('🍳'), missing: [2, 3, 5] },
        { id: 'teacher', answer: 'teacher', prompt: 'This person works at a school', picture: emoji('🧑‍🏫'), missing: [1, 3, 6] },
        { id: 'flower', answer: 'flower', picture: emoji('🌸'), missing: [2, 4] },
        { id: 'window', answer: 'window', picture: emoji('🪟'), missing: [1, 4] },
        { id: 'umbrella', answer: 'umbrella', picture: emoji('☂️'), missing: [2, 5, 6] },
      ],
    },
  },
  {
    product: 'english', slug: 'team-quiz', title: 'Team Quiz', templateKey: 'quiz',
    summary: 'Teams take turns answering grammar and vocabulary questions. The team with the most points wins!',
    category: 'team-games', level: 'a1', difficulty: 'medium', accessLevel: 'FREE', sortOrder: 6, revision: 3, published: true,
    data: {
      instructions: 'Teams take turns. Each correct answer scores one point.',
      mode: 'teams', defaultTeams: 2, timePerQuestionSec: 20, pointsPerCorrect: 1, shuffleChoices: true, questionsPerRound: 10,
      questions: [
        { id: 'q1', prompt: 'What is the plural of "child"?', choices: ['childs', 'children', 'childes'], answer: 'children' },
        { id: 'q2', prompt: 'She ___ apples.', choices: ['like', 'likes', 'liking'], answer: 'likes' },
        { id: 'q3', prompt: 'Which word is an adjective?', choices: ['beautiful', 'quickly', 'teacher'], answer: 'beautiful' },
        { id: 'q4', prompt: 'What is the opposite of "big"?', choices: ['tall', 'small', 'long'], answer: 'small' },
        { id: 'q5', prompt: 'There ___ two cats in the garden.', choices: ['is', 'are', 'am'], answer: 'are' },
        { id: 'q6', prompt: 'I ___ to school every day.', choices: ['go', 'goes', 'going'], answer: 'go' },
        { id: 'q7', prompt: 'Which one is a day of the week?', choices: ['March', 'Monday', 'Morning'], answer: 'Monday' },
        { id: 'q8', prompt: 'What time is it?', picture: emoji('🕒'), choices: ["It's three o'clock.", "It's nine o'clock.", "It's twelve o'clock."], answer: "It's three o'clock." },
        { id: 'q9', prompt: 'Yesterday I ___ a sandwich.', choices: ['eat', 'ate', 'eaten'], answer: 'ate' },
        { id: 'q10', prompt: 'Where is the book? It is ___ the table.', choices: ['on', 'at', 'to'], answer: 'on' },
        { id: 'q11', prompt: 'I have ___ apple.', choices: ['a', 'an', 'the'], answer: 'an', picture: ENGLISH_WORD_BANK.fruits.find((x) => x.id === 'apple')!.picture },
        { id: 'q12', prompt: 'Which animal has a shell?', choices: ['turtle', 'bird', 'cow'], answer: 'turtle', picture: ENGLISH_WORD_BANK.animals.find((x) => x.id === 'turtle')!.picture },
        { id: 'q13', prompt: 'What do we use to draw a picture?', choices: ['pencil', 'spoon', 'shoe'], answer: 'pencil', picture: ENGLISH_WORD_BANK.school.find((x) => x.id === 'pencil')!.picture },
        { id: 'q14', prompt: 'She ___ a pink school bag.', choices: ['have', 'has', 'having'], answer: 'has' },
        { id: 'q15', prompt: 'The children ___ football after school.', choices: ['plays', 'playing', 'play'], answer: 'play' },
        { id: 'q16', prompt: 'What is the opposite of happy?', choices: ['sad', 'tall', 'fast'], answer: 'sad' },
        { id: 'q17', prompt: 'Which sentence is correct?', choices: ['He are my friend.', 'He is my friend.', 'He am my friend.'], answer: 'He is my friend.' },
        { id: 'q18', prompt: 'What day comes after Tuesday?', choices: ['Monday', 'Wednesday', 'Sunday'], answer: 'Wednesday' },
        { id: 'q19', prompt: 'Choose the fruit we can squeeze for juice.', choices: ['orange', 'clock', 'chair'], answer: 'orange', picture: ENGLISH_WORD_BANK.fruits.find((x) => x.id === 'orange')!.picture },
        { id: 'q20', prompt: 'I ___ reading a story now.', choices: ['am', 'is', 'are'], answer: 'am' },
      ],
    },
  },
];
