import { vi } from "vitest";
import { catalog, initialItems } from "../data/catalog";
import europeanItems from "../data/europeCountries.json";
import type { TopoItem } from "../types";
const fullCatalog = [...catalog, ...(europeanItems as TopoItem[]).filter(item => !catalog.some(existing => existing.id === item.id))];
const sourceItems = fullCatalog.map(item => item.geometry ? item : {
  ...item,
  geometry: initialItems.find(example => example.categorie === item.categorie)!.geometry,
});
export function mockSourceFiles() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/geo/index.json.gz"))
        return new Response(
          JSON.stringify(
            sourceItems.map(({ geometry: _g, ...metadata }) => metadata),
          ),
        );
      const item = sourceItems.find((i) =>
        url.endsWith(`/geo/${i.provenance?.file}`),
      );
      return item
        ? new Response(JSON.stringify(item))
        : new Response("", { status: 404 });
    }),
  );
}
