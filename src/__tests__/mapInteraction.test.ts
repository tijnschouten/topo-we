import { describe, expect, it } from "vitest";
import { layoutMapLabels, nearestPoint } from "../utils/mapInteraction";

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
