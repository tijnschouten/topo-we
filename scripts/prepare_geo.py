"""Reproducible source-data conversion; keeps every source vertex (6 decimals).

The full geometries are static, compressed, and loaded only after selection.
No drawing, interpolated boundaries, or point fallback for a river/range.
"""
import argparse
import gzip
import hashlib
import json
import math
import os
import time
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = 9
MARINE_SIMPLIFICATION = 0.025
MARINE_MINIMUM_FEATURE = 0.05
MARINE_PROCESSING = 'dissolve-before-simplify-v2'
SOURCES = {
    'iho': ('https://geo.vliz.be/geoserver/MarineRegions/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=MarineRegions:iho&outputFormat=application/json&srsName=EPSG:4326&sortBy=mrgid', '9657e1861df75364f74fdae1e03701e4475bfac74563a6e57e3bcbe3927ffd0d'),
    'marine': ('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_geography_marine_polys.geojson', '53f865e8ffa966cdd402145c82c5cd14ee7ce974cd0eb9a3f59f03a4cfd2d66c'),
    'ocean': ('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_ocean.geojson', 'f9696a1337c746a0f6c8c13bc60d0f230d2ef8d105198d5657726c8f8e763fc2'),
    'rivers': ('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_rivers_lake_centerlines.geojson', 'bb854a900ecbd3b408df46d5e16e3e0f974ba55993f9d8b5c26e855273c0905a'),
    'countries': ('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_countries.geojson', '239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255'),
    'cities': ('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_populated_places.geojson', '9b8e3de09048ef00dfc70357dbb9fa324493f214b5e0ae4daf1aa79a8d10116b'),
    'gmba_broad': ('https://data.earthenv.org/mountains/broad/GMBA_Inventory_v2.0_broad.zip', '5840914988bbb9cb31fb0881262ad206895d95d361f7929da67f3984cb6c1c72'),
    'gmba': ('https://data.earthenv.org/mountains/standard/GMBA_Inventory_v2.0_standard.zip', '3d67de8143beba5ce427cb2c3041194079fe070b371ac0a2bce91f3bc62d9d27'),
}
SOURCE_SNAPSHOTS = {
    'iho': 'https://github.com/tijnschouten/topo-we/releases/download/geo-sources-v1/topo-iho-source.json.gz',
}
ALIASES = {'Rhine': ['Rijn'], 'Thames': ['Theems'], 'Danube': ['Donau'], 'Schelde': ['Schelde', 'Scheldt'], 'Rhône': ['Rhône', 'Rhone'], 'Seine': ['Seine'], 'Amazonas': ['Amazone', 'Amazon'], 'Amazon': ['Amazone', 'Amazonas'], 'Nile': ['Nijl'], 'European Alps': ['Alpen'], 'Pyrenees': ['Pyreneeën', 'Pyreneeen'], 'Ardennes': ['Ardennen'], 'Himalaya': ['Himalaya', 'Himalayas'], 'Andes': ['Andes'], 'Rocky Mountains': ['Rocky Mountains'], 'Carpathians': ['Karpaten'], 'Atlas Mountains': ['Atlas'], 'Ural Mountains': ['Oeral']}
ALIASES.update({'Volga':['Wolga'], 'Ural':['Oeral'], 'Caucasus':['Kaukasus'], 'Greater Caucasus':['Grote Kaukasus','Kaukasus']})
CITY_COUNTRIES = {"Dublin":"Ireland", "Londen":"United Kingdom", "Glasgow":"United Kingdom", "Liverpool":"United Kingdom", "Amsterdam":"Netherlands", "Brussel":"Belgium", "Antwerpen":"Belgium", "Luxemburg":"Luxembourg", "Berlijn":"Germany", "Hamburg":"Germany", "Keulen":"Germany", "München":"Germany", "Parijs":"France", "Lyon":"France", "Bordeaux":"France", "Marseille":"France"}
DUTCH = {'Rhine': 'Rijn', 'Thames': 'Theems', 'Danube': 'Donau', 'European Alps': 'Alpen', 'Pyrenees': 'Pyreneeën', 'Ardennes': 'Ardennen', 'Amazonas': 'Amazone', 'Amazon': 'Amazone', 'Nile': 'Nijl'}
DUTCH.update({'Ural Mountains':'Oeral','Caucasus Mountains':'Kaukasus','Volga':'Wolga','Ural':'Oeral','Caucasus':'Kaukasus','Greater Caucasus':'Grote Kaukasus'})
LEGACY = {'land-ierland': ('land', 'Ierland'), 'land-vk': ('land', 'Verenigd Koninkrijk'), 'land-nederland': ('land', 'Nederland'), 'land-belgie': ('land', 'België'), 'land-luxemburg': ('land', 'Luxemburg'), 'land-duitsland': ('land', 'Duitsland'), 'land-frankrijk': ('land', 'Frankrijk'), 'plaats-dublin': ('plaats', 'Dublin'), 'plaats-londen': ('plaats', 'Londen'), 'plaats-glasgow': ('plaats', 'Glasgow'), 'plaats-liverpool': ('plaats', 'Liverpool'), 'plaats-amsterdam': ('plaats', 'Amsterdam'), 'plaats-brussel': ('plaats', 'Brussel'), 'plaats-antwerpen': ('plaats', 'Antwerpen'), 'plaats-luxemburg-stad': ('plaats', 'Luxemburg'), 'plaats-berlijn': ('plaats', 'Berlijn'), 'plaats-hamburg': ('plaats', 'Hamburg'), 'plaats-keulen': ('plaats', 'Keulen'), 'plaats-munchen': ('plaats', 'München'), 'plaats-parijs': ('plaats', 'Parijs'), 'plaats-lyon': ('plaats', 'Lyon'), 'plaats-bordeaux': ('plaats', 'Bordeaux'), 'plaats-marseille': ('plaats', 'Marseille'), 'water-theems': ('water', 'Theems'), 'water-schelde': ('water', 'Schelde'), 'water-rijn': ('water', 'Rijn'), 'water-donau': ('water', 'Donau'), 'water-seine': ('water', 'Seine'), 'water-rhone': ('water', 'Rhône'), 'gebied-alpen': ('gebied', 'Alpen'), 'gebied-pyreneeen': ('gebied', 'Pyreneeën'), 'gebied-ardennen': ('gebied', 'Ardennen')}
LEGACY.update({'water-noordzee':('water','Noordzee'), 'water-kanaal':('water','Het Kanaal'), 'water-atlantische-oceaan':('water','Atlantische Oceaan'), 'water-middellandse-zee':('water','Middellandse Zee')})


