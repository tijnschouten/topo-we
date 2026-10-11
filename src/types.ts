export type Category = "land" | "plaats" | "water" | "gebied";

export type QuizMode = "zoek-op-kaart" | "wat-is-dit";

export interface Provenance {
  provider: "Natural Earth" | "GMBA" | "Marine Regions" | "Wikidata";
  version: string;
  url: string;
  recordId: string;
  vertices: number;
  license: string;
  sha256?: string;
  file?: string;
  detailFile?: string;
  displayVertices?: number;
  simplificationDegrees?: number;
  minimumFeatureDegrees?: number;
  minimumFeatureAreaDegrees2?: number;
  displayProcessing?: string;
}

export interface TopoItem {
  id: string;
  naam: string;
  categorie: Category;
  targetId: string;
  geometry?: GeoJSON.Geometry;
  provenance?: Provenance;
  wikidataId?: string;
  approximate?: boolean;
  source?: string;
  aliases?: string[];
  hint: string;
  countryCode?: string;
  countryName?: string;
  regionName?: string;
  capital?: boolean;
  continent?: string;
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
