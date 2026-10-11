import { vi } from "vitest";
import { initialItems } from "../data/catalog";
export function mockSourceFiles() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/geo/index.json.gz"))
        return new Response(
          JSON.stringify(
            initialItems.map(({ geometry: _g, ...metadata }) => metadata),
          ),
        );
      const item = initialItems.find((i) =>
        url.endsWith(`/geo/${i.provenance?.file}`),
      );
      return item
        ? new Response(JSON.stringify(item))
        : new Response("", { status: 404 });
    }),
  );
}