def download(cache, key):
    url, expected = SOURCES[key]
    path = cache / (key + ('.zip' if key.startswith('gmba') else '.json'))
    if not path.exists():
        download_url = SOURCE_SNAPSHOTS.get(key, url)
        print('Downloading', key, '(compressed snapshot)' if key in SOURCE_SNAPSHOTS else '', flush=True)
        request = urllib.request.Request(download_url, headers={'User-Agent': 'TopoTrainer-source-build/1.0'})
        temp = path.with_suffix('.download')
        try:
            started = time.monotonic()
            received = 0
            next_report = 16 * 1024 * 1024
            with urllib.request.urlopen(request, timeout=30) as source, temp.open('wb') as target:
                while chunk := source.read(1024 * 1024):
                    target.write(chunk)
                    received += len(chunk)
                    if time.monotonic() - started > 600:
                        raise TimeoutError(f'{key}: download exceeded 10 minutes')
                    if received >= next_report:
                        print(f'{key}: {received / 1024 / 1024:.0f} MiB downloaded', flush=True)
                        next_report = received + 16 * 1024 * 1024
            if key in SOURCE_SNAPSHOTS:
                temp.write_bytes(gzip.decompress(temp.read_bytes()))
            if key == 'iho':
                # WFS includes a request timestamp. Pin semantic source content,
                # excluding only response metadata; preserve every original feature.
                data = json.loads(temp.read_text())
                if len(data.get('features', [])) != 101:
                    raise ValueError('Incomplete IHO source response')
                features = sorted(data['features'], key=lambda f:f['properties']['mrgid'])
                temp.write_text(json.dumps({'type':'FeatureCollection','features':features}, sort_keys=True, separators=(',',':'), ensure_ascii=False))
            if hashlib.sha256(temp.read_bytes()).hexdigest() != expected:
                raise ValueError(f'{key}: source checksum changed; inspect the new release before updating.')
            temp.rename(path)
            print(f'{key}: downloaded and checksum verified', flush=True)
        finally:
            temp.unlink(missing_ok=True)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != expected:
        raise ValueError(f'{key}: source checksum changed; inspect the new release before updating.')
    return path


