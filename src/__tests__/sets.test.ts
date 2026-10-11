import { beforeEach, describe, expect, it } from "vitest";
import { catalog, initialItems, normalizeGeometry } from "../data/catalog";
import { loadSet, parseSet, saveSet, portableSet } from "../utils/sets";
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
