import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starterContent } from './starters';
import { validateGameData } from './templates';

test('Mystery Doors: EN/VI teacher starter content is valid and bounded', () => {
  for (const lang of ['en', 'vi'] as const) {
    const parsed = validateGameData('mystery-doors', starterContent('mystery-doors', lang));
    assert.equal(parsed.ok, true, `${lang}: ${JSON.stringify(parsed)}`);
    if (parsed.ok) {
      assert.equal(parsed.data.doorCount, 6);
      assert.equal(parsed.data.rounds.length, 3);
      assert.ok(parsed.data.rounds.every((round) => round.choices.includes(round.answer)));
    }
  }
});

test('Mystery Doors: invalid answers, duplicate IDs and excessive rounds fail validation', () => {
  const starter = starterContent('mystery-doors', 'en') as {
    doorCount: number;
    rounds: { id: string; picture: { kind: string; value: string }; question: string; choices: string[]; answer: string }[];
  };
  const wrongAnswer = structuredClone(starter);
  wrongAnswer.rounds[0].answer = 'not in list';
  assert.equal(validateGameData('mystery-doors', wrongAnswer).ok, false);

  const duplicateChoices = structuredClone(starter);
  duplicateChoices.rounds[0].choices = ['cat', 'cat', 'dog'];
  assert.equal(validateGameData('mystery-doors', duplicateChoices).ok, false);

  const duplicateId = structuredClone(starter);
  duplicateId.rounds[1].id = duplicateId.rounds[0].id;
  assert.equal(validateGameData('mystery-doors', duplicateId).ok, false);

  const huge = structuredClone(starter);
  huge.rounds = Array.from({ length: 13 }, (_, i) => ({
    ...structuredClone(starter.rounds[0]), id: `round${i}`,
  }));
  assert.equal(validateGameData('mystery-doors', huge).ok, false);

  const invalidDoors = structuredClone(starter);
  invalidDoors.doorCount = 5;
  assert.equal(validateGameData('mystery-doors', invalidDoors).ok, false);

  const maliciousSrc = structuredClone(starter);
  (maliciousSrc.rounds[0] as unknown as { picture: unknown }).picture = {
    kind: 'image', src: 'javascript:alert(1)', alt: 'Bad URL',
  };
  assert.equal(validateGameData('mystery-doors', maliciousSrc).ok, false);
});
