import { describe, expect, it } from "vitest";
import { entityToItem, searchLibrary } from "../utils/lookup";
import { initialItems } from "../data/catalog";
const coordinate = {
  rank: "normal",
  mainsnak: {
    datavalue: {
      value: {
        longitude: 139.69,
        latitude: 35.68,
        globe: "http://www.wikidata.org/entity/Q2",
      },
    },
  },
};
describe("Bronzoeken", () => {
  it("gebruikt Wikidata-punten alleen voor steden, nooit voor rivierlopen of gebergtes", () => {
    const entity = {
      id: "Q1490",
      labels: { nl: { value: "Tokio" } },
      claims: { P625: [coordinate] },
    };
    expect(entityToItem(entity, "plaats")?.geometry).toEqual({
      type: "Point",
      coordinates: [139.69, 35.68],
    });
    expect(entityToItem(entity, "water")).toBeNull();
    expect(entityToItem(entity, "gebied")).toBeNull();
    expect(entityToItem(entity, "land")).toBeNull();
  });
  it("weigert niet-aardse coördinaten", () => {
    const entity = {
      id: "Q1",
      labels: { nl: { value: "Geen stad" } },
      claims: {
        P625: [
          {
            mainsnak: {
              datavalue: {
                value: { longitude: 10, latitude: 10, globe: "Q111" },
              },
            },
          },
        ],
      },
    };
    expect(entityToItem(entity, "plaats")).toBeNull();
  });
  it("vindt Nederlandse en internationale namen in de bronbibliotheek", () => {
    expect(searchLibrary(initialItems, "Rhine", "water")[0].naam).toBe("Rijn");
    expect(searchLibrary(initialItems, "Alps", "gebied")[0].naam).toBe("Alpen");
    expect(searchLibrary(initialItems, "Pyreneeen", "gebied")[0].naam).toBe(
      "Pyreneeën",
    );
    expect(searchLibrary(initialItems, "Alps", "plaats")).toEqual([]);
  });
});
