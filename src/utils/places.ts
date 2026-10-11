import type { TopoItem } from "../types";
export function placeContext(item: TopoItem): string {
  if (item.categorie !== "plaats") return "";
  return [item.countryName, item.regionName, item.capital ? "Hoofdstad" : ""]
    .filter(Boolean).join(" · ") || item.hint;
}
export function capitalsForCountries(selected: TopoItem[], library: TopoItem[]) {
  const countries = selected.filter((i) => i.categorie === "land");
  const codes = new Set(countries.map((i) => i.countryCode).filter(Boolean));
  const capitals = library.filter((i) => i.categorie === "plaats" && i.capital && i.countryCode && codes.has(i.countryCode));
  const covered = new Set(capitals.map((i) => i.countryCode));
  return { capitals, missing: countries.filter((i) => !i.countryCode || !covered.has(i.countryCode)).map((i) => i.naam) };
}
