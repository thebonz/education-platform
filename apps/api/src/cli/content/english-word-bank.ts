/** Curated, original first-party EN vocabulary. Art assets belong to HappyClass. 
 *  Each word is a separate learnable concept; no third-party curriculum copied.
 */
export type EnglishVocabItem = {
  id: string;
  word: string;
  picture: { kind: 'image'; src: string; alt: string };
  hint?: string;
};
const item = (id: string, word: string, src: string, alt: string, hint?: string): EnglishVocabItem =>
  ({ id, word, picture: { kind: 'image', src, alt }, ...(hint ? { hint } : {}) });

export const ENGLISH_WORD_BANK: Record<'animals' | 'fruits' | 'school', EnglishVocabItem[]> = {
  animals: [
    item('cat', 'cat', '/illustrations/puzzle-cat.svg', 'A friendly orange cat in a flower meadow'),
    item('dog', 'dog', '/illustrations/vocab/dog.svg', 'A happy tan dog with floppy ears'),
    item('fish', 'fish', '/illustrations/vocab/fish.svg', 'A blue fish swimming'),
    item('bird', 'bird', '/illustrations/vocab/bird.svg', 'A little blue bird'),
    item('rabbit', 'rabbit', '/illustrations/vocab/rabbit.svg', 'A rabbit with long ears'),
    item('duck', 'duck', '/illustrations/vocab/duck.svg', 'A yellow duck'),
    item('cow', 'cow', '/illustrations/vocab/cow.svg', 'A white and black cow'),
    item('pig', 'pig', '/illustrations/vocab/pig.svg', 'A pink pig'),
    item('frog', 'frog', '/illustrations/vocab/frog.svg', 'A green frog'),
    item('bee', 'bee', '/illustrations/vocab/bee.svg', 'A yellow striped bee with wings'),
    item('lion', 'lion', '/illustrations/vocab/lion.svg', 'A lion with a brown mane'),
    item('turtle', 'turtle', '/illustrations/vocab/turtle.svg', 'A green turtle'),
  ],
  fruits: [
    item('apple', 'apple', '/illustrations/puzzle-apple.svg', 'A red apple with a butterfly'),
    item('banana', 'banana', '/illustrations/vocab/banana.svg', 'A curved yellow banana'),
    item('orange', 'orange', '/illustrations/vocab/orange.svg', 'A round orange fruit'),
    item('pear', 'pear', '/illustrations/vocab/pear.svg', 'A green pear'),
    item('lemon', 'lemon', '/illustrations/vocab/lemon.svg', 'A yellow lemon'),
    item('grape', 'grape', '/illustrations/vocab/grape.svg', 'A bunch of purple grapes'),
    item('strawberry', 'strawberry', '/illustrations/vocab/strawberry.svg', 'A red strawberry'),
    item('watermelon', 'watermelon', '/illustrations/vocab/watermelon.svg', 'A slice of watermelon'),
    item('cherry', 'cherry', '/illustrations/vocab/cherry.svg', 'Two red cherries'),
  ],
  school: [
    item('book', 'book', '/illustrations/vocab/book.svg', 'An open book'),
    item('pen', 'pen', '/illustrations/vocab/pen.svg', 'A blue writing pen'),
    item('pencil', 'pencil', '/illustrations/vocab/pencil.svg', 'A yellow pencil'),
    item('bag', 'bag', '/illustrations/vocab/bag.svg', 'A pink school bag'),
    item('ruler', 'ruler', '/illustrations/vocab/ruler.svg', 'A ruler with measurement marks'),
    item('chair', 'chair', '/illustrations/vocab/chair.svg', 'A wooden classroom chair'),
    item('eraser', 'eraser', '/illustrations/vocab/eraser.svg', 'A pink and blue eraser'),
    item('clock', 'clock', '/illustrations/vocab/clock.svg', 'A round classroom clock'),
    item('bus', 'bus', '/illustrations/puzzle-bus.svg', 'A yellow school bus on a green hillside'),
  ],
};
