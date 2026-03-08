export type Category = 'land' | 'plaats' | 'water' | 'gebied';

export type QuizMode = 'zoek-op-kaart' | 'wat-is-dit';

export interface TopoItem {
  id: string;
  naam: string;
  categorie: Category;
  targetId: string;
  aliases?: string[];
  hint: string;
}

export interface QuizQuestion {
  item: TopoItem;
  opties: TopoItem[];
}

export interface QuizSettings {
  mode: QuizMode;
  categories: Category[];
}

export interface AnswerOutcome {
  correct: boolean;
  correctItem: TopoItem;
  gekozenItem?: TopoItem;
}
