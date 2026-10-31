import type { ComponentType } from 'react';
import type { TemplateKey } from '@happyclass/game-core/templates';
import type { TemplateProps } from './shell/types';
import { BingoTemplate } from './templates/bingo';
import { BubbleSpellingTemplate } from './templates/bubble-spelling';
import { HiddenPictureTemplate } from './templates/hidden-picture';
import { PictureMatchTemplate } from './templates/picture-match';
import { QuizTemplate } from './templates/quiz';
import { SpellingTemplate } from './templates/spelling';

/** Thêm template mới: viết component + schema trong game-core, rồi đăng ký ở đây. Không sửa Shell. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TEMPLATE_COMPONENTS: Record<TemplateKey, ComponentType<TemplateProps<any>>> = {
  bingo: BingoTemplate,
  'picture-match': PictureMatchTemplate,
  quiz: QuizTemplate,
  'hidden-picture': HiddenPictureTemplate,
  'bubble-spelling': BubbleSpellingTemplate,
  spelling: SpellingTemplate,
};
