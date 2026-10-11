import gzip
import json
import unittest
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from prepare_geo import marine_display, ROOT, MARINE_PROCESSING, count_vertices


class MarineDisplayTests(unittest.TestCase):
    def display(self, polygons):
        return shape(marine_display({'type': 'MultiPolygon', 'coordinates': [
            mapping(p)['coordinates'] for p in polygons
        ]}))

    def test_shared_basin_border_is_removed_without_losing_water(self):
        water = self.display([box(0, 0, 2, 2), box(2, 0, 4, 2)])
        self.assertEqual(len(water.geoms), 1)
        self.assertEqual(water.area, 8)
        # A former basin boundary must now be inside the filled water area.
        self.assertTrue(water.contains(LineString([(2, 0.2), (2, 1.8)])))
        self.assertTrue(water.boundary.intersection(LineString([(2, 0.2), (2, 1.8)])).is_empty)

    def test_keeps_large_islands_and_removes_tiny_display_artifacts(self):
        large = box(1, 1, 2, 2)
        tiny = box(3, 1, 3.01, 1.01)
        sea = Polygon(box(0, 0, 4, 4).exterior, [large.exterior, tiny.exterior])
        water = self.display([sea, box(6, 6, 6.01, 6.01)])
        self.assertFalse(water.contains(Point(1.5, 1.5)))
        self.assertTrue(water.contains(Point(3.005, 1.005)))
        self.assertEqual(len(water.geoms), 1)

    def test_keeps_disconnected_water_and_repairs_invalid_source_parts(self):
        bowtie = Polygon([(0, 0), (2, 2), (2, 0), (0, 2), (0, 0)])
        water = self.display([bowtie, box(5, 5, 6, 6)])
        self.assertTrue(water.is_valid)
        self.assertTrue(water.contains(Point(5.5, 5.5)))

    def test_fills_long_microscopic_slivers_without_filling_large_islands(self):
        sliver = box(1, 1, 3, 1.000001)
        sea = Polygon(box(0, 0, 4, 4).exterior, [sliver.exterior, box(2, 2, 3, 3).exterior])
        water = self.display([sea])
        self.assertTrue(water.contains(Point(2, 1.0000005)))
        self.assertFalse(water.contains(Point(2.5, 2.5)))

    def test_real_mediterranean_is_one_filled_sea_with_large_islands(self):
        path = ROOT / 'public/geo/water-middellandse-zee.json.gz'
        if not path.exists(): self.skipTest('Run prepare:geo first')
        with gzip.open(path) as stream: item = json.load(stream)
        self.assertEqual(item['provenance']['displayProcessing'], MARINE_PROCESSING)
        water = shape(item['geometry'])
        self.assertTrue(water.is_valid)
        self.assertEqual(len(water.geoms), 1)
        for lon, lat in [(12, 36), (18, 35), (30, 33), (15, 43), (25, 38.5)]:
            self.assertTrue(water.contains(Point(lon, lat)), (lon, lat))
        for lon, lat in [(9, 40), (14, 37.6), (25, 35.2), (33, 35)]:
            self.assertFalse(water.contains(Point(lon, lat)), (lon, lat))
        self.assertLess(count_vertices(item['geometry']['coordinates']), 6000)
        with gzip.open(ROOT / 'public/geo/water-middellandse-zee.full.json.gz') as stream:
            original = json.load(stream)
        self.assertEqual(count_vertices(original['geometry']['coordinates']), item['provenance']['vertices'])
        self.assertEqual(len(original['geometry']['coordinates']), 7)

    def test_all_prepared_seas_have_valid_processed_area_geometry(self):
        path = ROOT / 'public/geo/index.json.gz'
        if not path.exists(): self.skipTest('Run prepare:geo first')
        with gzip.open(path) as stream: index = json.load(stream)
        seas = [item for item in index if item['provenance']['provider'] == 'Marine Regions']
        self.assertGreater(len(seas), 100)
        for reference in seas:
            with self.subTest(sea=reference['naam']):
                with gzip.open(ROOT / 'public/geo' / reference['provenance']['file']) as stream:
                    item = json.load(stream)
                self.assertEqual(item['provenance']['displayProcessing'], MARINE_PROCESSING)
                self.assertIn('minimumFeatureAreaDegrees2', item['provenance'])
                water = shape(item['geometry'])
                self.assertTrue(water.is_valid)
                self.assertFalse(water.is_empty)


if __name__ == '__main__': unittest.main()
