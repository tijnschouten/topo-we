export interface GeoPointTarget {
  id: string;
  lon: number;
  lat: number;
  radius: number;
}

export interface GeoAreaTarget {
  id: string;
  lon: number;
  lat: number;
  dLon: number;
  dLat: number;
}

export interface GeoLine {
  id: string;
  points: Array<[number, number]>;
}

export const countryTargetToIsoNumeric: Record<string, string> = {
  'land-ierland': '372',
  'land-vk': '826',
  'land-nederland': '528',
  'land-belgie': '056',
  'land-luxemburg': '442',
  'land-duitsland': '276',
  'land-frankrijk': '250'
};

export const contextIsoNumeric = [
  '372', '826', '528', '056', '442', '276', '250',
  '724', '620', '380', '756', '040', '208'
];

export const placeTargets: GeoPointTarget[] = [
  { id: 'plaats-dublin', lon: -6.26, lat: 53.35, radius: 6.5 },
  { id: 'plaats-londen', lon: -0.1, lat: 51.5, radius: 6.5 },
  { id: 'plaats-glasgow', lon: -4.25, lat: 55.86, radius: 6.5 },
  { id: 'plaats-liverpool', lon: -2.98, lat: 53.41, radius: 6.5 },
  { id: 'plaats-amsterdam', lon: 4.9, lat: 52.37, radius: 6.5 },
  { id: 'plaats-brussel', lon: 4.35, lat: 50.85, radius: 6.5 },
  { id: 'plaats-antwerpen', lon: 4.4, lat: 51.22, radius: 6.5 },
  { id: 'plaats-luxemburg-stad', lon: 6.13, lat: 49.61, radius: 6.5 },
  { id: 'plaats-berlijn', lon: 13.4, lat: 52.52, radius: 6.5 },
  { id: 'plaats-hamburg', lon: 9.99, lat: 53.55, radius: 6.5 },
  { id: 'plaats-keulen', lon: 6.96, lat: 50.94, radius: 6.5 },
  { id: 'plaats-munchen', lon: 11.58, lat: 48.14, radius: 6.5 },
  { id: 'plaats-parijs', lon: 2.35, lat: 48.86, radius: 6.5 },
  { id: 'plaats-lyon', lon: 4.84, lat: 45.76, radius: 6.5 },
  { id: 'plaats-bordeaux', lon: -0.58, lat: 44.84, radius: 6.5 },
  { id: 'plaats-marseille', lon: 5.37, lat: 43.3, radius: 6.5 }
];

export const areaTargets: GeoAreaTarget[] = [
  { id: 'water-noordzee', lon: 3.5, lat: 56.0, dLon: 4.5, dLat: 2.8 },
  { id: 'water-atlantisch', lon: -8.5, lat: 47.0, dLon: 5.8, dLat: 9.0 },
  { id: 'water-kanaal', lon: -2.0, lat: 50.4, dLon: 4.2, dLat: 1.2 },
  { id: 'water-middellandse-zee', lon: 5.0, lat: 39.8, dLon: 9.0, dLat: 2.8 },
  { id: 'water-theems', lon: -0.5, lat: 51.45, dLon: 0.9, dLat: 0.35 },
  { id: 'water-schelde', lon: 4.4, lat: 51.25, dLon: 0.75, dLat: 0.35 },
  { id: 'water-rijn', lon: 7.2, lat: 50.8, dLon: 0.9, dLat: 2.6 },
  { id: 'water-donau', lon: 11.7, lat: 48.4, dLon: 2.6, dLat: 0.45 },
  { id: 'water-seine', lon: 2.0, lat: 49.1, dLon: 1.3, dLat: 0.5 },
  { id: 'water-rhone', lon: 4.9, lat: 46.2, dLon: 0.8, dLat: 2.2 },

  { id: 'gebied-schotland', lon: -4.3, lat: 56.3, dLon: 2.8, dLat: 2.0 },
  { id: 'gebied-engeland', lon: -1.8, lat: 52.6, dLon: 2.8, dLat: 2.3 },
  { id: 'gebied-vlaanderen', lon: 4.6, lat: 51.05, dLon: 1.0, dLat: 0.45 },
  { id: 'gebied-wallonie', lon: 5.0, lat: 50.3, dLon: 1.2, dLat: 0.55 },
  { id: 'gebied-ardennen', lon: 5.7, lat: 49.9, dLon: 1.2, dLat: 0.7 },
  { id: 'gebied-ruhr', lon: 7.2, lat: 51.5, dLon: 1.1, dLat: 0.5 },
  { id: 'gebied-alpen', lon: 9.2, lat: 46.8, dLon: 5.2, dLat: 1.1 },
  { id: 'gebied-pyreneeen', lon: 0.4, lat: 42.8, dLon: 3.8, dLat: 0.8 }
];

export const riverLines: GeoLine[] = [
  { id: 'water-theems', points: [[-1.0, 51.48], [-0.6, 51.5], [-0.1, 51.5], [0.4, 51.48]] },
  { id: 'water-schelde', points: [[3.3, 51.35], [3.8, 51.3], [4.2, 51.25], [4.4, 51.3]] },
  { id: 'water-rijn', points: [[8.2, 47.9], [8.0, 49.0], [7.2, 50.0], [6.8, 51.0], [5.8, 51.8], [4.5, 52.0]] },
  { id: 'water-donau', points: [[10.1, 48.2], [11.2, 48.2], [12.5, 48.3], [13.5, 48.2]] },
  { id: 'water-seine', points: [[3.2, 48.4], [2.7, 48.7], [2.35, 48.86], [1.5, 49.2], [0.4, 49.5]] },
  { id: 'water-rhone', points: [[6.2, 46.2], [5.5, 45.8], [4.8, 45.76], [4.8, 44.8], [4.8, 43.5]] }
];
