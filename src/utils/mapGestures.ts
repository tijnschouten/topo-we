import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";

export interface MapView { k: number; x: number; y: number }
interface Position { x: number; y: number }

export function svgPosition(svg: SVGSVGElement, clientX: number, clientY: number): Position | undefined {
  const matrix = svg.getScreenCTM?.();
  if (matrix) return new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  const rect = svg.getBoundingClientRect();
  if (!rect.width) return undefined;
  const scale = Math.min(rect.width / 1000, rect.height / 680);
  return {
    x: (clientX - rect.left - (rect.width - 1000 * scale) / 2) / scale,
    y: (clientY - rect.top - (rect.height - 680 * scale) / 2) / scale,
  };
}

// Keep the same geographic position under the cursor / midpoint of the fingers.
export function zoomMap(view: MapView, factor: number, anchor: Position, destination = anchor): MapView {
  const k = Math.min(12, Math.max(1, view.k * factor));
  const ratio = k / view.k;
  return { k, x: destination.x - (anchor.x - view.x) * ratio,
    y: destination.y - (anchor.y - view.y) * ratio };
}

export function useMapGestures(
  svg: RefObject<SVGSVGElement>, view: MapView, setView: Dispatch<SetStateAction<MapView>>,
) {
  const latestView = useRef(view);
  latestView.current = view;
  const suppressClick = useRef(false);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const pointers = new Map<number, Position>();
    let drag: { start: Position; view: MapView } | undefined;
    let pinch: { distance: number; anchor: Position; view: MapView } | undefined;
    let gesture: { scale: number; anchor: Position; view: MapView } | undefined;
    const midpoint = (a: Position, b: Position) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const position = (p: Position) => svgPosition(element, p.x, p.y);
    const capture = (id: number) => {
      if (element.hasPointerCapture?.(id)) return;
      element.setPointerCapture?.(id);
    };
    const beginPinch = () => {
      const [a, b] = [...pointers.values()];
      const anchor = position(midpoint(a, b));
      if (!anchor) return;
      pinch = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), anchor, view: latestView.current };
      drag = undefined;
      suppressClick.current = true;
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (!pointers.size) suppressClick.current = false;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Keep the original path as the target for a simple tap on a country.
      // Capture only after dragging begins or a second finger arrives.
      if (pointers.size >= 2) {
        for (const id of pointers.keys()) capture(id);
        beginPinch();
      }
      else drag = { start: { x: e.clientX, y: e.clientY }, view: latestView.current };
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const current = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, current);
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const destination = position(midpoint(a, b));
        if (destination) setView(zoomMap(pinch.view,
          Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance, pinch.anchor, destination));
      } else if (drag && Math.hypot(current.x - drag.start.x, current.y - drag.start.y) > 5) {
        const start = position(drag.start), end = position(current);
        if (!start || !end) return;
        suppressClick.current = true;
        capture(e.pointerId);
        setView({ ...drag.view, x: drag.view.x + end.x - start.x, y: drag.view.y + end.y - start.y });
      }
    };
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      pinch = undefined;
      const remaining = [...pointers.values()][0];
      drag = remaining ? { start: remaining, view: latestView.current } : undefined;
      if (pointers.size >= 2) beginPinch();
    };
    const cancel = (e: PointerEvent) => { suppressClick.current = true; up(e); };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (gesture) return;
      const units = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 680 : 1;
      if (!e.ctrlKey) {
        // Trackpad two-finger movement arrives as horizontal/vertical wheel
        // deltas. Convert screen pixels to SVG units, independent of map zoom.
        const start = svgPosition(element, 0, 0);
        const end = svgPosition(element, (e.deltaX || 0) * units, (e.deltaY || 0) * units);
        if (start && end) setView(v => ({ ...v,
          x: v.x - (end.x - start.x), y: v.y - (end.y - start.y) }));
        return;
      }
      const anchor = svgPosition(element, e.clientX, e.clientY);
      const delta = e.deltaY * units;
      if (anchor) setView(v => zoomMap(v, Math.exp(-delta * 0.01), anchor));
    };
    // Safari on Mac uses WebKit gesture events instead of ctrl+wheel.
    type Gesture = Event & { scale: number; clientX: number; clientY: number };
    const gestureStart = (event: Event) => {
      event.preventDefault();
      if (pointers.size >= 2) return; // Touch pointers already handle tablet pinch.
      const e = event as Gesture;
      const anchor = svgPosition(element, e.clientX, e.clientY);
      if (anchor) gesture = { scale: e.scale || 1, anchor, view: latestView.current };
    };
    const gestureChange = (event: Event) => {
      event.preventDefault();
      if (gesture && pointers.size < 2) {
        setView(zoomMap(gesture.view, (event as Gesture).scale / gesture.scale, gesture.anchor));
      }
    };
    const gestureEnd = (event: Event) => { event.preventDefault(); gesture = undefined; };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", cancel);
    element.addEventListener("lostpointercapture", up);
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("gesturestart", gestureStart, { passive: false });
    element.addEventListener("gesturechange", gestureChange, { passive: false });
    element.addEventListener("gestureend", gestureEnd, { passive: false });
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", cancel);
      element.removeEventListener("lostpointercapture", up);
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("gesturestart", gestureStart);
      element.removeEventListener("gesturechange", gestureChange);
      element.removeEventListener("gestureend", gestureEnd);
    };
  }, [svg, setView]);
  return () => suppressClick.current;
}
