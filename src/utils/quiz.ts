import type { Category, QuizMode, QuizQuestion, TopoItem } from '../types';

const STORAGE_KEY = 'topo-we-settings';
const BEST_SCORE_KEY = 'topo-we-best-score';

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function filterItemsByCategory(items: TopoItem[], categories: Category[]): TopoItem[] {
  const set = new Set(categories);
  return items.filter((item) => set.has(item.categorie));
}

export function buildMultipleChoiceOptions(
  correct: TopoItem,
  pool: TopoItem[],
  count = 4,
  random: () => number = Math.random
): TopoItem[] {
  const sameCategory = pool.filter(
    (item) => item.id !== correct.id && item.categorie === correct.categorie
  );
  const fallback = pool.filter((item) => item.id !== correct.id && item.categorie !== correct.categorie);
  const distractors = shuffle([...sameCategory, ...fallback], random).slice(0, Math.max(0, count - 1));
  return shuffle([correct, ...distractors], random);
}

export function buildQuestions(
  items: TopoItem[],
  mode: QuizMode,
  random: () => number = Math.random
): QuizQuestion[] {
  const ordered = shuffle(items, random);
  return ordered.map((item) => ({
    item,
    opties: mode === 'wat-is-dit' ? buildMultipleChoiceOptions(item, items, 4, random) : []
  }));
}

export function calculateScore(current: number, wasCorrect: boolean): number {
  return wasCorrect ? current + 1 : current;
}

export function calculateStreak(current: number, wasCorrect: boolean): number {
  return wasCorrect ? current + 1 : 0;
}

export function saveSettings(mode: QuizMode, categories: Category[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, categories }));
}

export function loadSettings(): { mode: QuizMode; categories: Category[] } | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { mode?: QuizMode; categories?: Category[] };
    if (!parsed.mode || !Array.isArray(parsed.categories)) return null;
    return { mode: parsed.mode, categories: parsed.categories };
  } catch {
    return null;
  }
}

export function saveBestScore(score: number): void {
  const current = loadBestScore();
  if (score > current) {
    localStorage.setItem(BEST_SCORE_KEY, String(score));
  }
}

export function loadBestScore(): number {
  const raw = localStorage.getItem(BEST_SCORE_KEY);
  const num = raw ? Number(raw) : 0;
  return Number.isFinite(num) ? num : 0;
}
