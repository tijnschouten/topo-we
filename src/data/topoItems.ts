import type { TopoItem } from '../types';

export const topoItems: TopoItem[] = [
  { id: 'A', naam: 'Ierland', categorie: 'land', targetId: 'land-ierland', hint: 'Eiland ten westen van Groot-Brittannië.' },
  { id: 'B', naam: 'Verenigd Koninkrijk', categorie: 'land', targetId: 'land-vk', hint: 'Bestaat uit Engeland, Schotland, Wales en Noord-Ierland.' },
  { id: 'C', naam: 'Nederland', categorie: 'land', targetId: 'land-nederland', hint: 'Land aan de Noordzee met hoofdstad Amsterdam.' },
  { id: 'D', naam: 'België', categorie: 'land', targetId: 'land-belgie', hint: 'Ligt tussen Nederland, Frankrijk, Duitsland en Luxemburg.' },
  { id: 'E', naam: 'Luxemburg', categorie: 'land', targetId: 'land-luxemburg', hint: 'Klein land tussen België, Duitsland en Frankrijk.' },
  { id: 'F', naam: 'Duitsland', categorie: 'land', targetId: 'land-duitsland', hint: 'Groot land ten oosten van Nederland en België.' },
  { id: 'G', naam: 'Frankrijk', categorie: 'land', targetId: 'land-frankrijk', hint: 'Groot land ten zuiden van het Kanaal.' },

  { id: '1', naam: 'Dublin', categorie: 'plaats', targetId: 'plaats-dublin', hint: 'Hoofdstad van Ierland.' },
  { id: '2', naam: 'Londen', categorie: 'plaats', targetId: 'plaats-londen', hint: 'Hoofdstad van het Verenigd Koninkrijk.' },
  { id: '3', naam: 'Glasgow', categorie: 'plaats', targetId: 'plaats-glasgow', hint: 'Stad in Schotland.' },
  { id: '4', naam: 'Liverpool', categorie: 'plaats', targetId: 'plaats-liverpool', hint: 'Havenstad in het noordwesten van Engeland.' },
  { id: '5', naam: 'Amsterdam', categorie: 'plaats', targetId: 'plaats-amsterdam', hint: 'Hoofdstad van Nederland.' },
  { id: '6', naam: 'Brussel', categorie: 'plaats', targetId: 'plaats-brussel', hint: 'Hoofdstad van België.' },
  { id: '7', naam: 'Antwerpen', categorie: 'plaats', targetId: 'plaats-antwerpen', hint: 'Grote havenstad in Vlaanderen.' },
  { id: '8', naam: 'Luxemburg', categorie: 'plaats', targetId: 'plaats-luxemburg-stad', hint: 'Hoofdstad van Luxemburg.' },
  { id: '9', naam: 'Berlijn', categorie: 'plaats', targetId: 'plaats-berlijn', hint: 'Hoofdstad van Duitsland.' },
  { id: '10', naam: 'Hamburg', categorie: 'plaats', targetId: 'plaats-hamburg', hint: 'Havenstad in Noord-Duitsland.' },
  { id: '11', naam: 'Keulen', categorie: 'plaats', targetId: 'plaats-keulen', hint: 'Stad aan de Rijn in Duitsland.' },
  { id: '12', naam: 'München', categorie: 'plaats', targetId: 'plaats-munchen', hint: 'Stad in Zuid-Duitsland, dicht bij de Alpen.' },
  { id: '13', naam: 'Parijs', categorie: 'plaats', targetId: 'plaats-parijs', hint: 'Hoofdstad van Frankrijk.' },
  { id: '14', naam: 'Lyon', categorie: 'plaats', targetId: 'plaats-lyon', hint: 'Franse stad bij de Rhône.' },
  { id: '15', naam: 'Bordeaux', categorie: 'plaats', targetId: 'plaats-bordeaux', hint: 'Stad in het zuidwesten van Frankrijk.' },
  { id: '16', naam: 'Marseille', categorie: 'plaats', targetId: 'plaats-marseille', hint: 'Franse havenstad aan de Middellandse Zee.' },

  { id: '17', naam: 'Noordzee', categorie: 'water', targetId: 'water-noordzee', hint: 'Zee tussen Groot-Brittannië en het vasteland.' },
  { id: '18', naam: 'Atlantische Oceaan', categorie: 'water', targetId: 'water-atlantisch', hint: 'Grote oceaan ten westen van Europa.' },
  { id: '19', naam: 'Het Kanaal', categorie: 'water', targetId: 'water-kanaal', hint: 'Zeestraat tussen Engeland en Frankrijk.' },
  { id: '20', naam: 'Middellandse Zee', categorie: 'water', targetId: 'water-middellandse-zee', hint: 'Zee ten zuiden van Europa.' },
  { id: '21', naam: 'Theems', categorie: 'water', targetId: 'water-theems', hint: 'Rivier die door Londen stroomt.' },
  { id: '22', naam: 'Schelde', categorie: 'water', targetId: 'water-schelde', hint: 'Rivier in België en Nederland, richting Antwerpen.' },
  { id: '23', naam: 'Rijn', categorie: 'water', targetId: 'water-rijn', hint: 'Belangrijke rivier van de Alpen naar de Noordzee.' },
  { id: '24', naam: 'Donau', categorie: 'water', targetId: 'water-donau', hint: 'Rivier in Zuid-Duitsland richting Oost-Europa.' },
  { id: '25', naam: 'Seine', categorie: 'water', targetId: 'water-seine', hint: 'Rivier die door Parijs stroomt.' },
  { id: '26', naam: 'Rhône', categorie: 'water', targetId: 'water-rhone', hint: 'Rivier van Lyon naar de Middellandse Zee.' },

  { id: '27', naam: 'Schotland', categorie: 'gebied', targetId: 'gebied-schotland', hint: 'Noordelijk deel van Groot-Brittannië.' },
  { id: '28', naam: 'Engeland', categorie: 'gebied', targetId: 'gebied-engeland', hint: 'Groot gebied in het zuiden van Groot-Brittannië.' },
  { id: '29', naam: 'Vlaanderen', categorie: 'gebied', targetId: 'gebied-vlaanderen', hint: 'Noordelijk deel van België.' },
  { id: '30', naam: 'Wallonië', categorie: 'gebied', targetId: 'gebied-wallonie', hint: 'Zuidelijk deel van België.' },
  { id: '31', naam: 'Ardennen', categorie: 'gebied', targetId: 'gebied-ardennen', hint: 'Heuvelgebied in Zuid-België en Luxemburg.' },
  { id: '32', naam: 'Ruhrgebied', categorie: 'gebied', targetId: 'gebied-ruhr', hint: 'Stedelijk-industrieel gebied in West-Duitsland.' },
  { id: '33', naam: 'Alpen', categorie: 'gebied', targetId: 'gebied-alpen', hint: 'Hooggebergte in Zuid-Europa.' },
  { id: '34', naam: 'Pyreneeën', categorie: 'gebied', targetId: 'gebied-pyreneeen', hint: 'Gebergte op de grens van Frankrijk en Spanje.' }
];

export const categoryLabels = {
  land: 'Landen',
  plaats: 'Plaatsen',
  water: 'Wateren',
  gebied: 'Gebieden'
} as const;
