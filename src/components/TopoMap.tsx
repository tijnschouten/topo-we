import { geoCentroid, geoContains, geoMercator, geoPath } from 'd3-geo';
import { useMemo, useRef } from 'react';
import { feature } from 'topojson-client';
import countriesTopology from 'world-atlas/countries-50m.json';
import {
  areaTargets,
  contextIsoNumeric,
  countryTargetToIsoNumeric,
  placeTargets,
  riverLines
} from '../data/geoTargets';

interface TopoMapProps {
  interactive: boolean;
  onTargetClick?: (targetIds: string[]) => void;
  highlightedTargetId?: string;
  correctTargetId?: string;
  wrongTargetId?: string;
}

const isoToCountryTarget = Object.fromEntries(
  Object.entries(countryTargetToIsoNumeric).map(([targetId, iso]) => [iso, targetId])
) as Record<string, string>;

const westEuropeBounds = {
  minLon: -15,
  maxLon: 25,
  minLat: 35,
  maxLat: 63
};

const topology = countriesTopology as {
  objects: { countries: unknown };
};

const countriesGeo = feature(topology as never, topology.objects.countries as never) as unknown as {
  features: Array<{ id: string | number; geometry: GeoJSON.Geometry }>;
};
const rawFeatures = countriesGeo.features;

function isInWestEurope([lon, lat]: [number, number]): boolean {
  return (
    lon >= westEuropeBounds.minLon &&
    lon <= westEuropeBounds.maxLon &&
    lat >= westEuropeBounds.minLat &&
    lat <= westEuropeBounds.maxLat
  );
}

function filterGeometryToWestEurope(geometry: GeoJSON.Geometry): GeoJSON.Geometry | null {
  if (geometry.type === 'Polygon') {
    const center = geoCentroid({
      type: 'Feature',
      properties: {},
      geometry
    } as never) as [number, number];

    return isInWestEurope(center) ? geometry : null;
  }

  if (geometry.type === 'MultiPolygon') {
    const kept = geometry.coordinates.filter((polygonCoords) => {
      const center = geoCentroid({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: polygonCoords
        }
      } as never) as [number, number];

      return isInWestEurope(center);
    });

    if (kept.length === 0) return null;

    return {
      type: 'MultiPolygon',
      coordinates: kept
    };
  }

  return geometry;
}

function normalizeIso(input: string | number): string {
  return String(input).padStart(3, '0');
}

function targetState(
  id: string,
  highlightedTargetId?: string,
  correctTargetId?: string,
  wrongTargetId?: string
): 'correct' | 'wrong' | 'highlight' | 'neutral' {
  if (correctTargetId && id === correctTargetId) return 'correct';
  if (wrongTargetId && id === wrongTargetId) return 'wrong';
  if (highlightedTargetId && id === highlightedTargetId) return 'highlight';
  return 'neutral';
}

