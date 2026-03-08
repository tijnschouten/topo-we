import { describe, expect, it } from 'vitest';
import { topoItems } from '../data/topoItems';
import {
  buildMultipleChoiceOptions,
  buildQuestions,
  calculateScore,
  calculateStreak,
  filterItemsByCategory
} from '../utils/quiz';

describe('quiz helpers', () => {
  it('maakt vragen zonder duplicaten voor gefilterde categorieen', () => {
    const filtered = filterItemsByCategory(topoItems, ['plaats']);
    const questions = buildQuestions(filtered, 'zoek-op-kaart', () => 0.42);
    const ids = questions.map((question) => question.item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(filtered.length);
  });

  it('berekent score en streak correct', () => {
    expect(calculateScore(3, true)).toBe(4);
    expect(calculateScore(3, false)).toBe(3);
    expect(calculateStreak(2, true)).toBe(3);
    expect(calculateStreak(4, false)).toBe(0);
  });

  it('bouwt multiple choice met precies 1 correct antwoord', () => {
    const correct = topoItems.find((item) => item.naam === 'Parijs');
    if (!correct) throw new Error('Testdata incorrect');

    const options = buildMultipleChoiceOptions(correct, topoItems, 4, () => 0.15);
    expect(options.length).toBe(4);

    const unique = new Set(options.map((item) => item.id));
    expect(unique.size).toBe(4);
    expect(options.filter((item) => item.id === correct.id)).toHaveLength(1);
  });
});
