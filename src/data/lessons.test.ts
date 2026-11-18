import { describe, expect, it } from 'vitest';
import { hu } from '../i18n/hu';
import { getLessons, LESSON_FOR_DIAGNOSIS, LESSON_IDS } from './lessons';

describe('lessons', () => {
  it('every diagnosis the engine can show links to a lesson', () => {
    const diagKeys = Object.keys(hu.diag).filter((k) => !k.startsWith('suggest'));
    for (const k of diagKeys) expect(LESSON_FOR_DIAGNOSIS[k], k).toBeDefined();
  });

  it('every lesson exists in both languages with content', () => {
    for (const lang of ['hu', 'en'] as const) {
      const lessons = getLessons(lang);
      expect(lessons.map((l) => l.id)).toEqual([...LESSON_IDS]);
      for (const l of lessons) {
        expect(l.title.length, `${lang}/${l.id}`).toBeGreaterThan(2);
        expect(l.paragraphs.length, `${lang}/${l.id}`).toBeGreaterThanOrEqual(2);
        expect(l.tips.length, `${lang}/${l.id}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
