import { initialItems } from "../data/catalog";
import type { TopoItem } from "../types";
import { validGeometry } from "./geometryValidation";
let library: Promise<TopoItem[]> | undefined;
const geometries = new Map<string, TopoItem>(
  initialItems.map((i) => [i.id, i]),
);
const sourceFile =
  /^(?:ne-(?:country|city|river|sea)-[\w-]+|iho-[\w-]+|gmba-\d+|(?:land|plaats|water|gebied)-[a-z-]+)\.json\.gz$/;
export function isSourceReference(item: TopoItem): boolean {
  const p = item.provenance;
  return (
    !!p &&
    ["Natural Earth", "GMBA", "Marine Regions"].includes(p.provider) &&
    typeof p.file === "string" &&
    sourceFile.test(p.file) &&
    p.file === `${item.id}.json.gz` &&
    typeof p.sha256 === "string" &&
    /^[a-f0-9]{64}$/.test(p.sha256)
  );
}
export function isSourceReady(item: TopoItem): boolean {
  const shape = item.geometry?.type;
  const correctShape =
    item.categorie === "plaats"
      ? shape === "Point"
      : item.categorie === "water"
        ? ["LineString", "MultiLineString", "Polygon", "MultiPolygon"].includes(
            shape ?? "",
          )
        : ["Polygon", "MultiPolygon"].includes(shape ?? "");
  return (
    correctShape &&
    !!item.geometry &&
    validGeometry(item.geometry) &&
    !item.approximate &&
    !!item.provenance &&
    (isSourceReference(item) ||
      (item.provenance.provider === "Wikidata" &&
        item.categorie === "plaats" &&
        item.geometry.type === "Point"))
  );
}
async function readCompressed(
  file: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(`${import.meta.env.BASE_URL}geo/${file}`, {
    signal,
  });
  if (!response.ok || !response.body)
    throw new Error(
      "De brongeometrie kon niet worden geladen. Probeer opnieuw; er wordt geen schematische vervanging toegevoegd.",
    );
  // Files use a .gz suffix, independent of the host's Content-Encoding behavior.
  const bytes = new Uint8Array(await response.arrayBuffer());
  let text: string;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream === "undefined")
      throw new Error(
        "Deze browser kan de bronbestanden niet uitpakken. Gebruik een recente browser.",
      );
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    text = await new Response(stream).text();
  } else text = new TextDecoder().decode(bytes);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "Het bronbestand ontbreekt of is beschadigd. Probeer opnieuw; er wordt geen vervangende schets toegevoegd.",
    );
  }
}
export function loadLibrary(): Promise<TopoItem[]> {
  if (!library)
    library = readCompressed("index.json.gz")
      .then((data) => {
        if (
          !Array.isArray(data) ||
          !data.length ||
          !data.every((i) => typeof i.naam === "string" && isSourceReference(i))
        )
          throw new Error("De bronbibliotheek is ongeldig.");
        return data as TopoItem[];
      })
      .catch((error) => {
        library = undefined;
        throw error;
      });
  return library;
}
export async function resolveGeometry(
  item: TopoItem,
  signal?: AbortSignal,
): Promise<TopoItem> {
  // Never accept a polygon/river point from the previous hand-drawn prototype.
  const all = await loadLibrary();
  const wikidataId =
    item.wikidataId ??
    item.source?.match(/^https:\/\/www\.wikidata\.org\/wiki\/(Q\d+)$/)?.[1];
  const canonical = all.find((i) => i.id === item.id || i.targetId === item.targetId) ??
    all.find((i) => wikidataId && i.wikidataId === wikidataId && i.categorie === item.categorie);
  if (!canonical) {
    if (
      item.provenance?.provider === "Wikidata" &&
      item.categorie === "plaats" &&
      isSourceReady(item)
    )
      return item;
    throw new Error(
      `Voor ${item.naam} is geen passende brongeometrie beschikbaar. Kies een resultaat uit de bronbibliotheek.`,
    );
  }
  // Explicit source correction: the old strict terrain mask showed only a
  // tiny Ardennes fragment. Migrate this known record/hash, never arbitrary versions.
  const correctedArdennes =
    canonical.id === "gebied-ardennen" &&
    item.provenance?.provider === "GMBA" &&
    item.provenance.recordId === "15486" &&
    item.provenance.version === "2.0 Standard" &&
    item.provenance.sha256 === "3d67de8143beba5ce427cb2c3041194079fe070b371ac0a2bce91f3bc62d9d27" &&
    canonical.provenance?.version === "2.0 Broad" &&
    canonical.provenance.sha256 === "5840914988bbb9cb31fb0881262ad206895d95d361f7929da67f3984cb6c1c72";
  if (
    isSourceReference(item) &&
    item.provenance!.sha256 !== canonical.provenance!.sha256 &&
    !correctedArdennes
  )
    throw new Error("Deze oefenset gebruikt een andere bronversie.");
  if (geometries.has(canonical.id)) return geometries.get(canonical.id)!;
  const full = (await readCompressed(
    canonical.provenance!.file!,
    signal,
  )) as TopoItem;
  if (
    full.id !== canonical.id ||
    full.provenance?.sha256 !== canonical.provenance?.sha256 ||
    !isSourceReady(full) ||
    full.categorie !== canonical.categorie
  )
    throw new Error(
      "De brongeometrie komt niet overeen met het zoekresultaat.",
    );
  geometries.set(canonical.id, full);
  return full;
}
export async function hydrateSet(
  items: TopoItem[],
): Promise<{ items: TopoItem[]; unavailable: string[] }> {
  const result: TopoItem[] = [];
  const unavailable: string[] = [];
  // Bound simultaneous local file requests; upstream source data is fetched at build time.
  for (let n = 0; n < items.length; n += 4) {
    const group = await Promise.all(
      items.slice(n, n + 4).map(async (item) => {
        try {
          return await resolveGeometry(item);
        } catch {
          unavailable.push(item.naam);
          return {
            ...item,
            approximate: true,
            provenance: undefined,
            geometry: undefined,
          };
        }
      }),
    );
    for (const item of group)
      if (!result.some((i) => i.id === item.id)) result.push(item);
  }
  return { items: result, unavailable };
}
