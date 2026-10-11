import { validGeometry } from "./geometryValidation";
export { validGeometry } from "./geometryValidation";
import { isSourceReference } from "./geometrySources";
import type { TopoItem } from "../types";
export interface PracticeSet {
  version: 1;
  name: string;
  items: TopoItem[];
}
const key = "topo-practice-set-v1";
const categories = ["land", "plaats", "water", "gebied"];
export function parseSet(raw: string): PracticeSet {
  if (raw.length > 100_000_000)
    throw new Error("Dit bestand is te groot (maximaal 100 MB).");
  const data = JSON.parse(raw) as PracticeSet;
  if (
    !data ||
    typeof data !== "object" ||
    data.version !== 1 ||
    typeof data.name !== "string" ||
    !data.name.trim() ||
    data.name.length > 120 ||
    !Array.isArray(data.items) ||
    data.items.length > 300
  )
    throw new Error(
      "Geen geldige oefenset. Gebruik een geëxporteerd Topo-bestand (maximaal 300 locaties).",
    );
  const ids = new Set<string>();
  const targets = new Set<string>();
  for (const item of data.items) {
    if (
      !item ||
      typeof item.id !== "string" ||
      !item.id ||
      ids.has(item.id) ||
      typeof item.targetId !== "string" ||
      !item.targetId ||
      targets.has(item.targetId) ||
      typeof item.naam !== "string" ||
      !item.naam.trim() ||
      item.naam.length > 120 ||
      !categories.includes(item.categorie) ||
      typeof item.hint !== "string" ||
      (item.geometry !== undefined
        ? !validGeometry(item.geometry)
        : !isSourceReference(item))
    )
      throw new Error(
        "Een locatie heeft een ontbrekende of ongeldige naam, categorie of kaartvorm.",
      );
    ids.add(item.id);
    targets.add(item.targetId);
  }
  return data;
}
export function loadSet(): PracticeSet | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseSet(raw) : null;
  } catch {
    return null;
  }
}
export function saveSet(set: PracticeSet): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(portableSet(set)));
    return true;
  } catch {
    return false;
  }
}
export function exportSet(set: PracticeSet) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(portableSet(set), null, 2)], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${set.name.replace(/[^\p{L}\p{N}-]+/gu, "-").slice(0, 80)}.topo.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function portableSet(set: PracticeSet): PracticeSet {
  return {
    ...set,
    items: set.items.map((item) => {
      if (!isSourceReference(item)) return item;
      const { geometry: _geometry, ...reference } = item;
      return reference;
    }),
  };
}
