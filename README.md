# Topo Trainer West-Europa

Statische webapp om topografie van West-Europa te oefenen. De app draait met Vite + React en is geschikt voor GitHub Pages.

## Features

- Twee leerstanden:
  - `Zoek op kaart`: klik het juiste onderdeel op de kaart
  - `Wat is dit?`: meerkeuzevraag op basis van highlight op de kaart
- Categorie-filters: landen, plaatsen, wateren, gebieden
- Directe feedback per vraag met hint
- Score, voortgang, streak en categorieprestaties
- Beste score en laatste instellingen worden lokaal opgeslagen

## Lokaal starten

```bash
npm install
npm run dev
```

## Testen

```bash
npm test
```

## Build

```bash
npm run build
```

## GitHub Pages

- `vite.config.ts` gebruikt `base: '/topo-we/'`
- Workflow in `.github/workflows/deploy.yml` deployt automatisch vanaf `main`

Na activatie van GitHub Pages in repository settings wordt de app gepubliceerd via de Pages URL van deze repo.