def round_coordinates(coords):
    if coords and isinstance(coords[0], (int, float)):
        if not all(math.isfinite(x) for x in coords[:2]):
            raise ValueError('Non-finite source coordinate')
        return [round(x, 6) for x in coords[:2]]
    return [round_coordinates(c) for c in coords]


def count_vertices(coords):
    if coords and isinstance(coords[0], (int, float)):
        return 1
    return sum(count_vertices(c) for c in coords)


def write_gzip(path, obj):
    raw = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode()
    path.write_bytes(gzip.compress(raw, compresslevel=6, mtime=0))


def marine_display(geometry):
    from shapely import make_valid, union_all
    from shapely.geometry import shape, Polygon, mapping
    polygons = geometry['coordinates'] if geometry['type']=='MultiPolygon' else [geometry['coordinates']]
    def polygon_parts(g):
        if g.geom_type == 'Polygon': return [g]
        if hasattr(g, 'geoms'): return [p for part in g.geoms for p in polygon_parts(part)]
        return []
    def visible(ring):
        west,south,east,north = ring.bounds
        # Width alone keeps long, microscopic gaps between source basins.
        return (max(east-west,north-south) >= MARINE_MINIMUM_FEATURE and
                Polygon(ring).area >= MARINE_MINIMUM_FEATURE ** 2)
    # Dissolve original shared boundaries BEFORE simplifying: simplifying each
    # basin separately creates gaps and leaves artificial lines across the sea.
    parts = []
    for coords in polygons:
        p = shape({'type':'Polygon','coordinates':coords})
        # Apply the same cartographic hole filter before repair too: thousands
        # of invisible, invalid island rings can make GEOS repair very expensive.
        p = Polygon(p.exterior, [ring for ring in p.interiors if visible(ring)])
        parts.extend(polygon_parts(p if p.is_valid else make_valid(p, method='structure', keep_collapsed=False)))
    dissolved = union_all(parts, grid_size=0.000001)
    if dissolved.is_empty: raise ValueError('Sea has no polygonal source area')
    simplified = dissolved.simplify(MARINE_SIMPLIFICATION, preserve_topology=True)
    parts = polygon_parts(simplified)
    result = []
    largest = max(parts, key=lambda p:p.area)
    for p in parts:
        if p is not largest and not visible(p.exterior): continue
        display = Polygon(p.exterior, [ring for ring in p.interiors if visible(ring)])
        result.append(round_coordinates(mapping(display)['coordinates']))
    return {'type':'MultiPolygon','coordinates':result}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache-dir', default=str(ROOT / 'node_modules/.cache/topo-geo'))
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    out = ROOT / 'public/geo'
    manifest = out / 'manifest.json'
    hashes = {k: v[1] for k, v in SOURCES.items()}
    if not args.force and manifest.exists():
        existing = json.loads(manifest.read_text())
        if existing.get('schema') == SCHEMA and existing.get('hashes') == hashes and all((out / f['id']).with_suffix('.json.gz').exists() for f in existing.get('files', [])) and (out / 'index.json.gz').exists():
            print('Source geometry is prepared.'); return
    import shapefile
    from shapely.geometry import shape, mapping
    cache = Path(args.cache_dir); cache.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    paths = {key: download(cache, key) for key in SOURCES}
    index = []
    references = []
    used_legacy = set()

    def add(id, name, category, geometry, aliases, hint, provider, source, source_id, wikidata=None, gmba_extent="Standard", metadata=None, source_key=None, version=None):
        if not name or not geometry:
            return
        geometry = {'type': geometry['type'], 'coordinates': round_coordinates(geometry['coordinates'])}
        legacy = next((target for target, (cat, label) in LEGACY.items() if cat == category and label == name and target not in used_legacy and (category != "plaats" or hint.startswith(CITY_COUNTRIES[label] + " ·"))), None)
        if legacy:
            id = legacy; used_legacy.add(legacy)
        key = source_key or (('gmba_broad' if gmba_extent == 'Broad' else 'gmba') if provider == 'GMBA' else {'land':'countries','water':'rivers','plaats':'cities'}[category])
        details = {'provider': provider, 'version': version or (f'2.0 {gmba_extent}' if provider == 'GMBA' else '5.1.2 / 1:10m'), 'url': source, 'recordId': str(source_id), 'vertices': count_vertices(geometry['coordinates']), 'license': 'CC BY 4.0' if provider in {'GMBA','Marine Regions'} else 'Public domain', 'sha256': hashes[key], 'file': f'{id}.json.gz'}
        item = {'id': id, 'targetId': id, 'naam': name, 'categorie': category, 'hint': hint, 'source': source, 'provenance': details, 'approximate': False, 'aliases': list(dict.fromkeys(a for a in aliases if a and a != name))}
        if metadata: item.update(metadata)
        if wikidata: item['wikidataId'] = wikidata
        # Marine coastlines carry up to 767k points. Keep an exact source copy,
        # serve a topology-preserving cartographic version for this regional quiz.
        if provider == 'Marine Regions':
            details['detailFile'] = f'{id}.full.json.gz'
            details['simplificationDegrees'] = MARINE_SIMPLIFICATION
            details['minimumFeatureDegrees'] = MARINE_MINIMUM_FEATURE
            details['minimumFeatureAreaDegrees2'] = MARINE_MINIMUM_FEATURE ** 2
            details['displayProcessing'] = MARINE_PROCESSING
            original = geometry
            geometry = marine_display(geometry)
            details['displayVertices'] = count_vertices(geometry['coordinates'])
            write_gzip(out / details['detailFile'], {**item,'geometry':original})
        # Metadata stays separate: searching never downloads all polygons.
        index.append(item)
        full = {**item, 'geometry': geometry}
        write_gzip(out / details['file'], full)
        if legacy and provider != "Marine Regions": references.append(full)

    marine = json.loads(paths['marine'].read_text())['features']
    marine_names = {f['properties']['name']: f['properties'] for f in marine if f['properties'].get('name')}
    iho = json.loads(paths['iho'].read_text())['features']
    def parts(features):
        return [p for f in features for p in (f['geometry']['coordinates'] if f['geometry']['type']=='MultiPolygon' else [f['geometry']['coordinates']])]
    source = 'https://doi.org/10.14284/323'
    def add_sea(id, name, features, aliases, qid=None):
        add(id, name, 'water', {'type':'MultiPolygon','coordinates':parts(features)}, aliases,
            ('Noordelijke IJszee inclusief noordelijke randzeeën (o.a. Barentszzee boven Noorwegen) · IHO / Marine Regions' if name=='Noordelijke IJszee' and len(features)>1 else f'{name} · zeegebied uit IHO / Marine Regions'), 'Marine Regions', source,
            '+'.join(str(f['properties']['mrgid']) for f in features), qid, source_key='iho', version='IHO Sea Areas v3 (2018)')
    atlantic = [f for f in iho if f['properties']['name'] in {'North Atlantic Ocean','South Atlantic Ocean'}]
    add_sea('iho-atlantic', 'Atlantische Oceaan', atlantic, ['Atlantic Ocean','Atlantische oceaan'], 'Q97')
    mediterranean_names = {'Mediterranean Sea - Western Basin','Mediterranean Sea - Eastern Basin','Adriatic Sea','Aegean Sea','Ionian Sea','Ligurian Sea','Tyrrhenian Sea'}
    mediterranean = [f for f in iho if f['properties']['name'] in mediterranean_names]
    add_sea('iho-mediterranean', 'Middellandse Zee', mediterranean, ['Mediterranean Sea'], 'Q4918')
    arctic_names = {'Arctic Ocean','Barentsz Sea','Greenland Sea','Kara Sea','White Sea','Laptev Sea','East Siberian Sea','Chukchi Sea','Beaufort Sea','Lincoln Sea'}
    arctic = [f for f in iho if f['properties']['name'] in arctic_names]
    add_sea('iho-1906', 'Noordelijke IJszee', arctic, ['Arctic Ocean','Noordelijke ijszee','Arctische Oceaan'], 'Q788')
    index[-1]['hint'] = 'Noordelijke IJszee inclusief noordelijke randzeeën (o.a. Barentszzee boven Noorwegen) · IHO / Marine Regions'
    # The central basin remains available separately under its precise name.
    for f in iho:
        name = f['properties']['name']; p = marine_names.get(name, {})
        dutch = {'Arctic Ocean':'Noordelijke IJszee','North Sea':'Noordzee','English Channel':'Het Kanaal','Black Sea':'Zwarte Zee','Strait of Gibraltar':'Straat van Gibraltar'}.get(name, p.get('name_nl') or name)
        if name in {'North Atlantic Ocean','South Atlantic Ocean'}: dutch = 'Noord-Atlantische Oceaan' if name.startswith('North') else 'Zuid-Atlantische Oceaan'
        aliases = [name] + [v for k,v in p.items() if k.startswith('name_') and v]
        if name=='Arctic Ocean': aliases += ['Noordelijke ijszee','Arctische Oceaan','Arctische oceaan']
        if name=='Arctic Ocean':
            dutch = 'Noordelijke IJszee (centraal poolbekken)'
            aliases = ['Arctic Ocean central basin','Centraal poolbekken']
        add_sea('iho-arctic-central' if name=='Arctic Ocean' else f"iho-{f['properties']['mrgid']}", dutch, [f], aliases, p.get('wikidataid'))
    # The Caspian is an inland sea in Natural Earth's Ocean layer, not Lakes.
    # Identify its disconnected source polygon using the marine label's centre;
    # keep the full original coast, not the coarse label polygon or a drawn outline.
    caspian = marine_names['Caspian Sea']
    marine_shape = next(f['geometry'] for f in marine if f['properties'].get('name')=='Caspian Sea')
    ring = marine_shape['coordinates'][0]
    x = (min(p[0] for p in ring)+max(p[0] for p in ring))/2
    y = (min(p[1] for p in ring)+max(p[1] for p in ring))/2
    def contains(ring):
        inside = False
        for a,b in zip(ring, ring[1:]):
            if (a[1]>y) != (b[1]>y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: inside = not inside
        return inside
    caspian_parts = [p for p in parts(json.loads(paths['ocean'].read_text())['features']) if contains(p[0]) and not any(contains(hole) for hole in p[1:])]
    if len(caspian_parts)!=1: raise ValueError('Caspian source polygon is ambiguous')
    add('ne-sea-caspian', 'Kaspische Zee', 'water', {'type':'MultiPolygon','coordinates':caspian_parts}, ['Caspian Sea'], 'Kaspische Zee · inlandse zee uit Natural Earth Ocean', 'Natural Earth', 'https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-ocean/', 'Ocean / Caspian component', caspian.get('wikidataid'), source_key='ocean')
    countries = json.loads(paths['countries'].read_text())['features']
    country_names = {f['properties']['ADM0_A3']: f['properties'].get('NAME_NL') or f['properties']['NAME'] for f in countries}
    country_continents = {f['properties']['ADM0_A3']: f['properties']['CONTINENT'] for f in countries}
    for f in countries:
        p = f['properties']; names = [v for k,v in p.items() if k.startswith('NAME') and isinstance(v, str)]
        add(f"ne-country-{p['NE_ID']}", p.get('NAME_NL') or p['NAME'], 'land', f['geometry'], names, f"{p['NAME_EN']} · landgrens uit Natural Earth", 'Natural Earth', 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/', p['NE_ID'], p.get('WIKIDATAID'), metadata={'countryCode':p['ADM0_A3'], 'continent':p['CONTINENT']})
    for f in json.loads(paths['cities'].read_text())['features']:
        p = f['properties']; names = [v for k,v in p.items() if k.startswith('NAME') and isinstance(v, str)]
        add(f"ne-city-{p['NE_ID']}", p.get('NAME_NL') or p['NAME'], 'plaats', f['geometry'], names, f"{p['ADM0NAME']} · {p['ADM1NAME'] or 'stad'}", 'Natural Earth', 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/', p['NE_ID'], p.get('WIKIDATAID'), metadata={'countryCode':p['ADM0_A3'], 'countryName':country_names.get(p['ADM0_A3'],p['ADM0NAME']), 'regionName':p['ADM1NAME'] or '', 'capital':p['ADM0CAP'] == 1, 'continent':country_continents.get(p['ADM0_A3'],'')})
    rivers = json.loads(paths['rivers'].read_text())['features']
    # Both Danube/Donau records are sections of the same named waterway.
    # Retain their original parts; never draw a bridge between disjoint segments.
    danube = [f for f in rivers if f['properties'].get('name_en') == 'Danube']
    if danube:
        parts = [line for f in danube for line in (f['geometry']['coordinates'] if f['geometry']['type'] == 'MultiLineString' else [f['geometry']['coordinates']])]
        add('ne-river-danube', 'Donau', 'water', {'type':'MultiLineString', 'coordinates':parts}, ['Danube','Donau'], 'Donau · rivierloop uit Natural Earth', 'Natural Earth', 'https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-rivers-lake-centerlines/', '+'.join(str(f['properties']['rivernum']) for f in danube))
    for english, dutch in [('Volga','Wolga'),('Ural','Oeral')]:
        sections = [f for f in rivers if (f['properties'].get('name_en') or f['properties'].get('name')) == english]
        if sections:
            lines = [line for f in sections for line in (f['geometry']['coordinates'] if f['geometry']['type']=='MultiLineString' else [f['geometry']['coordinates']])]
            add(f'ne-river-{english.lower()}', dutch, 'water', {'type':'MultiLineString','coordinates':lines}, [english,dutch], f'{dutch} · volledige bronsecties uit Natural Earth', 'Natural Earth', 'https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-rivers-lake-centerlines/', '+'.join(str(f['properties']['rivernum']) for f in sections))
    for n, f in enumerate(rivers):
        p = f['properties']; name = p.get('name_en') or p.get('name')
        if not name or name in {'Danube','Volga','Ural'}: continue
        names = [p.get('name'), p.get('name_en'), p.get('name_alt')] + ALIASES.get(name, [])
        add(f'ne-river-{n}', DUTCH.get(name, name), 'water', f['geometry'], names, f"{name} · rivierloop uit Natural Earth", 'Natural Earth', 'https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-rivers-lake-centerlines/', p['dissolve'])
    # Standard keeps only terrain satisfying the strict GMBA mountain definition.
    # For the low Ardennes this leaves a 20.6 km² fragment. Geography practice
    # needs the sourced landscape extent (including valleys), not that terrain mask.
    # Broad is used explicitly for this range only; never buffer/hand-draw a boundary.
    broad_ardennes = None
    with zipfile.ZipFile(paths['gmba_broad']) as archive:
        stem = 'GMBA_Inventory_v2.0_broad'
        with shapefile.Reader(shp=archive.open(stem+'.shp'), dbf=archive.open(stem+'.dbf'), shx=archive.open(stem+'.shx'), encoding='utf-8') as reader:
            for record in reader.iterShapeRecords():
                if record.record.as_dict()['GMBA_V2_ID'] == 15486:
                    broad_ardennes = record.shape.__geo_interface__
                    break
    if broad_ardennes is None:
        raise ValueError('Missing official Broad Ardennes geometry')
    with zipfile.ZipFile(paths['gmba']) as archive:
        stem = 'GMBA_Inventory_v2.0_standard'
        with shapefile.Reader(shp=archive.open(stem+'.shp'), dbf=archive.open(stem+'.dbf'), shx=archive.open(stem+'.shx'), encoding='utf-8') as reader:
            for n, record in enumerate(reader.iterShapeRecords()):
                p = record.record.as_dict(); name = p['MapName']
                # Top-level continents/groupings are not individual mountain ranges.
                if p['Feature'] not in {'Mountain range with well-recognized name', 'Geographically-defined sub-range', 'Highland or plateau', 'Point Defined Range', 'Area dominated by a single large peak', 'Escarpment / Canyon'}: continue
                names = [p['AsciiName'], p['DBaseName']] + [v for k,v in p.items() if k.startswith('Name_') and v] + ALIASES.get(name, [])
                qid = p.get('WikiDataUR', '').split('/')[-1]
                is_ardennes = p['GMBA_V2_ID'] == 15486
                geometry = broad_ardennes if is_ardennes else record.shape.__geo_interface__
                hint = 'België, Frankrijk, Luxemburg · Ardennen · landschapscontour, inclusief dalen (GMBA Broad)' if is_ardennes else f"{p['Countries']} · {name} · GMBA niveau {p['Hier_Lvl']}"
                add(f"gmba-{p['GMBA_V2_ID']}", DUTCH.get(name, name), 'gebied', geometry, names, hint, 'GMBA', 'https://doi.org/10.48601/earthenv-t9k2-1407', p['GMBA_V2_ID'], qid if qid.startswith('Q') else None, gmba_extent='Broad' if is_ardennes else 'Standard')
                if n % 1000 == 0: print('Converted GMBA', n, flush=True)
    # Stable example set: only items with source geometry, never old hand sketches.
    references.sort(key=lambda i: list(LEGACY).index(i['id']))
    (ROOT / 'src/data').mkdir(parents=True, exist_ok=True)
    (ROOT / 'src/data/referenceCatalog.json').write_text(json.dumps(references, ensure_ascii=False, separators=(',', ':')))
    write_gzip(out / 'index.json.gz', index)
    wanted = {i['provenance']['file'] for i in index} | {i['provenance']['detailFile'] for i in index if i['provenance'].get('detailFile')} | {'index.json.gz'}
    for stale in out.glob('*.json.gz'):
        if stale.name not in wanted: stale.unlink()
    manifest.write_text(json.dumps({'schema': SCHEMA, 'hashes': hashes, 'sources': {k:v[0] for k,v in SOURCES.items()}, 'count':len(index), 'files':[{'id': i['id'], 'detailFile': i['provenance'].get('detailFile')} for i in index]}, separators=(',', ':')))
    print('Prepared',len(index),'source features;',len(references),'example locations; compressed geometry',round(sum(p.stat().st_size for p in out.glob('*.gz'))/1024**2,1),'MB', flush=True)
    missing = set(LEGACY)-used_legacy
    if missing: print('Unavailable example items (not invented):', ', '.join(sorted(missing)))

if __name__ == '__main__': main()
