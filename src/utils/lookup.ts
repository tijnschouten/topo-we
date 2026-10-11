import { loadLibrary, resolveGeometry } from "./geometrySources";
import type { Category, TopoItem } from "../types";
interface Claim {
  rank?: string;
  mainsnak: { datavalue?: { value: unknown } };
}
interface Entity {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, Claim[]>;
}
const cache = new Map<string, TopoItem[]>();
const endpoint = "https://www.wikidata.org/w/api.php";
async function request(params: Record<string, string>, signal: AbortSignal) {
  const response = await fetch(
    `${endpoint}?${new URLSearchParams({ ...params, format: "json", origin: "*" })}`,
    {
      signal,
      headers: {
        "Api-User-Agent": `TopoTrainer/2.0 (${location.origin}${import.meta.env.BASE_URL})`,
      },
    },
  );
  if (!response.ok)
    throw new Error(
      "Zoeken is tijdelijk niet beschikbaar. Probeer later opnieuw.",
    );
  const data = await response.json();
  if (data.error)
    throw new Error("De zoekdienst is tijdelijk druk. Probeer later opnieuw.");
  return data;
}
export function normalizeName(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
export function searchLibrary(
  items: TopoItem[],
  query: string,
  category: Category,
): TopoItem[] {
  const q = normalizeName(query);
  return items
    .filter(
      (i) =>
        i.categorie === category &&
        [i.naam, ...(i.aliases ?? [])].some((n) =>
          normalizeName(n).includes(q),
        ),
    )
    .sort(
      (a, b) =>
        Number([b.naam, ...(b.aliases ?? [])].some((n) => normalizeName(n) === q)) -
          Number([a.naam, ...(a.aliases ?? [])].some((n) => normalizeName(n) === q)) ||
        Number(b.capital ?? false) - Number(a.capital ?? false) || a.naam.length - b.naam.length,
    )
    .slice(0, 20);
}
export function entityToItem(
  entity: Entity,
  category: Category,
): TopoItem | null {
  // Wikidata coordinates describe a city; they never describe a river course or mountain boundary.
  if (category !== "plaats") return null;
  const naam = entity.labels?.nl?.value ?? entity.labels?.en?.value;
  if (!naam) return null;
  const claims =
    entity.claims?.P625?.filter((c) => c.rank !== "deprecated") ?? [];
  const p = [...claims]
    .sort(
      (a, b) => Number(b.rank === "preferred") - Number(a.rank === "preferred"),
    )
    .map((c) => c.mainsnak.datavalue?.value)
    .find((v) => {
      const c = v as
        | { longitude?: number; latitude?: number; globe?: string }
        | undefined;
      return (
        c &&
        Number.isFinite(c.longitude) &&
        Number.isFinite(c.latitude) &&
        Math.abs(c.longitude!) <= 180 &&
        Math.abs(c.latitude!) < 86 &&
        c.globe?.endsWith("/Q2")
      );
    }) as { longitude: number; latitude: number } | undefined;
  if (!p) return null;
  const source = `https://www.wikidata.org/wiki/${entity.id}`;
  return {
    id: `wikidata-${entity.id}-plaats`,
    targetId: `wikidata-${entity.id}-plaats`,
    wikidataId: entity.id,
    naam,
    categorie: "plaats",
    hint:
      entity.descriptions?.nl?.value ??
      entity.descriptions?.en?.value ??
      "Controleer de plaats op de kaart.",
    geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
    source,
    approximate: false,
    provenance: {
      provider: "Wikidata",
      version: "P625",
      url: source,
      recordId: entity.id,
      vertices: 1,
      license: "CC0",
    },
  };
}
export async function lookup(
  query: string,
  category: Category,
  signal: AbortSignal,
): Promise<TopoItem[]> {
  const key = `${category}:${normalizeName(query)}`;
  if (cache.has(key)) return cache.get(key)!;
  const all = await loadLibrary();
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const local = searchLibrary(all, query, category);
  // Metadata is returned first; only the chosen result downloads its actual geometry.
  if (local.length) {
    cache.set(key, local);
    return local;
  }
  const result = await request(
    {
      action: "wbsearchentities",
      search: query.trim(),
      language: "nl",
      uselang: "nl",
      limit: "8",
      type: "item",
    },
    signal,
  );
  const ids = (result.search ?? [])
    .map((r: { id: string }) => r.id)
    .filter((id: string) => /^Q\d+$/.test(id));
  if (!ids.length) return [];
  const details = await request(
    {
      action: "wbgetentities",
      ids: ids.join("|"),
      props: "labels|descriptions|claims",
      languages: "nl|en",
    },
    signal,
  );
  const items: TopoItem[] = [];
  for (const id of ids) {
    // GMBA's Wikidata IDs allow Dutch names to resolve to existing authoritative polygons.
    const sourced = all.filter(
      (i) => i.wikidataId === id && i.categorie === category,
    );
    if (sourced.length) items.push(...sourced);
    else {
      const city = entityToItem(details.entities[id], category);
      if (city) items.push(city);
    }
  }
  const unique = items.filter(
    (i, n) => items.findIndex((x) => x.id === i.id) === n,
  );
  cache.set(key, unique);
  return unique;
}
export { resolveGeometry };
