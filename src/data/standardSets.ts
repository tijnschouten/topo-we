import europaSet from "./europaSet.json";
import europeCountries from "./europeCountries.json";
import type { TopoItem } from "../types";
import type { PracticeSet } from "../utils/sets";

export interface StandardSet extends PracticeSet {
  templateId: string;
  description: string;
}
const europe = europeCountries as TopoItem[];
export const standardSets: StandardSet[] = [
  {
    ...europaSet as PracticeSet,
    name: "Groep 7 - Oktober - Europa",
    templateId: "groep-7-oktober-europa",
    description: "De bestaande schoolset: landen, steden, wateren en gebergtes in Europa.",
  },
  {
    version: 1,
    name: "Europese landen",
    templateId: "europese-landen",
    description: "Landen in de Europese bronindeling, inclusief Rusland en Kosovo; zonder afhankelijke gebieden.",
    items: europe.filter(item => item.categorie === "land"),
  },
  {
    version: 1,
    name: "Europese landen + hoofdsteden",
    templateId: "europese-landen-hoofdsteden",
    description: "Europese landen met hun beschikbare hoofdsteden. Cyprus en Turkije vallen in de bron onder Azië.",
    items: europe,
  },
];
