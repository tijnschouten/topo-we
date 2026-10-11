import { feature } from "topojson-client";
import { geoArea } from "d3-geo";
import topology from "world-atlas/countries-50m.json";
import references from "./referenceCatalog.json";
import type { TopoItem } from "../types";
// The 50m layer is visual context only; all answer targets use their source files.
export const countries = (
  feature(
    topology as never,
    topology.objects.countries as never,
  ) as unknown as GeoJSON.FeatureCollection
).features;
const normalized = new WeakMap<GeoJSON.Geometry, GeoJSON.Geometry>();
const mainlands = new WeakMap<GeoJSON.Geometry, GeoJSON.Geometry>();
export function normalizeGeometry(
  geometry: GeoJSON.Geometry,
): GeoJSON.Geometry {
  if (normalized.has(geometry)) return normalized.get(geometry)!;
  const normalize = (p: GeoJSON.Position[][]) =>
    geoArea({ type: "Polygon", coordinates: p }) > 2 * Math.PI
      ? p.map((r) => [...r].reverse())
      : p;
  const result = geometry.type === "Polygon"
    ? { ...geometry, coordinates: normalize(geometry.coordinates) }
    : geometry.type === "MultiPolygon"
      ? { ...geometry, coordinates: geometry.coordinates.map(normalize) }
      : geometry;
  normalized.set(geometry, result);
  return result;
}
export function mainland(input: GeoJSON.Geometry): GeoJSON.Geometry {
  if (mainlands.has(input)) return mainlands.get(input)!;
  const geometry = normalizeGeometry(input);
  if (geometry.type !== "MultiPolygon") return geometry;
  const result: GeoJSON.Polygon = {
    type: "Polygon",
    coordinates: [...geometry.coordinates].sort(
      (a, b) =>
        geoArea({ type: "Polygon", coordinates: b }) -
        geoArea({ type: "Polygon", coordinates: a }),
    )[0],
  };
  mainlands.set(input, result);
  return result;
}
export const initialItems = references as unknown as TopoItem[];
export const catalog = initialItems;
