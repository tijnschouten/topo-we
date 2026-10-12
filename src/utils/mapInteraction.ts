export interface MapPoint {
  id: string;
  x: number;
  y: number;
}

// Spread only crowded markers, preserving a leader back to each source position.
// Sort by position and identity so layout never depends on SVG drawing order.
export function separateMapPoints(points: MapPoint[], scale: number) {
  const placed: MapPoint[] = [];
  const gap = 26 * scale;
  const ordered = [...points].sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));
  for (const point of ordered) {
    const available = (candidate: MapPoint) => placed.every(other => Math.hypot(other.x - candidate.x, other.y - candidate.y) >= gap - 0.001);
    if (available(point)) { placed.push(point); continue; }
    const nearest = [...placed].sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
    const direction = Math.atan2(point.y - nearest.y, point.x - nearest.x);
    let candidate = point;
    let found = false;
    // Find the nearest free local position. Never merge a chain of nearby cities
    // into one continent-sized cluster.
    for (let ring = 1; !found; ring++) {
      for (let step = 0; step < 24; step++) {
        const angle = direction + step * Math.PI / 12;
        candidate = { ...point, x: point.x + Math.cos(angle) * gap * ring,
          y: point.y + Math.sin(angle) * gap * ring };
        if (available(candidate)) { found = true; break; }
      }
    }
    placed.push(candidate);
  }
  return placed;
}

// Overlapping hit circles must not make the SVG drawing order decide the answer.
export function nearestPoint(points: MapPoint[], x: number, y: number, radius: number) {
  let best: MapPoint | undefined;
  let distance = radius;
  for (const point of points) {
    const next = Math.hypot(point.x - x, point.y - y);
    if (next <= distance) {
      best = point;
      distance = next;
    }
  }
  return best?.id;
}

interface Box { x: number; y: number; width: number; height: number }
function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

interface MapLabel extends MapPoint {
  name: string;
  width: number;
  kind?: "point" | "area" | "line";
  required?: boolean;
}

export function layoutMapLabels(labels: MapLabel[], markers: MapPoint[], scale: number, heightLimit = 680) {
  const occupied: Box[] = markers.map(p => ({
    x: p.x - 12 * scale, y: p.y - 12 * scale,
    width: 24 * scale, height: 24 * scale,
  }));
  const placed: (MapLabel & { box: Box; textX: number; textY: number;
    lineX: number; lineY: number; showLeader: boolean })[] = [];
  // Feedback is always placed first. Ordinary names may wait for more zoom.
  const ordered = [...labels].sort((a, b) => Number(!!b.required) - Number(!!a.required));
  for (const label of ordered) {
    const width = label.width + 8 * scale, height = 20 * scale;
    const isPoint = !label.kind || label.kind === "point";
    const neighbor = markers.filter(p => p.id !== label.id)
      .sort((a, b) => Math.hypot(a.x - label.x, a.y - label.y) - Math.hypot(b.x - label.x, b.y - label.y))[0];
    const leftFirst = neighbor && neighbor.x > label.x && Math.hypot(neighbor.x - label.x, neighbor.y - label.y) < 60 * scale;
    const right = label.x + 16 * scale, left = label.x - width - 16 * scale;
    const sides = leftFirst ? [left, right] : [right, left];
    const centered = label.x - width / 2;
    const offsets: [number, number][] = isPoint
      ? [
          [sides[0], label.y - height / 2], [sides[1], label.y - height / 2],
          [centered, label.y - 16 * scale - height], [centered, label.y + 16 * scale],
          ...sides.flatMap(x => [[x, label.y - height - 12 * scale], [x, label.y + 12 * scale]] as [number, number][]),
        ]
      : [[centered, label.y - height / 2], [centered, label.y - height - 8 * scale],
          [centered, label.y + 8 * scale]];
    if (label.required) {
      for (const distance of [40, 64, 88]) {
        offsets.push([centered, label.y - distance * scale - height], [centered, label.y + distance * scale]);
      }
    }
    let box: Box | undefined;
    for (const [x, y] of offsets) {
      const candidate = { x, y, width, height };
      if (x < 4 * scale || x + width > 1000 - 4 * scale ||
          y < 4 * scale || y + height > heightLimit - 4 * scale) continue;
      if (!occupied.some(other => overlaps(candidate, other))) { box = candidate; break; }
    }
    if (!box && label.required) {
      // Keep feedback visible near the edge, even if surrounding markers are dense.
      for (const [x, y] of offsets) {
        const candidate = { x: Math.max(4 * scale, Math.min(x, 1000 - width - 4 * scale)),
          y: Math.max(4 * scale, Math.min(y, heightLimit - height - 4 * scale)), width, height };
        if (!placed.some(other => overlaps(candidate, other.box))) { box = candidate; break; }
      }
    }
    if (!box) continue;
    occupied.push(box);
    const lineX = Math.max(box.x, Math.min(label.x, box.x + width));
    const lineY = Math.max(box.y, Math.min(label.y, box.y + height));
    placed.push({ ...label, box, textX: box.x + 4 * scale, textY: box.y + 15 * scale,
      lineX, lineY, showLeader: !!label.required || (isPoint && Math.hypot(lineX - label.x, lineY - label.y) > 24 * scale) });
  }
  return placed;
}
