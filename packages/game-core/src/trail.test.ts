import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceTrail } from './trail';
import { sessionSelection } from './learning-session';
import { createRng } from './rng';
import { starterContent } from './starters';
import { validateGameData } from './templates';

test('trail board: starter English/Vietnamese validate and default settings', () => {
  for (const locale of ['en', 'vi'] as const) {
    const starter = starterContent('trail-board', locale);
    const result = validateGameData('trail-board', starter);
    assert.ok(result.ok, `${locale}: ${JSON.stringify(!result.ok && result.issues)}`);
    if (result.ok) {
      assert.equal(result.data.boardLength, 12);
      assert.equal(result.data.diceSides, 4);
      assert.equal(result.data.defaultTeams, 2);
      assert.equal(result.data.shuffleChoices, true);
    }
  }
});

test('trail board: reject duplicate IDs, invalid answers, unsafe dice and too-short exercises', () => {
  const original = starterContent('trail-board', 'vi') as {
    boardLength: number; diceSides: number;
    questions: { id: string; prompt: string; choices: string[]; answer: string }[];
  };
  const badAnswer = structuredClone(original);
  badAnswer.questions[0].answer = 'không thuộc đáp án';
  assert.equal(validateGameData('trail-board', badAnswer).ok, false);

  const duplicate = structuredClone(original);
  duplicate.questions[1].id = duplicate.questions[0].id;
  assert.equal(validateGameData('trail-board', duplicate).ok, false);

  const short = structuredClone(original);
  short.questions = short.questions.slice(0, 2);
  assert.equal(validateGameData('trail-board', short).ok, false);

  const dice = structuredClone(original);
  dice.diceSides = 0;
  assert.equal(validateGameData('trail-board', dice).ok, false);

  const board = structuredClone(original);
  board.boardLength = 99;
  assert.equal(validateGameData('trail-board', board).ok, false);
});

test('trail movement: only correct answer moves active team, caps at goal, immutable', () => {
  const start = [0, 3, 9];
  const wrong = advanceTrail(start, 1, 4, 12, false);
  assert.deepEqual(wrong, start);
  assert.notEqual(wrong, start);
  const right = advanceTrail(start, 1, 4, 12, true);
  assert.deepEqual(right, [0, 7, 9]);
  assert.deepEqual(advanceTrail(right, 2, 6, 12, true), [0, 7, 12]);
  assert.deepEqual(start, [0, 3, 9]);
});

test('trail movement: invalid team, roll, goal and current state are rejected', () => {
  assert.throws(() => advanceTrail([0, 0], 3, 2, 12, true), RangeError);
  assert.throws(() => advanceTrail([0, 0], 0, 0, 12, true), RangeError);
  assert.throws(() => advanceTrail([0, 0], 0, 7, 12, true), RangeError);
  assert.throws(() => advanceTrail([0, 0], 0, 2, 0, true), RangeError);
  assert.throws(() => advanceTrail([0, -1], 0, 2, 12, true), RangeError);
});

test('trail board: spinner and question bank are validated; replays cover new questions', () => {
  const starter = starterContent('trail-board', 'en') as {
    rollMode?: string;
    questionsPerRound?: number;
    questions: { id: string; prompt: string; choices: string[]; answer: string }[];
  };
  const sourceQuestions = Array.from({ length: 24 }, (_, i) => ({
    ...structuredClone(starter.questions[i % starter.questions.length]),
    id: `turn-${i + 1}`,
  }));
  const content = { ...starter, rollMode: 'spinner', questionsPerRound: 10, questions: sourceQuestions };
  const result = validateGameData('trail-board', content);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.rollMode, 'spinner');
    assert.equal(result.data.questionsPerRound, 10);
  }

  const first = sessionSelection(sourceQuestions, 10, 1, createRng('quiz'));
  const second = sessionSelection(sourceQuestions, 10, 2, createRng('quiz'));
  assert.equal(first.length, 10);
  assert.equal(second.length, 10);
  assert.ok(second.every((q) => !first.some((old) => old.id === q.id)));

  assert.equal(validateGameData('trail-board', { ...content, rollMode: 'roulette' }).ok, false);
  assert.equal(validateGameData('trail-board', { ...content, questionsPerRound: 25 }).ok, false);
  assert.equal(validateGameData('trail-board', { ...content, questionsPerRound: 3 }).ok, false);
  const legacy = validateGameData('trail-board', starter);
  assert.equal(legacy.ok, true);
  if (legacy.ok) assert.equal(legacy.data.rollMode, 'dice');
});
