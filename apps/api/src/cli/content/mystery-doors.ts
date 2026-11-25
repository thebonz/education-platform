import type { GamePack } from './types';

/**
 * Ngôi nhà bí mật do HappyClass tự thiết kế; câu hỏi gốc, không sử dụng
 * học liệu, artwork hoặc nội dung từ website Easy Peasy English.
 * Bản mẫu không xuất bản để giáo viên kiểm duyệt và nghe thử tiếng Anh.
 */
export const MYSTERY_DOORS_DEMOS: GamePack[] = [
  {
    product: 'english',
    slug: 'mystery-house-animals',
    title: 'Mystery House: Find the Picture',
    summary: 'Peek behind colourful doors, listen to the clue and choose the correct English word.',
    templateKey: 'mystery-doors',
    category: 'hidden-picture',
    level: 'kindergarten',
    difficulty: 'easy',
    accessLevel: 'FREE',
    sortOrder: 8,
    revision: 1,
    published: false,
    data: {
      instructions: 'Open one door at a time. Look closely at the picture, then pick the matching English word.',
      doorCount: 6,
      rounds: [
        { id: 'kitten', picture: { kind: 'emoji', value: '🐱' }, question: 'What animal can you see?',
          choices: ['cat', 'dog', 'duck'], answer: 'cat', hint: 'It likes to say meow.' },
        { id: 'apple', picture: { kind: 'emoji', value: '🍎' }, question: 'Which fruit is hiding here?',
          choices: ['apple', 'banana', 'orange'], answer: 'apple', hint: 'It can be red or green.' },
        { id: 'ball', picture: { kind: 'emoji', value: '⚽' }, question: 'Which school-play object is this?',
          choices: ['ball', 'book', 'pencil'], answer: 'ball', hint: 'Children can kick it.' },
        { id: 'bus', picture: { kind: 'emoji', value: '🚌' }, question: 'Which vehicle is behind the doors?',
          choices: ['bike', 'bus', 'boat'], answer: 'bus', hint: 'Many people can ride together.' },
      ],
    },
  },
];
