import { createSetLink, readSharedSet } from "./utils/shareSet";
import { capitalsForCountries, placeContext } from "./utils/places";
import { useEffect, useMemo, useRef, useState } from "react";
import TopoMap from "./components/TopoMap";
import WorldSearch from "./components/WorldSearch";
import { catalog, initialItems } from "./data/catalog";
import { categoryLabels } from "./data/topoItems";
import type { Category, QuizMode, QuizQuestion, TopoItem } from "./types";
import { buildQuestions } from "./utils/quiz";
import {
  loadLibrary,
  resolveGeometry,
  hydrateSet,
  isSourceReady,
} from "./utils/geometrySources";
import { normalizeName } from "./utils/lookup";
import {
  exportSet,
  loadSet,
  parseSet,
  saveSet,
  type PracticeSet,
} from "./utils/sets";

type Stage = "setup" | "playing" | "finished";
const categories: Category[] = ["land", "plaats", "water", "gebied"];
const symbols = { land: "▱", plaats: "●", water: "≈", gebied: "△" };
const defaultSet: PracticeSet = {
  version: 1,
  name: "West-Europa",
  items: initialItems,
};
const modes: {
  id: QuizMode;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "zoek-op-kaart",
    title: "Zoek op kaart",
    description: "Vind de gevraagde locatie.",
    icon: "⌖",
  },
  {
    id: "wat-is-dit",
    title: "Wat is dit? (meerkeuze)",
    description: "Herken de gemarkeerde plek.",
    icon: "?",
  },
];
export default function App() {
  const [set, setSet] = useState<PracticeSet>(() => loadSet() ?? defaultSet);
  const [stage, setStage] = useState<Stage>("setup");
  const [mode, setMode] = useState<QuizMode>("zoek-op-kaart");
  const [enabled, setEnabled] = useState<Category[]>(categories);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<
    { item: TopoItem; correct: boolean }[]
  >([]);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    chosen?: TopoItem;
  } | null>(null);
  const [error, setError] = useState("");
  const [sharedSet, setSharedSet] = useState<PracticeSet | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const shareInput = useRef<HTMLInputElement>(null);
  const [capitalMessage, setCapitalMessage] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [world, setWorld] = useState(false);
  const [library, setLibrary] = useState<TopoItem[]>(catalog);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [labels, setLabels] = useState(false);
  const [previewLabels, setPreviewLabels] = useState(false);
  const [previewCategory, setPreviewCategory] = useState<
    Category | undefined
  >();
  const [candidate, setCandidate] = useState<TopoItem | null>(null);
  const previewItems = useMemo(
    () =>
      candidate
        ? [...set.items.filter((i) => i.id !== candidate.id), candidate]
        : set.items,
    [candidate, set.items],
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const selected = useMemo(
    () => set.items.filter((i) => enabled.includes(i.categorie)),
    [set.items, enabled],
  );
  const matches = useMemo(() => {
    const search = normalizeName(query);
    const names = (item: TopoItem) => [item.naam, ...(item.aliases ?? [])];
    return library
      .filter((item) => (filter === "all" || item.categorie === filter) &&
        names(item).some((name) => normalizeName(name).includes(search)))
      .sort((a, b) => Number(names(b).some((name) => normalizeName(name) === search)) -
        Number(names(a).some((name) => normalizeName(name) === search)) ||
        Number(b.capital ?? false) - Number(a.capital ?? false));
  }, [library, query, filter]);
  useEffect(() => {
    let cancelled = false;
    loadLibrary()
      .then(async (all) => {
        if (cancelled) return;
        setLibrary(all);
        const result = await hydrateSet(set.items);
        if (cancelled) return;
        setSet((s) => ({ ...s, items: result.items }));
        if (result.unavailable.length)
          setError(
            `Geen passende brongeometrie voor: ${result.unavailable.join(", ")}. Verwijder deze locaties of zoek een bronresultaat voordat je oefent.`,
          );
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "De volledige bronbibliotheek kon niet worden geladen. De ingebouwde voorbeeldkaart blijft beschikbaar.",
          );
      })
      .finally(() => {
        if (!cancelled) setSourceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const current = questions[index];
  useEffect(() => {
    if (sourceLoading) return;
    const readLink = () => {
      try {
        const incoming = readSharedSet(window.location.hash, library);
        setSharedSet(incoming);
        if (incoming) { setStage("setup"); setFeedback(null); }
      } catch (e) { setError(e instanceof Error ? e.message : "Deellink openen mislukt."); }
    };
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, [library, sourceLoading]);
  const score = answers.filter((a) => a.correct).length;
  const missed = answers.filter((a) => !a.correct).map((a) => a.item);
  useEffect(() => {
    if (!sourceLoading)
      setSaveError(
        !saveSet({ ...set, name: set.name.trim() || "Mijn oefenset" }),
      );
  }, [set, sourceLoading]);
  useEffect(() => { setShareLink(""); setShareMessage(""); }, [set]);
  async function share() {
    let link: string;
    try { link = createSetLink(set, window.location.href); }
    catch (e) { setError(e instanceof Error ? e.message : "Delen mislukt."); return; }
    setShareLink(link);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(link);
      setShareMessage("Link gekopieerd. Plak hem in een bericht aan je klasgenoten.");
    } catch { setShareMessage("Selecteer en kopieer de link hieronder."); }
  }
  function dismissSharedSet() {
    setSharedSet(null);
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  async function openSharedSet() {
    if (!sharedSet || sourceLoading) return;
    setSourceLoading(true);
    try {
      const result = await hydrateSet(sharedSet.items);
      if (result.unavailable.length) throw new Error(`Brongegevens ontbreken voor: ${result.unavailable.join(", ")}.`);
      setSet({ ...sharedSet, items: result.items });
      setEnabled(categories);
      setCandidate(null);
      setError("");
      dismissSharedSet();
    } catch (e) { setError(e instanceof Error ? e.message : "Deellink openen mislukt."); }
    finally { setSourceLoading(false); }
  }
  function start(items = selected) {
    if (sourceLoading || items.some((i) => !isSourceReady(i))) {
      setError(
        "Wacht tot alle brongeometrieën zijn geladen. Locaties zonder betrouwbare bron kun je verwijderen of opnieuw opzoeken.",
      );
      return;
    }
    if (!items.length) {
      setError("Voeg een locatie toe en kies minimaal één categorie.");
      return;
    }
    setCandidate(null);
    setQuestions(buildQuestions(items, mode));
    setIndex(0);
    setAnswers([]);
    setFeedback(null);
    setLabels(false);
    setError("");
    setStage("playing");
  }
  function answer(chosen?: TopoItem) {
    if (!current || feedback) return;
    const correct = chosen?.id === current.item.id;
    setAnswers((a) => [...a, { item: current.item, correct }]);
    setFeedback({ correct, chosen });
  }
  function next() {
    if (!feedback) return;
    if (index === questions.length - 1) setStage("finished");
    else {
      setIndex((i) => i + 1);
      setFeedback(null);
    }
  }
  useEffect(() => {
    if (stage !== "playing") return;
    const key = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if ((e.target as HTMLElement)?.matches("input, textarea, select")) return;
      if (e.key === "Enter" && feedback) {
        e.preventDefault();
        next();
      } else if (mode === "wat-is-dit" && !feedback && /^[1-4]$/.test(e.key)) {
        const option = current?.opties[Number(e.key) - 1];
        if (option) {
          e.preventDefault();
          answer(option);
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function toggle(item: TopoItem) {
    if (sourceLoading) return;
    if (set.items.some((i) => i.id === item.id)) {
      setSet((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) }));
      return;
    }
    setSourceLoading(true);
    try {
      const full = await resolveGeometry(item);
      setSet((s) => ({
        ...s,
        items: s.items.some((i) => i.id === full.id)
          ? s.items
          : [...s.items, full],
      }));
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Brongeometrie kon niet worden opgehaald.",
      );
    } finally {
      setSourceLoading(false);
    }
  }
  async function addCapitals() {
    if (sourceLoading) return;
    const { capitals, missing } = capitalsForCountries(set.items, library);
    const pending = capitals.filter((i) => !set.items.some((selected) => selected.id === i.id));
    if (set.items.length + pending.length > 300) {
      setError("Er passen maximaal 300 locaties in een oefenset.");
      return;
    }
    setSourceLoading(true);
    setCapitalMessage("");
    try {
      const result = await hydrateSet(pending);
      const loaded = result.items.filter(isSourceReady);
      setSet((s) => ({ ...s, items: [...s.items, ...loaded.filter((i) => !s.items.some((x) => x.id === i.id))] }));
      setEnabled((previous) => previous.includes("plaats") ? previous : [...previous, "plaats"]);
      const unavailable = [...missing, ...result.unavailable];
      setCapitalMessage(`${loaded.length} hoofdsteden toegevoegd.${!pending.length && !missing.length ? " Ze stonden al in je set." : ""}${unavailable.length ? ` Geen beschikbare bron voor: ${unavailable.join(", ")}.` : ""}`);
      setError("");
    } finally { setSourceLoading(false); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 100_000_000)
        throw new Error("Dit bestand is te groot (maximaal 100 MB).");
      const imported = parseSet(await file.text());
      setCandidate(null);
      setSourceLoading(true);
      const hydrated = await hydrateSet(imported.items);
      if (hydrated.unavailable.length)
        throw new Error(
          `Deze set bevat locaties zonder passende brongeometrie: ${hydrated.unavailable.join(", ")}.`,
        );
      setSet({ ...imported, items: hydrated.items });
      setError("");

      setEnabled(categories);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Importeren mislukt.");
    }
    setSourceLoading(false);
    if (fileInput.current) fileInput.current.value = "";
  }
  const mapItems = useMemo(
    () => (stage === "playing" ? questions.map((q) => q.item) : set.items),
    [stage, questions, set.items],
  );
  return (
    <main className="app-shell" onClickCapture={e => {
      if (stage !== "playing" || !feedback?.correct) return;
      // Map clicks run through its gesture filter. Keep controls working normally.
      if ((e.target as Element).closest(".topo-map, .map-tools, button, a, input, select, textarea, label, summary, [role=button]")) return;
      e.stopPropagation();
      next();
    }}>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setStage("setup");
            setFeedback(null);
          }}
        >
          <span className="brand-mark">⌖</span> topo
          <span className="brand-dot">.</span>
        </a>
        <span className="header-tag">Een wereld om te leren</span>
        <span className="local-badge">
          <span />{" "}
          {sourceLoading
            ? "Brongegevens laden"
            : saveError
              ? "Niet opgeslagen"
              : "Lokaal opgeslagen"}
        </span>
      </header>
      {stage === "setup" && (
        <>
          {sharedSet && <section className="card shared-set-banner">
            <p className="eyebrow">EEN SET VOOR JOU</p>
            <h2>{sharedSet.name}</h2>
            <p>{sharedSet.items.length} locaties om samen te oefenen. Je eigen set blijft bewaard totdat je deze opent.</p>
            <details><summary>Bekijk de locaties</summary><p>{sharedSet.items.map(i => i.naam).join(" · ")}</p></details>
            <div className="shared-set-actions">
              <button className="cta-button" disabled={sourceLoading} onClick={() => void openSharedSet()}>Deze set openen</button>
              <button className="text-button" disabled={sourceLoading} onClick={dismissSharedSet}>Mijn eigen set houden</button>
            </div>
          </section>}
          <section className="intro">
            <div>
              <p className="eyebrow">JOUW KAART. JOUW TEMPO.</p>
              <h1>Waar wil je naartoe?</h1>
              <p>
                Van de steden in je lesboek tot de rivieren van de wereld.
                <br />
                Stel je eigen kaart samen en ontdek hoeveel je al weet.
              </p>
            </div>
            <div className="intro-note">
              <span>↗</span>
              <p>
                Een kleine reis,
                <br />
                <strong>een beetje wijzer.</strong>
              </p>
            </div>
          </section>
          <div className="workspace">
            <aside className="card builder">
              <div className="section-title">
                <span className="step">01</span>
                <h2>Jouw oefenset</h2>
              </div>
              <label className="field-label" htmlFor="set-name">
                Naam van je set
              </label>
              <input
                id="set-name"
                maxLength={120}
                value={set.name}
                onChange={(e) =>
                  setSet((s) => ({ ...s, name: e.target.value }))
                }
              />
              <div className="set-actions">
                <button
                  disabled={sourceLoading}
                  onClick={() => {
                    setCandidate(null);
                    setSet(defaultSet);

                    setError("");
                  }}
                >
                  Voorbeeld laden
                </button>
                <button
                  disabled={sourceLoading}
                  onClick={() => {
                    setCandidate(null);
                    setSet({ version: 1, name: "Mijn oefenset", items: [] });

                    setError("");
                  }}
                >
                  Lege set
                </button>
              </div>
              <div className="selected-header">
                <h3>Geselecteerde locaties</h3>
                <span className="count">{set.items.length}</span>
              </div>
              <div className="selected-list">
                {set.items.length ? (
                  set.items.map((i) => (
                    <div className="selected-item" key={i.id}>
                      <span className={`category-icon ${i.categorie}`}>
                        {symbols[i.categorie]}
                      </span>
                      <div>
                        <strong>{i.naam}</strong>
                        {i.categorie === "plaats" && <small>{placeContext(i)}</small>}
                        <small>
                          {categoryLabels[i.categorie]}
                          {isSourceReady(i)
                            ? ` · ${i.provenance?.provider}`
                            : " · brongegevens ontbreken"}
                        </small>
                      </div>
                      <button
                        disabled={sourceLoading}
                        aria-label={`${i.naam} verwijderen`}
                        onClick={() =>
                          setSet((s) => ({
                            ...s,
                            items: s.items.filter((x) => x.id !== i.id),
                          }))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="empty">
                    Een lege kaart is het begin van iets moois. Voeg je eerste
                    locatie toe.
                  </p>
                )}
              </div>
              <button
                className="add-button"
                disabled={sourceLoading}
                onClick={() => {
                  const search =
                    document.querySelector<HTMLDetailsElement>(".world-search");
                  if (search) {
                    search.open = true;
                    search.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                    search.querySelector<HTMLInputElement>("input")?.focus();
                  }
                }}
              >
                + Locatie uit bron toevoegen
              </button>
              <button className="add-button" disabled={sourceLoading || !set.items.some((i) => i.categorie === "land")}
                onClick={() => void addCapitals()}>
                + Hoofdsteden van mijn landen
              </button>
              <p className="capital-status" role="status">{capitalMessage}</p>
              <div className="file-actions">
                <button
                  disabled={sourceLoading}
                  onClick={() => fileInput.current?.click()}
                >
                  ↑ Importeren
                </button>
                <button
                  disabled={sourceLoading || !set.name.trim()}
                  onClick={() => exportSet(set)}
                >
                  ↓ Exporteren
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".json,application/json"
                  aria-label="Oefenset importeren"
                  hidden
                  onChange={(e) => void importFile(e.target.files?.[0])}
                />
              </div>
              <button className="add-button share-button" disabled={sourceLoading || !set.items.length || !set.name.trim()}
                onClick={() => void share()}>↗ Deel deze set via een link</button>
              {shareLink && <div className="share-panel">
                <label className="field-label" htmlFor="share-link">Deellink</label>
                <input id="share-link" ref={shareInput} readOnly value={shareLink} onFocus={e => e.currentTarget.select()} />
                <p role="status">{shareMessage}</p>
                {["localhost", "127.0.0.1", "::1", "[::1]"].includes(window.location.hostname) &&
                  <p>Deze link werkt nu alleen op jouw computer. Zet de app online om met klasgenoten te delen.</p>}
              </div>}
              {saveError && (
                <p className="error-text">
                  Opslaan lukt niet. Exporteer je set om je werk te bewaren.
                </p>
              )}
              <div className="section-title second">
                <span className="step">02</span>
                <h2>Zo wil ik oefenen</h2>
              </div>
              <div className="mode-grid">
                {modes.map((m) => (
                  <label
                    key={m.id}
                    className={`mode-option ${mode === m.id ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      aria-label={m.title}
                      name="mode"
                      checked={mode === m.id}
                      onChange={() => setMode(m.id)}
                    />
                    <span className="mode-icon">{m.icon}</span>
                    <span>
                      <strong>{m.title}</strong>
                      <small>{m.description}</small>
                    </span>
                  </label>
                ))}
              </div>
              <p className="field-label">Neem deze categorieën mee</p>
              <div className="category-checks">
                {categories.map((c) => (
                  <label key={c}>
                    <input
                      type="checkbox"
                      checked={enabled.includes(c)}
                      onChange={() =>
                        setEnabled((v) =>
                          v.includes(c) ? v.filter((x) => x !== c) : [...v, c],
                        )
                      }
                    />
                    {categoryLabels[c]}
                  </label>
                ))}
              </div>
              <button
                className="cta-button start"
                disabled={
                  sourceLoading ||
                  !selected.length ||
                  !set.name.trim() ||
                  selected.some((i) => !isSourceReady(i))
                }
                onClick={() => start()}
              >
                Start oefenen <span aria-hidden="true">→</span>
              </button>
              {selected.some((i) => !isSourceReady(i)) && !sourceLoading && (
                <p className="error-text">
                  Verwijder locaties zonder brongegevens of zoek ze opnieuw op.
                </p>
              )}
              <p className="start-note">
                {sourceLoading
                  ? "Brongeometrie laden…"
                  : `${selected.length} locaties · geen tijdsdruk`}
              </p>
            </aside>
            <div className="main-column">
              <section className="card preview-card">
                <div className="preview-heading">
                  <div>
                    <p className="eyebrow">EEN BLIK OP JE REIS</p>
                    <h2>{set.name || "Mijn oefenset"}</h2>
                  </div>
                  <button
                    className={`pill ${world ? "active" : ""}`}
                    onClick={() => setWorld(!world)}
                  >
                    {world ? "Zoom op mijn set" : "Hele wereld"}
                  </button>
                </div>
                {candidate && (
                  <div className="candidate-preview">
                    <div>
                      <strong>{candidate.naam}</strong>
                      <small>{candidate.hint}</small>
                      <small>
                        {candidate.provenance?.provider} ·{" "}
                        {candidate.provenance?.version} ·{" "}
                        {candidate.provenance?.vertices.toLocaleString("nl-NL")}{" "}
                        bronpunten
                      </small>
                    </div>
                    <button
                      className="cta-button"
                      disabled={
                        sourceLoading ||
                        !isSourceReady(candidate) ||
                        set.items.some((i) => i.id === candidate.id) ||
                        set.items.length >= 300
                      }
                      onClick={() => {
                        setSet((s) => ({
                          ...s,
                          items: [...s.items, candidate],
                        }));
                        setCandidate(null);
                      }}
                    >
                      Aan set toevoegen
                    </button>
                    <button
                      aria-label="Voorbeeld sluiten"
                      onClick={() => setCandidate(null)}
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="preview-filters">
                  <select
                    aria-label="Categorie op voorbeeldkaart"
                    value={previewCategory ?? ""}
                    onChange={(e) =>
                      setPreviewCategory(
                        (e.target.value || undefined) as Category | undefined,
                      )
                    }
                  >
                    <option value="">Alle categorieën</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabels[c]}
                      </option>
                    ))}
                  </select>
                  <label>
                    <input
                      type="checkbox"
                      checked={previewLabels}
                      onChange={(e) => setPreviewLabels(e.target.checked)}
                    />{" "}
                    Toon namen
                  </label>
                </div>
                <TopoMap
                  key={`preview-${world}-${previewItems.map((i) => i.id).join(",")}`}
                  items={previewItems}
                  category={candidate ? undefined : previewCategory}
                  interactive={false}
                  labels={previewLabels}
                  highlightedTargetId={candidate?.targetId}
                  world={world}
                />
                <div className="legend">
                  <span>
                    <i className="legend-dot" /> Stad / locatie
                  </span>
                  <span>
                    <i className="legend-line" /> Rivier
                  </span>
                  <span>
                    <i className="legend-line mountain" /> Gebergte
                  </span>
                  <span>
                    <i className="legend-country" /> Land / gebied
                  </span>
                </div>
              </section>
              <section className="card catalog-card">
                <div className="catalog-heading">
                  <div>
                    <h2>Voeg iets toe aan je wereld</h2>
                    <p>
                      Zoek op naam. We laden de geometrie rechtstreeks uit de
                      bronbestanden.
                    </p>
                  </div>
                  <span className="catalog-total">
                    {library.length.toLocaleString("nl-NL")} bronlocaties
                  </span>
                </div>
                <input
                  className="search"
                  type="search"
                  placeholder="Zoek een land, stad, rivier of gebergte…"
                  aria-label="Zoek locaties"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div
                  className="filter-tabs"
                  role="group"
                  aria-label="Bibliotheek filteren"
                >
                  {(["all", ...categories] as const).map((c) => (
                    <button
                      key={c}
                      className={filter === c ? "active" : ""}
                      onClick={() => setFilter(c)}
                    >
                      {c === "all" ? "Alles" : categoryLabels[c]}
                    </button>
                  ))}
                </div>
                <div className="catalog-list">
                  {matches.slice(0, query ? 100 : 12).map((i) => {
                    const added = set.items.some((x) => x.id === i.id);
                    return (
                      <button
                        key={i.id}
                        className={`catalog-item ${added ? "added" : ""}`}
                        aria-pressed={added}
                        onClick={() => void toggle(i)}
                        disabled={
                          sourceLoading || (!added && set.items.length >= 300)
                        }
                      >
                        <span className={`category-icon ${i.categorie}`}>
                          {symbols[i.categorie]}
                        </span>
                        <span>
                          {i.naam}
                          <small>{i.categorie === "plaats" ? placeContext(i) : categoryLabels[i.categorie]}</small>
                        </span>
                        <span>{added ? "✓" : "+"}</span>
                      </button>
                    );
                  })}
                </div>
                {!matches.length && (
                  <p className="empty">
                    Geen match in de bronbibliotheek. Probeer een andere naam of
                    zoek hieronder aanvullend op naam.
                  </p>
                )}
                {matches.length > (query ? 100 : 12) && (
                  <p className="library-note">
                    Zoek op naam om de overige{" "}
                    {matches.length - (query ? 100 : 12)} locaties te vinden.
                    Zoek werkt ook op alternatieve bronnamen.
                  </p>
                )}
                <WorldSearch
                  onPreview={(item) => {
                    setWorld(false);
                    setCandidate(item);
                    document
                      .querySelector(".preview-card")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
              </section>
            </div>
          </div>
        </>
      )}
      {stage === "playing" && current && (
        <>
          <div className="session-heading">
            <button
              className="text-button"
              onClick={() => {
                setStage("setup");
                setFeedback(null);
              }}
            >
              ← Terug naar je set
            </button>
            <span>{set.name}</span>
            <span>
              {index + 1} / {questions.length}
            </span>
          </div>
          <div className="progress-track">
            <div
              style={{ width: `${(answers.length / questions.length) * 100}%` }}
            />
          </div>
          <section className="play-layout">
            <aside className="card question-card">
              <p className="eyebrow">
                {categoryLabels[current.item.categorie]} · VRAAG {index + 1}
              </p>
              <h2>
                {mode === "zoek-op-kaart" ? "Zoek op kaart" : "Wat is dit?"}
              </h2>
              {mode === "zoek-op-kaart" ? (
                <h1 className="question-name">{current.item.naam}</h1>
              ) : (
                <p className="question-description">
                  Welke naam hoort bij de oranje markering?
                </p>
              )}
              <p className="instruction">
                {mode === "zoek-op-kaart"
                  ? "Klik op het juiste punt, de lijn of het land. Je kunt inzoomen voor meer ruimte."
                  : "Kies je antwoord. Je kunt ook de toetsen 1 tot en met 4 gebruiken."}
              </p>
              {current.item.approximate && (
                <p className="approximate-note">
                  Deze locatie heeft geen passende brongeometrie.
                </p>
              )}
              {mode === "wat-is-dit" && (
                <div className="choices" aria-label="Antwoordopties">
                  {current.opties.map((o, n) => (
                    <button
                      key={o.id}
                      className={`choice-button ${feedback && o.id === current.item.id ? "correct" : feedback?.chosen?.id === o.id ? "wrong" : ""}`}
                      disabled={!!feedback}
                      onClick={() => answer(o)}
                    >
                      <span>{n + 1}.</span>
                      {o.naam}
                    </button>
                  ))}
                </div>
              )}
              <p className="source-note">
                {current.item.provenance?.provider} ·{" "}
                {current.item.provenance?.version} ·{" "}
                {current.item.provenance?.vertices.toLocaleString("nl-NL")}{" "}
                bronpunten
              </p>
              <div aria-live="polite">
                {feedback ? (
                  <div
                    className={`feedback-box ${feedback.correct ? "ok" : "wrong"}`}
                  >
                    <strong>
                      {feedback.correct
                        ? "Goed gevonden!"
                        : `Het is ${current.item.naam}.`}
                    </strong>
                    {feedback.chosen && !feedback.correct && (
                      <p>Jij koos {feedback.chosen.naam}.</p>
                    )}
                    <p>{current.item.hint}</p>
                    <button className="cta-button" onClick={next}>
                      {index === questions.length - 1
                        ? "Bekijk eindscore"
                        : "Volgende vraag"}{" "}
                      →
                    </button>
                    <small>{feedback.correct
                      ? "Klik of tik ergens om verder te gaan · Enter kan ook"
                      : "Enter om verder te gaan"}</small>
                  </div>
                ) : (
                  <button className="text-button skip" onClick={() => answer()}>
                    Ik weet het nog niet →
                  </button>
                )}
              </div>
              <div className="score-strip">
                <span>
                  <strong>{score}</strong> goed
                </span>
                <span>
                  <strong>{answers.length}</strong> beantwoord
                </span>
              </div>
            </aside>
            <div className="card play-map">
              <div className="play-map-heading">
                <span>
                  {symbols[current.item.categorie]}{" "}
                  {categoryLabels[current.item.categorie]}
                </span>
                <span>
                  {mode === "wat-is-dit"
                    ? "Oranje = gevraagde locatie"
                    : "Alleen deze categorie is zichtbaar"}
                </span>
              </div>
              <TopoMap
                items={mapItems}
                resetKey={index}
                category={current.item.categorie}
                interactive={mode === "zoek-op-kaart" && !feedback}
                highlightedTargetId={
                  mode === "wat-is-dit" ? current.item.targetId : undefined
                }
                correctTargetId={feedback ? current.item.targetId : undefined}
                wrongTargetId={
                  feedback && !feedback.correct
                    ? feedback.chosen?.targetId
                    : undefined
                }
                onContinue={feedback?.correct ? next : undefined}
                onContinueButton={feedback ? next : undefined}
                continueDelay={feedback && !feedback.correct ? 1200 : 0}
                continueLabel={feedback && !feedback.correct
                  ? (index === questions.length - 1 ? "Naar je eindscore" : "Verder na dit antwoord")
                  : index === questions.length - 1
                  ? "Klik of tik op de kaart voor je eindscore"
                  : "Klik of tik op de kaart om verder te gaan"}
                onTargetClick={(ids) =>
                  answer(mapItems.find((i) => i.targetId === ids[0]))
                }
              />
            </div>
          </section>
        </>
      )}
      {stage === "finished" && (
        <section className="card result-card">
          <p className="eyebrow">REIS AFGEROND</p>
          <div className="result-symbol">⌖</div>
          <h1>
            {score === questions.length
              ? "Je kent de weg!"
              : "Weer een stukje wijzer."}
          </h1>
          <p className="final-score">
            <strong>{score}</strong> / {questions.length} goed
          </p>
          <p>
            {missed.length
              ? `${missed.length} locaties kun je nog wat extra aandacht geven.`
              : "Alle locaties goed gevonden. Tijd voor een nieuwe bestemming?"}
          </p>
          <div className="stats-grid">
            {categories
              .filter((c) => answers.some((a) => a.item.categorie === c))
              .map((c) => {
                const rows = answers.filter((a) => a.item.categorie === c);
                return (
                  <div key={c}>
                    <span>
                      {symbols[c]} {categoryLabels[c]}
                    </span>
                    <strong>
                      {rows.filter((a) => a.correct).length} / {rows.length}
                    </strong>
                  </div>
                );
              })}
          </div>
          {missed.length > 0 && (
            <div className="missed-list">
              {missed.map((i) => (
                <span key={i.id}>{i.naam}</span>
              ))}
            </div>
          )}
          <div className="result-actions">
            {missed.length > 0 && (
              <button className="cta-button" onClick={() => start(missed)}>
                Oefen lastige locaties →
              </button>
            )}
            <button
              className={missed.length ? "ghost-button" : "cta-button"}
              onClick={() => start()}
            >
              Opnieuw oefenen
            </button>
            <button className="ghost-button" onClick={() => setStage("setup")}>
              Set aanpassen
            </button>
          </div>
          <button className="text-button" onClick={() => setLabels(!labels)}>
            {labels ? "Kaart verbergen" : "Bekijk je kaart met namen"}
          </button>
          {labels && <TopoMap items={mapItems} interactive={false} labels />}
        </section>
      )}
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <details className="source-credits">
        <summary>Kaartbronnen en nauwkeurigheid</summary>
        <p>
          Rivierlopen, landgrenzen en steden:{" "}
          <a
            href="https://www.naturalearthdata.com"
            target="_blank"
            rel="noreferrer"
          >
            Natural Earth 5.1.2
          </a>
          , schaal 1:10 miljoen, publiek domein. Dit zijn brongeometrieën voor
          regionale topografie; geen landmeetkundige metingen.
        </p>
        <p>Zeeën en oceanen: Flanders Marine Institute (2018),{" "}
          <a href="https://doi.org/10.14284/323" target="_blank" rel="noreferrer">IHO Sea Areas v3</a>, CC BY 4.0.
          De Atlantische Oceaan combineert noord en zuid; de Middellandse Zee combineert de IHO-bekkens en deelzeeën.
          De Noordelijke IJszee omvat ook noordelijke randzeeën, waaronder de Barentszzee boven Noorwegen.
          Het centrale poolbekken is apart beschikbaar. De Kaspische Zee gebruikt de kustpolygoon uit Natural Earth Ocean.
          Samengestelde zeeën worden als één gevuld gebied weergegeven, zonder grenzen tussen de bekkens.
          De kust wordt vereenvoudigd met een tolerantie van 0,025 graad (circa 2,8 km in breedterichting).
          Kleine eilandjes, waterfragmenten en microscopische spleten worden alleen in de kaartweergave weggelaten;
          grote eilanden blijven herkenbaar.
          De volledige kustgeometrie blijft beschikbaar in de bronbestanden. Zeegrenzen volgen de brondefinitie.
        </p>
        <p>
          Gebergtegebieden: GMBA Inventory v2.0, Standard extent. De Ardennen gebruiken
          Broad extent als landschapscontour, inclusief dalen en omliggend terrein;
          dit is geen afbakening van uitsluitend bergachtig terrein. Snethlage et
          al. (2022):{" "}
          <a
            href="https://doi.org/10.1038/s41597-022-01256-y"
            target="_blank"
            rel="noreferrer"
          >
            publicatie
          </a>{" "}
          en{" "}
          <a
            href="https://doi.org/10.48601/earthenv-t9k2-1407"
            target="_blank"
            rel="noreferrer"
          >
            dataset
          </a>{" "}
          (
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
          >
            CC BY 4.0
          </a>
          ). De begrenzing volgt de wetenschappelijke GMBA-definitie; gebergtes
          hebben geen universele administratieve grens. De bestanden zijn naar
          GeoJSON geconverteerd, op zes decimalen afgerond en niet handmatig
          getekend.
        </p>
      </details>
      <footer>
        <span>topo. · Blijf nieuwsgierig.</span>
        <span>Geen account nodig. Je oefenset blijft in deze browser.</span>
      </footer>
    </main>
  );
}
