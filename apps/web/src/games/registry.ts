import type { ComponentType } from 'react';
import type { TemplateKey } from '@happyclass/game-core/templates';
import type { TemplateProps } from './shell/types';
import { BingoTemplate } from './templates/bingo';
import { BubbleSpellingTemplate } from './templates/bubble-spelling';
import { HiddenPictureTemplate } from './templates/hidden-picture';
import { MysteryDoorsTemplate } from './templates/mystery-doors';
import { PictureMatchTemplate } from './templates/picture-match';
import { PhonicsFamilyTemplate } from './templates/phonics-family';
import { ClassroomExploreTemplate } from './templates/classroom-explore';
import { ShadowGuessTemplate } from './templates/shadow-guess';
import { PicturePuzzleTemplate } from './templates/picture-puzzle';
import { QuizTemplate } from './templates/quiz';
import { TrailBoardTemplate } from './templates/trail-board';
import { SentenceOrderTemplate } from './templates/sentence-order';
import { SpellingTemplate } from './templates/spelling';
import { SyllableBuilderTemplate } from './templates/syllable-builder';
import { ToneFinderTemplate } from './templates/tone-finder';
import { WordSortTemplate } from './templates/word-sort';

/** Thêm template mới: viết component + schema trong game-core, rồi đăng ký ở đây. Không sửa Shell. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TEMPLATE_COMPONENTS: Record<TemplateKey, ComponentType<TemplateProps<any>>> = {
  bingo: BingoTemplate,
  'picture-match': PictureMatchTemplate,
  'phonics-family': PhonicsFamilyTemplate,
  'classroom-explore': ClassroomExploreTemplate,
  'shadow-guess': ShadowGuessTemplate,
  'picture-puzzle': PicturePuzzleTemplate,
  quiz: QuizTemplate,
  'trail-board': TrailBoardTemplate,
  'hidden-picture': HiddenPictureTemplate,
  'mystery-doors': MysteryDoorsTemplate,
  'bubble-spelling': BubbleSpellingTemplate,
  spelling: SpellingTemplate,
  'syllable-builder': SyllableBuilderTemplate,
  'tone-finder': ToneFinderTemplate,
  'word-sort': WordSortTemplate,
  'sentence-order': SentenceOrderTemplate,
};
