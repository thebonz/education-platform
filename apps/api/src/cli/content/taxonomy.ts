import type { Taxonomy } from './types';

/** Cấp độ và danh mục ban đầu. Admin bổ sung được sau; seed chỉ tạo mục còn thiếu. */
export const TAXONOMY: Taxonomy = {
  english: {
    levels: [
      ['preschool', 'Preschool'],
      ['kindergarten', 'Kindergarten'],
      ['primary', 'Primary School'],
      ['pre-a1', 'Pre-A1 Starters'],
      ['a1', 'A1 Movers'],
      ['a2', 'A2 Flyers'],
    ],
    categories: [
      ['alphabet', 'Alphabet Games'], ['phonics', 'Phonics Games'], ['vocabulary', 'Vocabulary Games'],
      ['spelling', 'Spelling Games'], ['grammar', 'Grammar Games'], ['listening', 'Listening Games'],
      ['speaking', 'Speaking Games'], ['reading', 'Reading Games'], ['writing', 'Writing Games'],
      ['bingo', 'Bingo Games'], ['hidden-picture', 'Hidden Picture Games'], ['team-games', 'Team Games'],
      ['solo-games', 'Solo Games'], ['random-picker', 'Random Student Picker'], ['classroom', 'Classroom Games'],
      ['building', 'Building Games'], ['matching', 'Matching Games'], ['memory', 'Memory Games'],
      ['quiz', 'Quiz Games'], ['flashcards', 'Flashcard Games'],
    ],
  },
  vietnamese: {
    levels: [
      ['mam-non', 'Mầm non'], ['lop-1', 'Lớp 1'], ['lop-2', 'Lớp 2'], ['lop-3', 'Lớp 3'], ['lop-4', 'Lớp 4'], ['lop-5', 'Lớp 5'],
    ],
    categories: [
      ['chu-cai', 'Chữ cái'], ['tu-vung', 'Từ vựng'], ['dau-thanh', 'Dấu thanh'],
      ['van-va-tieng', 'Vần và tiếng'], ['chinh-ta', 'Chính tả'], ['do-vui', 'Đố vui'],
    ],
  },
};
