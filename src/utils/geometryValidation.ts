function position(v: unknown, allowPoles = false): boolean {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    v.every(Number.isFinite) &&
    Math.abs(v[0]) <= 180 &&
    (allowPoles ? Math.abs(v[1]) <= 90 : Math.abs(v[1]) < 86)
  );
}
const validated = new WeakMap<object, boolean>();
export function validGeometry(v: unknown): v is GeoJSON.Geometry {
  if (!v || typeof v !== "object") return false;
  if (validated.has(v)) return validated.get(v)!;
  const result = checkGeometry(v);
  validated.set(v, result);
  return result;
}
function checkGeometry(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const g = v as { type: string; coordinates: unknown };
  const c = g.coordinates;
  const line = (x: unknown, min: number, allowPoles = false) =>
    Array.isArray(x) &&
    x.length >= min &&
    x.every((p) => position(p, allowPoles));
  const polygon = (x: unknown) =>
    Array.isArray(x) &&
    x.length > 0 &&
    x.every(
      (r) =>
        line(r, 4, true) &&
        JSON.stringify(r[0]) === JSON.stringify(r[r.length - 1]),
    );
  switch (g.type) {
    case "Point":
      return position(c);
    case "LineString":
      return line(c, 2);
    case "MultiPoint":
      return line(c, 1);
    case "MultiLineString":
      return Array.isArray(c) && c.length > 0 && c.every((l) => line(l, 2));
    case "Polygon":
      return polygon(c);
    case "MultiPolygon":
      return Array.isArray(c) && c.length > 0 && c.every(polygon);
    default:
      return false;
  }
}
