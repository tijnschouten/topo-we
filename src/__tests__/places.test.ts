import { describe, expect, it } from "vitest";
import { initialItems } from "../data/catalog";
import { capitalsForCountries, placeContext } from "../utils/places";
import { europeFocus } from "../utils/mapFocus";
import type { TopoItem } from "../types";
describe("Plaatsen en kaartuitsnede", () => {
  it("onderscheidt Londen met land, regio en hoofdstadstatus", () => {
    const london = initialItems.find((i) => i.naam === "Londen")!;
    expect(placeContext(london)).toContain("Verenigd Koninkrijk");
    expect(placeContext(london)).toContain("Westminster");
    expect(placeContext(london)).toContain("Hoofdstad");
  });
  it("koppelt hoofdsteden op landcode, ook bij meerdere hoofdsteden en ontbrekende bronnen", () => {
    const country = initialItems.find((i) => i.id === "land-vk")!;
    const london = initialItems.find((i) => i.naam === "Londen")!;
    const second = { ...london, id: "second-capital" };
    const americanLondon = { ...london, id: "us-london", capital: false, countryCode: "USA" };
    const result = capitalsForCountries([country, country, { ...country, id: "unknown", countryCode: undefined }], [london, second, americanLondon]);
    expect(result.capitals.map((i) => i.id)).toEqual([london.id, second.id]);
    expect(result.missing).toEqual([country.naam]);
  });
  it("focust Europese sets met Rusland op Europa en respecteert wereldweergave en Aziatische steden", () => {
    const uk = initialItems.find((i) => i.id === "land-vk")!;
    const russia: TopoItem = { ...uk, id: "russia", countryCode: "RUS", continent: "Europe" };
    expect(europeFocus([uk, russia])).toBe(true);
    expect(europeFocus([uk, russia], true)).toBe(false);
    expect(europeFocus([russia])).toBe(false);
    const tokyo: TopoItem = { ...uk, categorie: "plaats", geometry: {type:"Point",coordinates:[139.7,35.7]} };
    expect(europeFocus([uk, russia, tokyo])).toBe(false);
  });
});
it("houdt Europese focus bij noordelijke randzeeën zonder naar de pool uit te zoomen", () => {
  const uk = initialItems.find((i) => i.id === "land-vk")!;
  const russia: TopoItem = { ...uk, id:"russia",countryCode:"RUS",continent:"Europe" };
  const arctic: TopoItem = { ...uk,id:"iho-1906",categorie:"water",wikidataId:"Q788",geometry:{type:"Polygon",coordinates:[[[-180,72],[180,72],[180,90],[-180,90],[-180,72]]]} };
  expect(europeFocus([uk,russia])).toBe(true);
  expect(europeFocus([uk,russia,arctic])).toBe(true);
});
