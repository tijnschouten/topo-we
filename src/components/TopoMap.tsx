import { svgPosition, useMapGestures, zoomMap } from "../utils/mapGestures";
import { layoutMapLabels, nearestPoint } from "../utils/mapInteraction";
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
}: Props) {
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const svg = useRef<SVGSVGElement>(null);
  const [pixelScale, setPixelScale] = useState(1);
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
      const width = element.getBoundingClientRect().width;
      if (width > 0) setPixelScale(1000 / width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
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
          [965, 645],
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
  }, [items, world]);
  useEffect(() => {
    // A target can retain focus while feedback temporarily disables it. When
    // the next question enables targets again, its outline must not return.
    if (svg.current?.contains(document.activeElement) &&
        document.activeElement?.closest("[data-target-id]")) svg.current.focus();
    setView({ k: 1, x: 0, y: 0 });
    setHoveredPoint(undefined);
  }, [data, resetKey]);
  function zoom(factor: number) {
    setView(v => zoomMap(v, factor, { x: 500, y: 340 }));
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
  const screenPoints = useMemo(() => renderedTargets.flatMap(({ item, center, isPoint }) =>
    isPoint && center ? [{ id: item.targetId, x: center[0] * view.k + view.x, y: center[1] * view.k + view.y }] : [],
  ), [renderedTargets, view]);
  const labelWidths = useMemo(() => {
    const context = typeof CanvasRenderingContext2D !== "undefined"
      ? document.createElement("canvas").getContext("2d") : null;
    if (context) context.font = `600 13px ${getComputedStyle(svg.current ?? document.documentElement).fontFamily}`;
    return new Map(renderedTargets.map(({ item }) => [item.targetId,
      context?.measureText(item.naam).width ?? item.naam.length * 7.5]));
  }, [renderedTargets]);
  const placedLabels = useMemo(() => {
    const candidates = renderedTargets.flatMap(({ item, center, isPoint, isLine }) => {
      if (!center || !Number.isFinite(center[0]) ||
          !(labels || item.targetId === correctTargetId || item.targetId === wrongTargetId)) return [];
      const x = center[0] * view.k + view.x, y = center[1] * view.k + view.y;
      if (x < 0 || x > 1000 || y < 0 || y > 680) return [];
      return [{ id: item.targetId, name: item.naam, x, y,
        width: labelWidths.get(item.targetId)! * pixelScale,
        kind: (isPoint ? "point" : isLine ? "line" : "area") as "point" | "line" | "area",
        required: item.targetId === correctTargetId || item.targetId === wrongTargetId ||
          (!!labels && !interactive && item.targetId === hoveredPoint) }];
    }).sort((a, b) => Number(b.id === correctTargetId || b.id === wrongTargetId) -
      Number(a.id === correctTargetId || a.id === wrongTargetId));
    return layoutMapLabels(candidates, screenPoints, pixelScale);
  }, [renderedTargets, labels, correctTargetId, wrongTargetId, view, pixelScale, screenPoints, labelWidths, interactive, hoveredPoint]);
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
        viewBox="0 0 1000 680"
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
              onTargetClick?.([target]);
            }
          }
        }}
      >
        <rect width="1000" height="680" className="sea-bg" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {backgroundPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              className="context-country"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {renderedTargets.map(({ item, center, isPoint, isLine, d }) => {
            if (!item.geometry) return null;
            const state =
              item.targetId === correctTargetId
                ? "correct"
                : item.targetId === wrongTargetId
                  ? "wrong"
                  : item.targetId === highlightedTargetId
                    ? "highlight"
                    : "neutral";
            const active = interactive;
            const props = {
              "data-target-id": item.targetId,
              tabIndex: active ? 0 : -1,
              role: active ? "button" : undefined,
              "aria-label":
                labels || state !== "neutral"
                  ? item.naam
                  : `Locatie ${visible.indexOf(item) + 1}`,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (active && ["Enter", " "].includes(e.key)) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.repeat) return;
                  onTargetClick?.([item.targetId]);
                }
              },
            };
            return (
              <g
                key={item.id}
                className={`map-feature state-${state} ${active ? "interactive" : ""} ${hoveredPoint === item.targetId ? "point-hover" : ""}`}
              >
                {isPoint && center ? (
                  <g {...props} className="point-target">
                    <circle
                      cx={center[0]}
                      cy={center[1]}
                      r={(23 * pixelScale) / view.k}
                      className="point-hit"
                    />
                    <circle
                      cx={center[0]}
                      cy={center[1]}
                      r={(10 * pixelScale) / view.k}
                      className="point"
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle
                      cx={center[0]}
                      cy={center[1]}
                      r={(3 * pixelScale) / view.k}
                      fill="white"
                      pointerEvents="none"
                    />
                  </g>
                ) : (
                  <>
                    <path
                      {...props}
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
                  </>
                )}

              </g>
            );
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
      <div className="map-caption">
        <span>{labels && placedLabels.length < visible.length
          ? "Zoom in of wijs een stad aan voor meer namen"
          : "Sleep of schuif met twee vingers · knijp om te zoomen"}</span>
        <span>Kaart: Natural Earth · zeeën: Marine Regions · gebergtes: GMBA</span>
      </div>
    </div>
  );
}
