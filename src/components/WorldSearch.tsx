import { placeContext } from "../utils/places";
import { useEffect, useRef, useState } from "react";
import { lookup, resolveGeometry } from "../utils/lookup";
import { categoryLabels } from "../data/topoItems";
import type { Category, TopoItem } from "../types";
export default function WorldSearch({
  onPreview,
}: {
  onPreview: (item: TopoItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("plaats");
  const [items, setItems] = useState<TopoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController>();
  useEffect(() => () => controller.current?.abort(), []);
  function reset() {
    controller.current?.abort();
    setItems([]);
    setMessage("");
    setLoading(false);
  }
  async function run(work: (signal: AbortSignal) => Promise<void>) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const timeout = window.setTimeout(() => current.abort(), 30000);
    setLoading(true);
    setMessage("");
    try {
      await work(current.signal);
    } catch (error) {
      if (controller.current === current)
        setMessage(
          error instanceof Error && error.name !== "AbortError"
            ? error.message
            : "Ophalen duurde te lang. Probeer opnieuw; er is geen vervangende schets toegevoegd.",
        );
    } finally {
      clearTimeout(timeout);
      if (controller.current === current) setLoading(false);
    }
  }
  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setItems([]);
    await run(async (signal) => {
      const result = await lookup(query, category, signal);
      if (signal.aborted) return;
      setItems(result);
      if (!result.length)
        setMessage(
          "Geen passende brongeometrie gevonden. Probeer een andere naam. Rivieren en gebergtes worden niet door een punt of schets vervangen.",
        );
    });
  }
  return (
    <details className="world-search">
      <summary>Zoek wereldwijd in betrouwbare bronnen ↗</summary>
      <p>
        Gebergtegebieden uit GMBA; rivierlopen en landgrenzen uit Natural Earth; zeeën en oceanen uit Marine Regions.
        Kies een resultaat om de brongeometrie op de kaart te laden.
      </p>
      <form onSubmit={search}>
        <label>
          Locatie
          <input
            value={query}
            maxLength={120}
            placeholder="Bijv. Tokio, Andes of Amazone"
            onChange={(e) => {
              reset();
              setQuery(e.target.value);
            }}
          />
        </label>
        <label>
          Categorie
          <select
            value={category}
            onChange={(e) => {
              reset();
              setCategory(e.target.value as Category);
            }}
          >
            {Object.entries(categoryLabels).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button className="cta-button" disabled={loading || !query.trim()}>
          {loading ? "Bron laden…" : "Zoek wereldwijd"}
        </button>
      </form>
      <div aria-live="polite">
        {message && <p>{message}</p>}
        {items.map((i) => (
          <button
            disabled={loading}
            className="world-result"
            key={i.id}
            onClick={() =>
              void run(async (signal) => {
                const full = await resolveGeometry(i, signal);
                if (!signal.aborted) onPreview(full);
              })
            }
          >
            <span>
              <strong>{i.naam}</strong>
              <small>{i.categorie === "plaats" ? placeContext(i) : i.hint}</small>
              <small>
                {i.provenance?.provider} · {i.provenance?.version} ·{" "}
                {i.provenance?.vertices.toLocaleString("nl-NL")} bronpunten
              </small>
            </span>
            <span>Laad brongeometrie →</span>
          </button>
        ))}
      </div>
      <small>
        Bronbestanden worden door deze site geserveerd. Alleen aanvullende
        naamzoekopdrachten gaan naar{" "}
        <a href="https://www.wikidata.org" target="_blank" rel="noreferrer">
          Wikidata
        </a>
        ; die leveren voor rivieren en gebergtes uitsluitend een koppeling naar
        beschikbare brongeometrie.
      </small>
    </details>
  );
}
