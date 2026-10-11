# topo. — Oefenen met brongeometrie

Een React/Vite-app om topografiesets samen te stellen met steden, landen, rivierlopen en gebergtegebieden. Je zoekt op naam; de app haalt de geometrie uit versievaste bronbestanden. Je hoeft niets te tekenen.

## Bronnen

- **Zeeën en oceanen: Flanders Marine Institute (2018), [IHO Sea Areas v3](https://doi.org/10.14284/323), CC BY 4.0.** 101 brongebieden uit de officiële Marine Regions WFS. De volledige Atlantische Oceaan combineert de noordelijke en zuidelijke brongebieden; de Middellandse Zee de twee bekkens plus Adriatische, Egeïsche, Ionische, Ligurische en Tyrreense Zee. Onderdelen blijven ook afzonderlijk zoekbaar. [Bronbeschrijving](https://marineregions.org/sources.php), [licentie](https://marineregions.org/disclaimer.php). Bronkustlijnen worden behouden; deze kunnen iets afwijken van de Natural Earth-achtergrond. De SHA-256 controleert de canonieke GeoJSON-features; uitsluitend de WFS-responsmetadata (zoals verzoekdatum) wordt uitgesloten. De volledige bronkopieën behouden alle bronvertices. Voor de interactieve kaart worden aparte lichte geometrieën geserveerd.
- **Kaspische Zee: Natural Earth 1:10m Ocean.** De bron behandelt dit als inlandse zee, niet als meer. De aparte waterpolygoon wordt geïdentificeerd met het zeegebied uit de marine-namenlaag; de oorspronkelijke gedetailleerde kust blijft behouden. [Bron](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-ocean/).


- **Gebergtes: GMBA Mountain Inventory v2.0, Standard extent; Ardennen: Broad extent.** Wetenschappelijke gebergtepolygons, inclusief deelgebergtes. Snethlage et al. (2022), [publicatie](https://doi.org/10.1038/s41597-022-01256-y) en [dataset](https://doi.org/10.48601/earthenv-t9k2-1407), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). GMBA is een expliciete definitie van bergachtig terrein; gebergtes hebben geen universele administratieve grenzen. De bibliotheek neemt benoemde gebergtes, deelgebergtes en hooglanden op; continenten en naamloze hulppolygons worden uitgesloten.
- **Rivieren: Natural Earth 5.1.2, 1:10m rivers and lake centerlines.** [Bronbeschrijving](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-rivers-lake-centerlines/). Werkelijke bronlijnen, geen handgetekende verbindingen. De Donau combineert de twee Natural Earth-records Danube/Donau als afzonderlijke oorspronkelijke lijnstukken; er worden geen ontbrekende stukken geïnterpoleerd. Gelijknamige andere rivieren blijven afzonderlijke resultaten.
- **Landgrenzen en steden: Natural Earth 5.1.2, 1:10m.** [Landgrenzen](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/), [steden](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/), [publiek domein](https://www.naturalearthdata.com/about/terms-of-use/). De wereldkaart op de achtergrond gebruikt 1:50m; de oefendoelen gebruiken 1:10m-brongeometrie.
- **Aanvullend naamzoeken: Wikidata.** Nederlandse namen koppelen via Wikidata-ID aan bestaande bronpolygons. Alleen steden kunnen een geverifieerd P625-coördinaat krijgen als aanvullend resultaat. Een Wikidata-punt wordt nooit een vervanging voor een rivier of gebergtegebied. Zie [API-richtlijnen](https://www.mediawiki.org/wiki/API:Etiquette).

Voor de Ardennen gebruikt de app expliciet de **Broad-landschapscontour** (574 bronvertices), inclusief dalen en omliggend terrein. Het Standard-record 15486 bevat slechts circa 20,6 km² met 17 vertices rond 5,76°E / 50,44°N en is daardoor ongeschikt als herkenbaar Ardennengebied voor deze quiz. Broad is hier een geografisch oefengebied, **geen masker van uitsluitend bergachtig terrein**; voor wetenschappelijke analyses van bergachtig terrein adviseert GMBA intersectie met een bergdefinitie. De wijziging migreert alleen de bekende oude Ardennenbronverwijzing; andere bronversiemismatches blijven geweigerd.

De volledige bronkopieën houden alle bronvertices en ronden coördinaten af op zes decimalen. Voor zeeën/oceanen maakt de converter daarnaast een kaartversie: Shapely voegt eerst alle brongebieden van dezelfde zee samen (dissolve/union), zodat grenzen tussen bekkens verdwijnen. Pas daarna wordt de gezamenlijke kust met topologiebehoud vereenvoudigd, met tolerantie 0,025 graad (circa 2,8 km in breedterichting). Eilandjes/losse waterfragmenten kleiner dan 0,05 graad in breedte én hoogte, of met een oppervlak kleiner dan 0,0025 vierkante graad, worden in de kaartversie weggelaten. Dit verwijdert ook lange microscopische spleten tussen brongebieden; het grootste watergebied en grote eilanden blijven behouden. Deze vaste verwerking geldt voor alle Marine Regions-zeeën en oceanen. De oorspronkelijke brongeometrie blijft als `.full.json.gz` beschikbaar, vermeld in `provenance.detailFile`. Bronpunten en kaartpunten worden afzonderlijk geregistreerd. Zo hoeft de browser geen miljoenen onzichtbare kustpunten te verwerken. Andere bronlagen worden niet vereenvoudigd.

De standaard Noordelijke IJszee combineert het centrale poolbekken met Barentszzee, Groenlandzee, Karazee, Witte Zee, Laptevzee, Oost-Siberische Zee, Tsjoektsjenzee, Beaufortzee en Lincolnzee uit dezelfde IHO-bron. Daardoor hoort het zeegebied direct boven Noord-Noorwegen bij het oefendoel. Het centrale IHO-poolbekken blijft apart zoekbaar. De Noorse Zee blijft apart omdat de indeling daarvan tussen Atlantisch en Arctisch verschilt. Europese kaartfocus blijft gelijk wanneer de Noordelijke IJszee wordt toegevoegd; de oceaan dwingt de uitsnede niet richting de pool. Natural Earth zelf is **gegeneraliseerd voor schaal 1:10 miljoen**: geschikt voor regionale topografie, niet voor landmeting of elk detail bij straatzoom. Ook zijn niet alle rivieren/steden in de bron opgenomen. Ontbrekende brongeometrie wordt gemeld; de app verzint geen lijn, gebied of oriëntatiepunt.

De app vermeldt bron, versie en aantal bronpunten. De voorbeeldset bevat 32 bronlocaties. De volledige bibliotheek bevat 15.723 locaties. Bijvoorbeeld: Rijn 279 bronvertices, Alpen 6.435 bronvertices. Het voorbereiden resulteert in ongeveer 175 MB gecomprimeerde bronbestanden; de browser downloadt alleen het zoekregister en de gekozen geometrieën.

## Lokaal starten

De geodata wordt automatisch voorbereid vóór een build. Een eerste checkout vereist Python 3.12+ en de converterdependency. De officiële downloads zijn circa 610 MB; latere builds gebruiken de cache.

```bash
npm ci
python3 -m venv .venv
.venv/bin/pip install -r scripts/geo-requirements.txt
.venv/bin/python scripts/prepare_geo.py
npm run dev
```

Wanneer je Pythonomgeving de dependency al heeft, kun je `npm run prepare:geo` gebruiken. `npm run build` controleert of alle bronbestanden aanwezig zijn en start de converter indien nodig. Broncache: `node_modules/.cache/topo-geo`. De downloads worden op vastgelegde SHA-256 gecontroleerd; een gewijzigd bestand wordt geweigerd totdat de nieuwe bron gecontroleerd is.

```bash
npm test
npm run build
```

`scripts/prepare_geo.py` genereert `public/geo/` (niet in Git) en de kleine ingebouwde `src/data/referenceCatalog.json`. Dat laatste is gegenereerde brondata, niet handmatig bewerken. Bij wijzigingen aan de converter moet de schemawaarde in de converter en `ensure-geo.mjs` verhoogd worden. De Pythonversie en `pyshp` zijn vastgelegd in de buildomgeving/requirements; er zijn geen GIS-services of API-sleutels nodig voor de geometrielaag.

## Oefenen en bewaren

- Zoek in de bibliotheek, voeg brongeometrie toe, controleer de kaart en start de quiz. Bij steden staan land, regio en hoofdstadstatus om gelijknamige plaatsen te onderscheiden.
- **Hoofdsteden van mijn landen** voegt in één keer de beschikbare hoofdsteden toe, gekoppeld via Natural Earth ADM0-landcodes en ADM0CAP. Bestaande steden worden niet dubbel toegevoegd; landen zonder beschikbare hoofdstad worden gemeld. Landen met meerdere bronhoofdsteden krijgen alle bronhoofdsteden.
- Kaartvragen of meerkeuze, met zichtbaarheid per categorie, zoom en slepen. Pinch op een Mac-trackpad (ook Safari) of met twee vingers op een tablet zoomt rond de cursor/vingers; met twee vingers schuiven op het trackpad verschuift de kaart horizontaal en verticaal, ook met scrollmomentum. Buiten de kaart scrollt de pagina normaal. Na een goed antwoord gaat een klik/tik op de kaart of elders op de pagina verder. Slepen, pinch en bedieningsknoppen slaan geen vraag over; bij een fout antwoord blijven de knop en Enter beschikbaar.
- Stadspunten houden een aanraakvlak van 46 schermpixels op mobiel.
- Gemiste locaties apart herhalen. Toetsen 1–4 voor meerkeuze, Enter na feedback.
- De actuele set wordt lokaal bewaard. Opslag en export gebruiken kleine bronverwijzingen met versie/hash; geometrieën worden bij openen opnieuw uit dezelfde bronversie geladen. Export bevat dus geen hele gebergtebestanden.
- **Deel deze set via een link** maakt een compacte URL met setnaam en maximaal 300 bron-ID's in het fragment (`#set=…`). Er is geen backend nodig; de ontvanger laadt de geometrieën uit de eigen bronbibliotheek en kiest eerst of de gedeelde set de lokale set mag vervangen. De link blijft een momentopname, ook als de maker later wijzigingen doet. De app moet op een publiek bereikbaar adres staan (bijvoorbeeld Railway of GitHub Pages); localhost-links zijn niet bruikbaar voor klasgenoten. Links naar inmiddels ontbrekende bron-ID's worden geweigerd, zonder gedeeltelijk te importeren. Bestandsexport blijft beschikbaar.
- Import accepteert maximaal 300 locaties / 100 MB. Bronverwijzingen worden bij import gecontroleerd en opgehaald. Bestaande bekende doelen uit de schematische prototypeversie worden automatisch vervangen. Onbekende zelfgetekende doelen blijven zichtbaar als onbeschikbaar en moeten verwijderd of uit een bron opnieuw geselecteerd worden.

De uitsnede volgt de set. Europese sets met meerdere landen en Rusland openen op Europa; de volledige Russische geometrie blijft behouden en is via Hele wereld/slepen bereikbaar. Een toegevoegde locatie buiten Europa schakelt die focus uit. Bij een gewijzigde set, wereldweergave of nieuwe oefenvraag wordt de kaartverschuiving/zoom gereset. Tijdens de antwoordfeedback blijft de gekozen zoom behouden. Bij landen met overzeese gebieden bepaalt de grootste landmassa de uitsnede. Bij sets over de datumgrens wordt de wereldkaart getoond. Na selectie blijft de geladen geometrie beschikbaar gedurende de sessie; de volledige bibliotheek en opgeslagen bronverwijzingen vereisen bereikbaarheid van de statische host bij openen.

## GitHub Pages en Railway

Er is nog steeds geen applicatiebackend nodig: geodata wordt tijdens de build voorbereid en samen met de app gepubliceerd. Hierdoor zijn de oefensessies niet afhankelijk van live GIS-zoekdiensten. De GitHub Pages-workflow bereidt de bronnen voor en publiceert `dist/`, met basis `/topo-we/`. De build bewaart bronbestanden en voorbereide kaarten in een Actions-cache. De grote IHO-bron wordt als gecomprimeerde momentopname uit de GitHub-release `geo-sources-v1` opgehaald, met dezelfde oorspronkelijke SHA-256-controle; Marine Regions blijft de bron. Downloads melden voortgang en stoppen bij een netwerkstilstand of na tien minuten.

De meegeleverde Dockerfile bouwt de geodata in een Python-stage en de app in een Node-stage. Railway kan deze rechtstreeks bouwen. Nginx serveert de productiebuild en bronbestanden op `${PORT}` (standaard 8080); gezondheidstest `/`. De eerste Dockerbuild downloadt/converteert de bronnen; latere builds kunnen de geodata-stage hergebruiken. De app gebruikt op Railway de basis `/`.

Een backend is pas nodig voor accounts, synchronisatie of gedeelde sets via links. Voor **veel fijnere rivierdetails dan Natural Earth 1:10m** is een andere rivierbron nodig, bijvoorbeeld een vooraf ingelezen OSM/hydrologische dataset. Dit is geen functionaliteit van deze versie; de huidige bronresolutie staat expliciet in de interface.

## Verificatie

Tests controleren bronverwijzingen, ontbrekende geometrie, versiemismatches, het weigeren van rivier-/gebergtepunten, migratie uit het prototype, gelijknamige steden, export/opslag en de oefenflow. Browsercontrole verifieert daarnaast het laden van gecomprimeerde bronbestanden, zoeken, brongebieden en mobiel gedrag.
