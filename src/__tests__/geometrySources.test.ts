import { beforeEach, describe, expect, it } from "vitest";
import { initialItems } from "../data/catalog";
import {
  hydrateSet,
  isSourceReady,
  resolveGeometry,
} from "../utils/geometrySources";
import { mockSourceFiles } from "./sourceFixtures";
import type { TopoItem } from "../types";
beforeEach(mockSourceFiles);
describe("Betrouwbare brongeometrie", () => {
  it("vervangt de oude zespunts-Rijn en driepunts-Alpen door echte brongrenzen", async () => {
    const oldRiver: TopoItem = {
      id: "23",
      targetId: "water-rijn",
      naam: "Rijn",
      categorie: "water",
      hint: "oud",
      approximate: true,
      geometry: {
        type: "LineString",
        coordinates: [
          [8, 48],
          [4, 52],
        ],
      },
    };
    const oldRange: TopoItem = {
      id: "33",
      targetId: "gebied-alpen",
      naam: "Alpen",
      categorie: "gebied",
      hint: "oud",
      geometry: { type: "Point", coordinates: [9, 47] },
      approximate: true,
    };
    const result = await hydrateSet([oldRiver, oldRange]);
    expect(result.unavailable).toEqual([]);
    expect(result.items[0].geometry?.type).toBe("MultiLineString");
    expect(result.items[0].provenance?.vertices).toBe(279);
    expect(result.items[1].geometry?.type).toMatch(/Polygon/);
    expect(result.items[1].provenance?.vertices).toBe(6435);
    expect(result.items.every(isSourceReady)).toBe(true);
  });
  it("herstelt opgeslagen Ardennen van het kleine terreinfragment naar de bronlandschapscontour", async () => {
    const ardennes = initialItems.find((i) => i.id === "gebied-ardennen")!;
    const old: TopoItem = { ...ardennes, provenance: { ...ardennes.provenance!,
      version: "2.0 Standard", vertices: 17,
      sha256: "3d67de8143beba5ce427cb2c3041194079fe070b371ac0a2bce91f3bc62d9d27" } };
    const result = await hydrateSet([old]);
    expect(result.unavailable).toEqual([]);
    expect(result.items[0].provenance?.version).toBe("2.0 Broad");
    expect(result.items[0].provenance?.vertices).toBe(574);
    const geometry = result.items[0].geometry as GeoJSON.Polygon;
    const positions = geometry.coordinates.flat();
    const longitudes = positions.map((p) => p[0]);
    const latitudes = positions.map((p) => p[1]);
    expect(Math.max(...longitudes) - Math.min(...longitudes)).toBeGreaterThan(1.5);
    expect(Math.max(...latitudes) - Math.min(...latitudes)).toBeGreaterThan(0.9);
    await expect(resolveGeometry({ ...old, provenance: { ...old.provenance!, sha256: "0".repeat(64) } }))
      .rejects.toThrow("andere bronversie");
  });
  it("accepteert brongebieden voor zeeën en weigert een zee als punt", () => {
    const sea: TopoItem = {
      ...initialItems.find((i) => i.categorie === "land")!,
      id: "iho-1906", targetId: "iho-1906", naam: "Noordelijke IJszee", categorie: "water",
      provenance: {provider:"Marine Regions", version:"IHO Sea Areas v3 (2018)", recordId:"1906", vertices:5,
        url:"https://doi.org/10.14284/323", license:"CC BY 4.0", file:"iho-1906.json.gz", sha256:"a".repeat(64)}
    };
    expect(isSourceReady(sea)).toBe(true);
    expect(isSourceReady({...sea, geometry:{type:"Point",coordinates:[0,80]}})).toBe(false);
  });
  it("weigert een punt als rivier- of gebergtegeometrie", () => {
    const river = initialItems.find((i) => i.targetId === "water-rijn")!;
    expect(
      isSourceReady({
        ...river,
        geometry: { type: "Point", coordinates: [7, 50] },
      }),
    ).toBe(false);
    const range = initialItems.find((i) => i.targetId === "gebied-alpen")!;
    expect(
      isSourceReady({
        ...range,
        geometry: {
          type: "LineString",
          coordinates: [
            [8, 47],
            [10, 47],
          ],
        },
      }),
    ).toBe(false);
  });
  it("meldt ontbrekende bronnen en accepteert geen handgetekende vervanging", async () => {
    const hand: TopoItem = {
      id: "custom-test",
      targetId: "custom-test",
      naam: "Eigen gebergte",
      categorie: "gebied",
      hint: "",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
      approximate: true,
    };
    const result = await hydrateSet([hand]);
    expect(result.unavailable).toEqual(["Eigen gebergte"]);
    expect(result.items[0].geometry).toBeUndefined();
    expect(isSourceReady(result.items[0])).toBe(false);
  });
  it("weigert een bronversie die niet overeenkomt met de geïnstalleerde data", async () => {
    const river = initialItems.find((i) => i.targetId === "water-rijn")!;
    await expect(
      resolveGeometry({
        ...river,
        provenance: { ...river.provenance!, sha256: "0".repeat(64) },
      }),
    ).rejects.toThrow("andere bronversie");
  });
  it("houdt gelijknamige steden uit elkaar in de voorbeeldset", () => {
    expect(
      initialItems.find((i) => i.targetId === "plaats-dublin")?.hint,
    ).toMatch(/^Ireland/);
    expect(
      initialItems.find((i) => i.targetId === "plaats-glasgow")?.hint,
    ).toMatch(/^United Kingdom/);
    expect(
      initialItems.find((i) => i.targetId === "plaats-liverpool")?.hint,
    ).toMatch(/^United Kingdom/);
  });
});
