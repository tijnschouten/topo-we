import { describe, expect, it } from "vitest";
import { layoutMapLabels, nearestPoint, separateMapPoints } from "../utils/mapInteraction";

describe("dichtbij gelegen steden", () => {
  const cities = [
    { id: "wenen", x: 400, y: 300 },
    { id: "bratislava", x: 419, y: 301 },
  ];
  it("kiest de dichtstbijzijnde stad binnen overlappende klikvlakken, ongeacht tekenvolgorde", () => {
    for (const order of [cities, [...cities].reverse()]) {
      expect(nearestPoint(order, 415, 300, 23)).toBe("bratislava");
      expect(nearestPoint(order, 403, 301, 23)).toBe("wenen");
      expect(nearestPoint(order, 460, 301, 23)).toBeUndefined();
    }
  });
  it("plaatst feedbacknamen naast hun eigen stad zonder overlap", () => {
    const labels = layoutMapLabels(cities.map(p => ({
      ...p, name: p.id, width: p.id.length * 9,
    })), cities, 1);
    const [vienna, bratislava] = labels;
    expect(vienna.box.x + vienna.box.width).toBeLessThan(cities[0].x);
    expect(bratislava.box.x).toBeGreaterThan(cities[1].x);
    expect(vienna.box.x + vienna.box.width).toBeLessThan(bratislava.box.x);
  });
  it("houdt meerdere namen binnen de kaart en uit elkaar bij een kaartrand", () => {
    const points = Array.from({ length: 6 }, (_, i) => ({ id: String(i), x: 970, y: 300 + i * 3 }));
    const labels = layoutMapLabels(points.map(p => ({ ...p, name: "Hoofdstad", width: 85 })), points, 1);
    for (const { box: a } of labels) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x + a.width).toBeLessThanOrEqual(1000);
      for (const { box: b } of labels) {
        if (a === b) continue;
        expect(a.x >= b.x + b.width || a.x + a.width <= b.x ||
          a.y >= b.y + b.height || a.y + a.height <= b.y).toBe(true);
      }
    }
  });
  it("verbergt namen in een dicht cluster in plaats van lange lijnen over de kaart te tekenen", () => {
    const points = Array.from({ length: 18 }, (_, i) => ({ id: String(i), x: 450 + i * 2, y: 300 + i * 2 }));
    const labels = layoutMapLabels(points.map(p => ({ ...p, name: "Hoofdstad", width: 80 })), points, 1);
    expect(labels.length).toBeLessThan(points.length);
    for (const label of labels) {
      expect(Math.hypot(label.lineX - label.x, label.lineY - label.y)).toBeLessThan(35);
    }
    const expanded = points.map(p => ({ ...p, x: 450 + (p.x - 450) * 5, y: 300 + (p.y - 300) * 5 }));
    expect(layoutMapLabels(expanded.map(p => ({ ...p, name: "Hoofdstad", width: 80 })), expanded, 1).length)
      .toBeGreaterThan(labels.length);
  });
  it("blijft feedback voor beide naburige steden tonen tussen veel andere namen", () => {
    const points = Array.from({ length: 12 }, (_, i) => ({ id: String(i), x: 400 + i * 4, y: 300 + i * 3 }));
    const labels = layoutMapLabels(points.map((p, i) => ({ ...p, name: "Hoofdstad", width: 80, required: i === 5 || i === 6 })), points, 1);
    expect(labels.some(p => p.id === "5")).toBe(true);
    expect(labels.some(p => p.id === "6")).toBe(true);
  });
});

 describe("uit elkaar geplaatste klikpunten", () => {
  it("maakt zelfs identieke bronpunten apart bereikbaar, onafhankelijk van volgorde", () => {
    const points = ["rome", "vaticaan", "derde"].map(id => ({ id, x: 500, y: 340 }));
    const separated = separateMapPoints(points, 1);
    expect(separateMapPoints([...points].reverse(), 1)).toEqual(separated);
    for (const point of separated) {
      expect(nearestPoint(separated, point.x, point.y, 23)).toBe(point.id);
      for (const other of separated.filter(other => other.id !== point.id))
        expect(Math.hypot(point.x - other.x, point.y - other.y)).toBeGreaterThanOrEqual(25.99);
    }
  });
  it("verplaatst een lange keten van nabije steden alleen lokaal", () => {
    const points = Array.from({ length: 20 }, (_, i) => ({ id: String(i), x: 200 + i * 20, y: 300 }));
    for (const marker of separateMapPoints(points, 1)) {
      const source = points.find(point => point.id === marker.id)!;
      expect(Math.hypot(marker.x - source.x, marker.y - source.y)).toBeLessThanOrEqual(52.01);
    }
  });
  it("behoudt de geografische positie wanneer inzoomen de punten voldoende scheidt", () => {
    const points = [{ id: "a", x: 400, y: 300 }, { id: "b", x: 480, y: 300 }];
    expect(separateMapPoints(points, 1)).toEqual(points);
  });
 });