export default function TopoMap({
  interactive,
  onTargetClick,
  highlightedTargetId,
  correctTargetId,
  wrongTargetId
}: TopoMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const mapData = useMemo(() => {
    const cleanedFeatures = rawFeatures
      .map((item) => {
        const cleanedGeometry = filterGeometryToWestEurope(item.geometry);
        if (!cleanedGeometry) return null;

        return {
          ...item,
          geometry: cleanedGeometry
        };
      })
      .filter((item): item is (typeof rawFeatures)[number] => Boolean(item));

    const byIso = new Map(cleanedFeatures.map((item) => [normalizeIso(item.id), item] as const));

    const contextFeatures = contextIsoNumeric
      .map((iso) => byIso.get(iso))
      .filter((value): value is (typeof rawFeatures)[number] => Boolean(value));

    const projection = geoMercator();
    projection.fitExtent(
      [
        [70, 50],
        [930, 1245]
      ],
      {
        type: 'FeatureCollection',
        features: contextFeatures
      } as never
    );

    const path = geoPath(projection);

    return {
      byIso,
      contextFeatures,
      projection,
      path,
      focusCountries: contextFeatures
        .filter((country) => {
          const iso = normalizeIso(country.id);
          return Boolean(isoToCountryTarget[iso]);
        })
        .map((country) => ({
          country,
          targetId: isoToCountryTarget[normalizeIso(country.id)]
        }))
    };
  }, []);

  const handleClick = (ids: string[]) => {
    if (interactive && onTargetClick) {
      onTargetClick(ids);
    }
  };

  const projectPoint = (lon: number, lat: number): [number, number] | null => {
    const projected = mapData.projection([lon, lat]);
    return projected ? [projected[0], projected[1]] : null;
  };

  const projectRadii = (lon: number, lat: number, dLon: number, dLat: number) => {
    const center = mapData.projection([lon, lat]);
    const lonPoint = mapData.projection([lon + dLon, lat]);
    const latPoint = mapData.projection([lon, lat + dLat]);

    if (!center || !lonPoint || !latPoint) {
      return { x: 0, y: 0, rx: 0, ry: 0 };
    }

    return {
      x: center[0],
      y: center[1],
      rx: Math.abs(lonPoint[0] - center[0]),
      ry: Math.abs(latPoint[1] - center[1])
    };
  };

  const getTargetsAtClientPoint = (clientX: number, clientY: number): string[] => {
    const svg = svgRef.current;
    if (!svg) return [];

    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return [];

    const x = ((clientX - rect.left) / rect.width) * 1000;
    const y = ((clientY - rect.top) / rect.height) * 1300;

    const hits: string[] = [];
    const invert = mapData.projection.invert;
    const lonLat = invert ? invert([x, y]) : null;

    if (lonLat) {
      for (const entry of mapData.focusCountries) {
        if (geoContains(entry.country as never, lonLat)) {
          hits.push(entry.targetId);
        }
      }
    }

    for (const area of areaTargets) {
      const projected = projectRadii(area.lon, area.lat, area.dLon, area.dLat);
      if (projected.rx <= 0 || projected.ry <= 0) continue;
      const dx = x - projected.x;
      const dy = y - projected.y;
      const inside = (dx * dx) / (projected.rx * projected.rx) + (dy * dy) / (projected.ry * projected.ry) <= 1;
      if (inside) hits.push(area.id);
    }

    for (const point of placeTargets) {
      const projected = projectPoint(point.lon, point.lat);
      if (!projected) continue;
      const dx = x - projected[0];
      const dy = y - projected[1];
      const inside = Math.hypot(dx, dy) <= point.radius + 3;
      if (inside) hits.push(point.id);
    }

    return [...new Set(hits)];
  };

  return (
    <svg
      ref={svgRef}
      className="topo-map"
      viewBox="0 0 1000 1300"
      role="img"
      aria-label="Kaart van West-Europa"
      onClick={(event) => {
        if (!interactive) return;
        const hits = getTargetsAtClientPoint(event.clientX, event.clientY);
        if (hits.length > 0) {
          handleClick(hits);
        }
      }}
    >
      <rect x="0" y="0" width="1000" height="1300" className="sea-bg" />

      {mapData.contextFeatures.map((featureItem) => {
        const iso = normalizeIso(featureItem.id);
        const targetId = isoToCountryTarget[iso];
        const state = targetId
          ? targetState(targetId, highlightedTargetId, correctTargetId, wrongTargetId)
          : 'neutral';
        const pathData = mapData.path(featureItem as never);

        if (!pathData) return null;

        return (
          <path
            key={iso}
            d={pathData}
            data-target-id={targetId}
            className={`${targetId ? 'target focus-country' : 'context-country'} state-${state}`}
            tabIndex={interactive && targetId ? 0 : -1}
            onKeyDown={(event) => {
              if (!targetId) return;
              if (interactive && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                handleClick([targetId]);
              }
            }}
          />
        );
      })}

      {riverLines.map((river) => {
        const points = river.points
          .map(([lon, lat]) => projectPoint(lon, lat))
          .filter((value): value is [number, number] => Boolean(value));

        if (points.length < 2) return null;

        const d = points
          .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
          .join(' ');

        const state = targetState(river.id, highlightedTargetId, correctTargetId, wrongTargetId);

        return <path key={river.id} d={d} className={`river-line state-${state}`} />;
      })}

      {areaTargets.map((target) => {
        const area = projectRadii(target.lon, target.lat, target.dLon, target.dLat);
        const state = targetState(
          target.id,
          highlightedTargetId,
          correctTargetId,
          wrongTargetId
        );

        return (
          <ellipse
            key={target.id}
            cx={area.x}
            cy={area.y}
            rx={area.rx}
            ry={area.ry}
            data-target-id={target.id}
            className={`target area state-${state}`}
            tabIndex={interactive ? 0 : -1}
            onKeyDown={(event) => {
              if (interactive && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                handleClick([target.id]);
              }
            }}
          />
        );
      })}

      {placeTargets.map((target) => {
        const point = projectPoint(target.lon, target.lat);
        if (!point) return null;

        const state = targetState(
          target.id,
          highlightedTargetId,
          correctTargetId,
          wrongTargetId
        );

        return (
          <circle
            key={target.id}
            cx={point[0]}
            cy={point[1]}
            r={target.radius}
            data-target-id={target.id}
            className={`target point state-${state}`}
            tabIndex={interactive ? 0 : -1}
            onKeyDown={(event) => {
              if (interactive && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                handleClick([target.id]);
              }
            }}
          />
        );
      })}
    </svg>
  );
}
