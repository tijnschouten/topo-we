import { svgPosition, useMapGestures, zoomMap } from "../utils/mapGestures";
import { layoutMapLabels, nearestPoint, separateMapPoints } from "../utils/mapInteraction";
import { isRomeOrVaticanCity } from "../utils/quiz";
import { europeFocus } from "../utils/mapFocus";
import { geoBounds, geoMercator, geoPath } from "d3-geo";
import { useEffect, useMemo, useRef, useState } from "react";
import { countries, mainland, normalizeGeometry } from "../data/catalog";
import type { TopoItem, Category } from "../types";
interface Props {
  items: TopoItem[];
  interactive: boolean;
  category?: Category;
  labels?: boolean;
  highlightedTargetId?: string;
  correctTargetId?: string;
  wrongTargetId?: string;
  onTargetClick?: (ids: string[]) => void;
  onContinue?: () => void;
  onContinueButton?: () => void;
  continueDelay?: number;
  continueLabel?: string;
  resetKey?: string | number;
  world?: boolean;
  fillContainer?: boolean;
}
export default function TopoMap({
  items,
  interactive,
  category,
  labels,
  highlightedTargetId,
  correctTargetId,
  wrongTargetId,
  onTargetClick,
  onContinue,
  onContinueButton,
  continueDelay = 0,
  continueLabel,
  resetKey,
  world,
  fillContainer = false,
}: Props) {
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const svg = useRef<SVGSVGElement>(null);
  const [pixelScale, setPixelScale] = useState(1);
  const [canvasHeight, setCanvasHeight] = useState(680);
  const [hoveredPoint, setHoveredPoint] = useState<string>();
  const [continueReady, setContinueReady] = useState(false);
  useEffect(() => {
    setContinueReady(false);
    if (!continueDelay || !correctTargetId) return;
    const timer = window.setTimeout(() => setContinueReady(true), continueDelay);
    return () => window.clearTimeout(timer);
  }, [continueDelay, correctTargetId]);
  useEffect(() => {
    const element = svg.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0) {
        setPixelScale(1000 / width);
        if (fillContainer && height > 0) setCanvasHeight(1000 * height / width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fillContainer]);
  const gestureMoved = useMapGestures(svg, view, setView);
  const data = useMemo(() => {
    const geometries = items.flatMap((i) =>
      i.geometry ? [mainland(i.geometry)] : [],
    );
    const bounds = geoBounds({ type: "GeometryCollection", geometries });
    let [west, south] = bounds[0],
      [east, north] = bounds[1];
    if (europeFocus(items, world)) {
      west = -25; east = 55; south = 30;
      north = 73;
    } else if (
      world ||
      !geometries.length ||
      !Number.isFinite(west) ||
      east < west ||
      east - west > 300
    ) {
      west = -180;
      east = 180;
      south = -60;
      north = 80;
    } else {
      const dx = Math.max(4, (east - west) * 0.18),
        dy = Math.max(3, (north - south) * 0.18);
      west -= dx;
      east += dx;
      south = Math.max(-80, south - dy);
      north = Math.min(83, north + dy);
    }
    const projection = geoMercator()
      .fitExtent(
        [
          [35, 35],
          [965, canvasHeight - 35],
        ],
        {
          type: "MultiPoint",
          coordinates: [
            [west, south],
            [east, north],
          ],
        },
      )
      .clipExtent([
        [-5000, -5000],
        [6000, 6000],
      ]);
    return { projection, path: geoPath(projection) };
  }, [items, world, canvasHeight]);
  useEffect(() => {
    // A target can retain focus while feedback temporarily disables it. When
    // the next question enables targets again, its outline must not return.
    if (svg.current?.contains(document.activeElement) &&
        document.activeElement?.closest("[data-target-id]")) svg.current.focus();
    setView({ k: 1, x: 0, y: 0 });
    setHoveredPoint(undefined);
  }, [items, world, resetKey]);
  const previousProjection = useRef({ projection: data.projection, height: canvasHeight });
  useEffect(() => {
    const previous = previousProjection.current;
    setView(view => {
      if (view.k === 1 && view.x === 0 && view.y === 0) return view;
      const location = previous.projection.invert?.([(500 - view.x) / view.k, (previous.height / 2 - view.y) / view.k]);
      const position = location && data.projection(location);
      return position ? { ...view, x: 500 - position[0] * view.k, y: canvasHeight / 2 - position[1] * view.k } : view;
    });
    previousProjection.current = { projection: data.projection, height: canvasHeight };
  }, [data, canvasHeight]);
  function zoom(factor: number) {
    setView(v => zoomMap(v, factor, { x: 500, y: canvasHeight / 2 }));
  }
  const visible = useMemo(
    () => items.filter((i) => !category || i.categorie === category),
    [items, category],
  );
  // Source polygons can contain 100,000+ vertices. Project once, then pan/zoom
  // with an SVG transform; interaction never reprojects the full dataset.
  const backgroundPaths = useMemo(
    () => countries.map((f) => data.path(f) ?? ""),
    [data],
  );
  const renderedTargets = useMemo(
    () =>
      [...visible]
        .sort(
          (a, b) =>
            (a.geometry?.type === "Point" ? 3 : a.categorie === "water" && a.geometry?.type.includes("Polygon") ? 0 : a.categorie === "water" ? 2 : 1) -
            (b.geometry?.type === "Point" ? 3 : b.categorie === "water" && b.geometry?.type.includes("Polygon") ? 0 : b.categorie === "water" ? 2 : 1),
        )
        .map((item) => {
          if (!item.geometry)
            return { item, center: null, isPoint: false, isLine: false, d: "" };
          const geometry = normalizeGeometry(item.geometry);
          const isPoint = geometry.type === "Point";
          const isLine = ["LineString", "MultiLineString"].includes(
            geometry.type,
          );
          const center = isPoint
            ? data.projection(
                (geometry as GeoJSON.Point).coordinates as [number, number],
              )
            : data.path.centroid({
                type: "Feature",
                properties: {},
                geometry: mainland(geometry),
              });
          return {
            item,
            center,
            isPoint,
            isLine,
            d: isPoint ? "" : (data.path(geometry) ?? ""),
          };
        }),
    [visible, data],
  );
  const sourceMarkers = useMemo(() => {
    const markers = renderedTargets.flatMap(({ item, center, isPoint, isLine }) => {
    if (!center || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) return [];
    const bounds = !isPoint && !isLine && item.geometry ? data.path.bounds(mainland(item.geometry)) : null;
    const small = bounds && (bounds[1][0] - bounds[0][0]) * view.k < 24 * pixelScale &&
      (bounds[1][1] - bounds[0][1]) * view.k < 24 * pixelScale;
    return isPoint || small ? [{ id: item.targetId, x: center[0] * view.k + view.x,
      y: center[1] * view.k + view.y, isPoint, item, targetIds: [item.targetId], name: item.naam }] : [];
    });
    const shared = markers.filter(marker => marker.isPoint && isRomeOrVaticanCity(marker.item))
      .sort((a, b) => a.item.naam.localeCompare(b.item.naam, "nl"));
    if (shared.length < 2) return markers;
    const combined = { ...shared[0], targetIds: shared.flatMap(marker => marker.targetIds),
      name: shared.map(marker => marker.name).join(" / "),
      x: shared.reduce((sum, marker) => sum + marker.x, 0) / shared.length,
      y: shared.reduce((sum, marker) => sum + marker.y, 0) / shared.length };
    return [...markers.filter(marker => !combined.targetIds.includes(marker.id)), combined];
  }, [renderedTargets, data, view, pixelScale]);
  const screenPoints = useMemo(() => separateMapPoints(sourceMarkers, pixelScale), [sourceMarkers, pixelScale]);
  const markerIds = useMemo(() => new Set(screenPoints.map(point => point.id)), [screenPoints]);
  function targetProps(item: TopoItem, state: string, targetIds = [item.targetId], name = item.naam) {
    return {
      "data-target-id": item.targetId,
      "data-target-ids": targetIds.join(" "),
      tabIndex: interactive ? 0 : -1,
      role: interactive ? "button" : undefined,
      "aria-label": labels || state !== "neutral" ? name : `Locatie ${visible.indexOf(item) + 1}`,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (interactive && ["Enter", " "].includes(e.key)) {
          e.preventDefault(); e.stopPropagation();
          if (!e.repeat) onTargetClick?.(targetIds);
        }
      },
    };
  }
  function targetState(id: string) {
    return id === correctTargetId ? "correct" : id === wrongTargetId ? "wrong" : id === highlightedTargetId ? "highlight" : "neutral";
  }
  const labelWidths = useMemo(() => {
    const context = typeof CanvasRenderingContext2D !== "undefined"
      ? document.createElement("canvas").getContext("2d") : null;
    if (context) context.font = `600 13px ${getComputedStyle(svg.current ?? document.documentElement).fontFamily}`;
    const names = [...renderedTargets.map(({ item }) => item.naam), ...sourceMarkers.map(marker => marker.name)];
    return new Map(names.map(name => [name, context?.measureText(name).width ?? name.length * 7.5]));
  }, [renderedTargets, sourceMarkers]);
  const placedLabels = useMemo(() => {
    const candidates = renderedTargets.flatMap(({ item, center, isPoint, isLine }) => {
      if (!center || !Number.isFinite(center[0]) ||
          !(labels || item.targetId === correctTargetId || item.targetId === wrongTargetId)) return [];
      const source = sourceMarkers.find(marker => marker.targetIds.includes(item.targetId));
      const owner = source?.targetIds.find(id => id === correctTargetId) ?? source?.targetIds.find(id => id === wrongTargetId) ?? source?.id;
      if (source && item.targetId !== owner) return [];
      const name = source && source.targetIds.length > 1 && owner !== correctTargetId && owner !== wrongTargetId ? source.name : item.naam;
      const marker = screenPoints.find(point => point.id === source?.id);
      const x = marker?.x ?? center[0] * view.k + view.x, y = marker?.y ?? center[1] * view.k + view.y;
      if (x < 0 || x > 1000 || y < 0 || y > canvasHeight) return [];
      return [{ id: item.targetId, name, x, y,
        width: labelWidths.get(name)! * pixelScale,
        kind: (marker || isPoint ? "point" : isLine ? "line" : "area") as "point" | "line" | "area",
        required: item.targetId === correctTargetId || item.targetId === wrongTargetId ||
          (!!labels && !interactive && item.targetId === hoveredPoint) }];
    }).sort((a, b) => Number(b.id === correctTargetId || b.id === wrongTargetId) -
      Number(a.id === correctTargetId || a.id === wrongTargetId));
    return layoutMapLabels(candidates, screenPoints, pixelScale, canvasHeight);
  }, [renderedTargets, labels, correctTargetId, wrongTargetId, view, pixelScale, screenPoints, labelWidths, interactive, hoveredPoint, canvasHeight, sourceMarkers]);
  function pointAt(clientX: number, clientY: number) {
    const position = svg.current && svgPosition(svg.current, clientX, clientY);
    if (!position) return undefined;
    return nearestPoint(screenPoints, position.x, position.y, 23 * pixelScale);
  }
  return (
    <div className="map-wrap">
      <div className={`map-surface ${onContinue ? "map-ready" : ""}`}>
      <div className="map-tools" role="group" aria-label="Kaartbediening">
        <button type="button" aria-label="Inzoomen" onClick={() => zoom(1.5)}>
          +
        </button>
        <button
          type="button"
          aria-label="Uitzoomen"
          onClick={() => zoom(1 / 1.5)}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Kaart herstellen"
          onClick={() => setView({ k: 1, x: 0, y: 0 })}
        >
          ↺
        </button>
      </div>
      <svg
        ref={svg}
        className="topo-map"
        tabIndex={-1}
        viewBox={`0 0 1000 ${canvasHeight}`}
        aria-label="Oefenkaart"
        onPointerMove={(e) => {
          if ((interactive || labels) && e.buttons === 0) setHoveredPoint(pointAt(e.clientX, e.clientY));
        }}
        onPointerLeave={() => setHoveredPoint(undefined)}
        onClick={(e) => {
          if (gestureMoved()) return;
          if (onContinue) {
            svg.current?.focus();
            onContinue();
            return;
          }
          if (labels && !interactive) {
            svg.current?.focus();
            setHoveredPoint(pointAt(e.clientX, e.clientY) ?? (e.target as Element)
              .closest("[data-target-id]")?.getAttribute("data-target-id") ?? undefined);
            return;
          }
          if (interactive) {
            const target = pointAt(e.clientX, e.clientY) ?? (e.target as Element)
              .closest("[data-target-id]")
              ?.getAttribute("data-target-id");
            if (target) {
              // SVG may focus the overlapping DOM hit circle, even though we
              // selected its neighbor. Mouse feedback should show neither box.
              if (svg.current?.contains(document.activeElement))
                (document.activeElement as SVGElement).blur();
              onTargetClick?.(sourceMarkers.find(marker => marker.id === target)?.targetIds ?? [target]);
            }
          }
        }}
      >
        <rect width="1000" height={canvasHeight} className="sea-bg" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {backgroundPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              className="context-country"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {renderedTargets.map(({ item, isPoint, isLine, d }) => {
            if (!item.geometry) return null;
            if (isPoint) return null; // Markers render above all polygons.
            const state = targetState(item.targetId);
            const active = interactive;
            const props = targetProps(item, state);
            return (
              <g
                key={item.id}
                className={`map-feature state-${state} ${active ? "interactive" : ""} ${hoveredPoint === item.targetId ? "point-hover" : ""}`}
              >
                <path
                      {...props}
                      tabIndex={markerIds.has(item.targetId) ? -1 : props.tabIndex}
                      d={d}
                      className={
                        isLine
                          ? `line-hit ${item.categorie === "gebied" ? "mountain" : ""}`
                          : `country-target ${item.categorie === "gebied" ? "mountain-area" : item.categorie === "water" ? "water-area" : ""}`
                      }
                      vectorEffect="non-scaling-stroke"
                    />
                {isLine && (
                      <path
                        d={d}
                        className={`line-visible ${item.categorie === "gebied" ? "mountain" : ""}`}
                        vectorEffect="non-scaling-stroke"
                      />
                )}
              </g>
            );
          })}
        </g>
        <g className="map-marker-leaders" pointerEvents="none">
          {screenPoints.map(point => {
            const source = sourceMarkers.find(marker => marker.id === point.id)!;
            if (source.isPoint && Math.hypot(source.x - point.x, source.y - point.y) < 1) return null;
            return <g key={point.id}>
              <line x1={source.x} y1={source.y} x2={point.x} y2={point.y} vectorEffect="non-scaling-stroke" />
              <circle cx={source.x} cy={source.y} r={2 * pixelScale} />
            </g>;
          })}
        </g>
        <g className="map-marker-layer">
          {screenPoints.map(point => {
            const source = sourceMarkers.find(marker => marker.id === point.id)!;
            const selectedId = source.targetIds.find(id => id === correctTargetId) ?? source.targetIds.find(id => id === wrongTargetId) ??
              source.targetIds.find(id => id === highlightedTargetId) ?? source.id;
            const state = targetState(selectedId);
            const name = state !== "neutral" ? visible.find(item => item.targetId === selectedId)!.naam : source.name;
            return <g key={point.id} className={`map-feature state-${state} ${interactive ? "interactive" : ""} ${hoveredPoint === point.id ? "point-hover" : ""}`}>
              <g {...targetProps(source.item, state, source.targetIds, name)} className="point-target">
                <circle cx={point.x} cy={point.y} r={23 * pixelScale} className="point-hit" />
                {source.isPoint
                  ? <circle cx={point.x} cy={point.y} r={10 * pixelScale} className="point" vectorEffect="non-scaling-stroke" />
                  : <circle cx={point.x} cy={point.y} r={(state === "neutral" && hoveredPoint !== point.id ? 5 : 8) * pixelScale} className="point small-area-marker" vectorEffect="non-scaling-stroke" />}
                {source.isPoint && <circle cx={point.x} cy={point.y} r={3 * pixelScale} fill="white" pointerEvents="none" />}
              </g>
            </g>;
          })}
        </g>
        <g className="map-label-layer" pointerEvents="none">
          {placedLabels.map(label => {
            const distance = Math.hypot(label.lineX - label.x, label.lineY - label.y);
            const inset = Math.min(1, 12 * pixelScale / distance);
            return (
              <g key={label.id} data-label-id={label.id}
                className={label.id === correctTargetId ? "label-correct" : label.id === wrongTargetId ? "label-wrong" : ""}>
                {label.showLeader && <line x1={label.x + (label.lineX - label.x) * inset}
                  y1={label.y + (label.lineY - label.y) * inset} x2={label.lineX} y2={label.lineY}
                  className="map-label-leader" vectorEffect="non-scaling-stroke" />}
                <text x={label.textX} y={label.textY} fontSize={13 * pixelScale}
                  className={`map-label ${label.kind === "area" ? "map-label-area" : ""}`}>{label.name}</text>
              </g>
            );
          })}
        </g>
      </svg>
      {(onContinueButton || onContinue) && (
        <button className={`map-continue-hint ${!onContinue ? "review" : ""}`}
          disabled={!!continueDelay && !continueReady} onClick={onContinueButton ?? onContinue}>
          {onContinue && <span aria-hidden="true">✓</span>}
          <span>{continueDelay && !continueReady
            ? "Bekijk eerst het juiste antwoord"
            : continueLabel ?? "Klik of tik op de kaart om verder te gaan"}</span>
          <span aria-hidden="true">→</span>
        </button>
      )}
      </div>
      {sourceMarkers.some(marker => !marker.isPoint || screenPoints.some(point => point.id === marker.id && Math.hypot(point.x - marker.x, point.y - marker.y) > 1)) &&
        <p className="map-marker-note">Kleine gebieden en dicht bij elkaar gelegen locaties hebben een apart klikpunt. Het lijntje wijst naar de echte plek.</p>}
      <div className="map-caption">
        <span>{labels && placedLabels.length < visible.length
          ? "Zoom in of wijs een stad aan voor meer namen"
          : "Sleep om te verschuiven · Ctrl/⌘ + muiswiel om te zoomen · knijp op een touchpad"}</span>
        <span>Kaart: Natural Earth · zeeën: Marine Regions · gebergtes: GMBA</span>
      </div>
    </div>
  );
}
