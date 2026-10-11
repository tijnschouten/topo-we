import { geoBounds } from "d3-geo";
import { mainland } from "../data/catalog";
import type { TopoItem } from "../types";
// Russia crosses the antimeridian. Its complete country bounds cannot describe
// a Europe exercise; keep the full answer geometry, change only the viewport.
export function europeFocus(items: TopoItem[], world?: boolean): boolean {
  const countries = items.filter((i) => i.categorie === "land");
  return !world && countries.length > 1 &&
    (countries.some((i) => i.countryCode === "RUS") || items.some((i) => i.categorie === "water" && ["Q97", "Q788"].includes(i.wikidataId ?? ""))) &&
    countries.every((i) => i.continent === "Europe") &&
    items.every((i) => {
      if (i.categorie === "land") return true;
      if (i.geometry?.type === "Point") {
        const [x, y] = i.geometry.coordinates;
        return x >= -30 && x <= 65 && y >= 30 && y <= 75;
      }
      if (i.categorie === "water" && ["Q97", "Q788"].includes(i.wikidataId ?? "")) return true;
      if (!i.geometry) return false;
      const [[west, south], [east, north]] = geoBounds(mainland(i.geometry));
      return west >= -30 && east >= west && east <= 75 && south >= 30 && north <= 75;
    });
}
