import { beforeEach, describe, expect, it } from "vitest";
import { catalog, initialItems, normalizeGeometry } from "../data/catalog";
import { loadSet, parseSet, saveSet, portableSet, loadCollection, saveCollection, newSavedSet, parseCollection } from "../utils/sets";
import { geoArea, geoBounds } from "d3-geo";
const data = { version: 1 as const, name: "Europa", items: initialItems };
beforeEach(() => localStorage.clear());
describe("Oefensets", () => {
  it("bewaart de volledige voorbeeldset met geometrieën", () => {
    expect(saveSet(data)).toBe(true);
    expect(loadSet()).toEqual(portableSet(data));
    expect(loadSet()?.items[0].geometry).toBeUndefined();
    expect(loadSet()?.items[0].provenance?.sha256).toHaveLength(64);
  });
  it("accepteert alle landen inclusief poolgebieden", () => {
    for (const item of catalog)
      expect(
        parseSet(JSON.stringify({ ...data, items: [item] })).items,
      ).toHaveLength(1);
  });
  it("weigert dubbele doelen en ongeldige coördinaten", () => {
    expect(() =>
      parseSet(
        JSON.stringify({ ...data, items: [initialItems[0], initialItems[0]] }),
      ),
    ).toThrow();
    expect(() =>
      parseSet(
        JSON.stringify({
          ...data,
          items: [
            {
              ...initialItems[7],
              geometry: { type: "Point", coordinates: [181, 0] },
            },
          ],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseSet(
        JSON.stringify({
          ...data,
          items: [
            {
              ...initialItems[0],
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1],
                  ],
                ],
              },
            },
          ],
        }),
      ),
    ).toThrow();
  });
  it("herstelt veilig van beschadigde opgeslagen data", () => {
    localStorage.setItem("topo-practice-set-v1", "{broken");
    expect(loadSet()).toBeNull();
  });
  it("maakt geïmporteerde GeoJSON-ringen onafhankelijk van hun winding", () => {
    const g: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [4, 50],
          [6, 50],
          [6, 52],
          [4, 52],
          [4, 50],
        ],
      ],
    };
    const normalized = normalizeGeometry(g);
    expect(geoArea(normalized)).toBeLessThan(0.01);
    const bounds = geoBounds(normalized);
    expect(bounds[0][0]).toBeCloseTo(4);
    expect(bounds[1][0]).toBeCloseTo(6);
  });
});

 describe("Verzameling oefensets", () => {
  it("migreert de bestaande set zonder locaties te verliezen", () => {
    saveSet(data);
    const collection = loadCollection({ version: 1, name: "Standaard", items: [] });
    expect(collection.sets).toHaveLength(1);
    expect(collection.sets[0].name).toBe(data.name);
    expect(collection.sets[0].items).toEqual(portableSet(data).items);
    expect(collection.activeId).toBe(collection.sets[0].id);
  });
  it("bewaart meerdere sets, gelijke namen en de actieve selectie", () => {
    const first = newSavedSet(data);
    const second = newSavedSet({ ...data, items: [initialItems[0]] });
    expect(first.id).not.toBe(second.id);
    const collection = { version: 2 as const, activeId: second.id, sets: [first, second] };
    expect(saveCollection(collection)).toBe(true);
    expect(loadCollection(data)).toEqual({ ...collection, sets: collection.sets.map(portableSet) });
    expect(loadSet()?.items).toHaveLength(1);
  });
  it("weigert dubbele set-id's en een ontbrekende actieve set", () => {
    const set = newSavedSet(data);
    expect(() => parseCollection(JSON.stringify({ version: 2, activeId: set.id, sets: [set, set] }))).toThrow();
    expect(() => parseCollection(JSON.stringify({ version: 2, activeId: "missing", sets: [set] }))).toThrow();
  });
  it("valt terug op de oude set bij beschadigde verzameling", () => {
    saveSet(data);
    localStorage.setItem("topo-practice-sets-v2", "{broken");
    expect(loadCollection(data).sets[0].name).toBe(data.name);
  });
 });
