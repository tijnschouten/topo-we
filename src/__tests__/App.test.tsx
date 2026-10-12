import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { mockSourceFiles } from "./sourceFixtures";
import { initialItems } from "../data/catalog";
import smallTargets from "./smallTargetFixtures.json";
import type { TopoItem } from "../types";
import europaSet from "../data/europaSet.json";
import { saveSet, loadSet, loadCollection } from "../utils/sets";
import { createSetLink } from "../utils/shareSet";

beforeEach(() => {
  history.replaceState(null, "", "/");
  localStorage.clear();
  mockSourceFiles();
  saveSet({
    version: 1,
    name: "Steden oefenen",
    items: initialItems.filter((i) =>
      ["plaats-dublin", "plaats-parijs"].includes(i.targetId),
    ),
  });
});
afterEach(() => { cleanup(); history.replaceState(null, "", "/"); });
describe("App flow", () => {
  it("start met de volledige Europa-standaardset en kan die opnieuw laden", async () => {
    localStorage.clear();
    const user = userEvent.setup();
    const { container } = render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    expect(screen.getByLabelText("Naam van je set")).toHaveValue("Groep 7 - Oktober - Europa");
    await waitFor(() => expect(loadSet()?.items.map(item => item.id)).toEqual(europaSet.items.map(item => item.id)));
    expect(container.querySelectorAll(".selected-list li, .selected-list .selected-item")).toHaveLength(54);
    await user.click(screen.getByRole("button", { name: /Nieuwe oefenset/ }));
    await user.click(screen.getByRole("button", { name: "Gebruik Groep 7 - Oktober - Europa" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    await waitFor(() => {
      expect(loadSet()?.name).toBe("Groep 7 - Oktober - Europa");
      expect(loadSet()?.items.map(item => item.id)).toEqual(europaSet.items.map(item => item.id));
    });
  });
  it("maakt, kopieert en wisselt sets zonder de oorspronkelijke set te verliezen", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /Nieuwe oefenset/ }));
    await user.clear(screen.getByLabelText("Naam van je set"));
    await user.type(screen.getByLabelText("Naam van je set"), "November");
    await user.click(screen.getByRole("button", { name: "Set kopiëren" }));
    expect(screen.getByLabelText("Naam van je set")).toHaveValue("November (kopie)");
    expect(loadCollection({ version: 1, name: "Fallback", items: [] }).sets).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: /Eigen set Steden oefenen/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    expect(screen.getByLabelText("Naam van je set")).toHaveValue("Steden oefenen");
    expect(loadSet()?.items).toHaveLength(2);
    unmount();
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    expect(screen.getByLabelText("Naam van je set")).toHaveValue("Steden oefenen");
    expect(screen.getByRole("button", { name: /November \(kopie\)/ })).toBeInTheDocument();
  });
  it("opent een standaardset als eigen kopie en verwijdert alleen de gekozen set", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Gebruik Europese landen + hoofdsteden" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    expect(loadSet()?.items).toHaveLength(90);
    await user.click(screen.getByRole("button", { name: "Set verwijderen" }));
    await user.click(screen.getByRole("button", { name: "Annuleren" }));
    expect(loadSet()?.items).toHaveLength(90);
    await user.click(screen.getByRole("button", { name: "Set verwijderen" }));
    await user.click(screen.getByRole("button", { name: "Ja, set verwijderen" }));
    await waitFor(() => expect(screen.getByLabelText("Naam van je set")).toHaveValue("Steden oefenen"));
    expect(loadCollection({ version: 1, name: "Fallback", items: [] }).sets).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Gebruik Europese landen + hoofdsteden" })).toBeInTheDocument();
  });
  it("voegt een geïmporteerde set toe en laat zoeken in eigen sets", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    const imported = { version: 1, name: "December", items: [initialItems.find(i => i.targetId === "plaats-parijs")!] };
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [{ size: 1000, text: async () => JSON.stringify(imported) }] } });
    await waitFor(() => expect(screen.getByLabelText("Naam van je set")).toHaveValue("December"));
    expect(loadCollection({ version: 1, name: "Fallback", items: [] }).sets).toHaveLength(2);
    await user.type(screen.getByLabelText("Zoek oefensets"), "steden");
    expect(screen.getByRole("button", { name: /Eigen set Steden oefenen/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Geselecteerd December/ })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Zoek oefensets"));
    expect(screen.getByRole("button", { name: /Geselecteerd December/ })).toBeInTheDocument();
  });
  it("houdt een lege bewerkbare set over na verwijderen van de laatste set", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Set verwijderen" }));
    await user.click(screen.getByRole("button", { name: "Ja, set verwijderen" }));
    expect(screen.getByLabelText("Naam van je set")).toHaveValue("Mijn oefenset");
    expect(loadSet()?.items).toHaveLength(0);
    expect(loadCollection({ version: 1, name: "Fallback", items: [] }).sets).toHaveLength(1);
  });
  it("rekent Rome en Vaticaanstad over en weer goed zonder een naamkeuze", async () => {
    const { rome, vatican } = smallTargets as unknown as Record<string, TopoItem>;
    saveSet({ version: 1, name: "Rome en Vaticaanstad", items: [rome, vatican] });
    const user = userEvent.setup();
    const { container } = render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Start oefenen" }));
    for (let n = 0; n < 2; n++) {
      const requested = container.querySelector(".question-name")!.textContent;
      const other = requested === rome.naam ? vatican : rome;
      fireEvent.keyDown(container.querySelector(`[data-target-ids~="${other.targetId}"]`)!, { key: "Enter" });
      expect(screen.getByText("Goed gevonden!")).toBeInTheDocument();

      expect(screen.queryByText("Welke locatie bedoel je?")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: n === 0 ? /Volgende vraag/ : /Bekijk eindscore/ }));
    }
    expect(screen.getByText("Je kent de weg!")).toBeInTheDocument();
  });
  it.each([false, true])("verwijdert achtergebleven objectfocus bij doorklikken op de kaart (ander object: %s)", async different => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Start oefenen" }));
    const name = container.querySelector(".question-name")!.textContent;
    const item = initialItems.find(i => i.naam === name && i.categorie === "plaats")!;
    const correct = container.querySelector<SVGElement>(`[data-target-id="${item.targetId}"]`)!;
    correct.focus();
    fireEvent.keyDown(correct, { key: "Enter" });
    expect(screen.getByText("Goed gevonden!")).toBeInTheDocument();
    const clicked = different
      ? [...container.querySelectorAll<SVGElement>("[data-target-id]")].find(el => el !== correct)!
      : correct;
    clicked.focus();
    expect(clicked).toHaveFocus();
    fireEvent.click(clicked);
    expect(container.querySelector(".question-name")!.textContent).not.toBe(name);
    expect(screen.getByLabelText("Oefenkaart")).toHaveFocus();
    expect(clicked).not.toHaveFocus();
    await user.tab();
    expect(document.activeElement).toHaveAttribute("data-target-id");
  });
  it("laat een gedeelde set bekijken zonder de eigen set te vervangen, en opent na kiezen", async () => {
    const incoming = { version: 1 as const, name: "Set van klasgenoot", items: [initialItems.find(i => i.targetId === "plaats-parijs")!] };
    const link = createSetLink(incoming, window.location.href);
    history.replaceState(null, "", new URL(link).hash);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: incoming.name });
    await waitFor(() => expect(screen.getByRole("button", { name: "Deze set openen" })).toBeEnabled());
    expect(loadSet()?.name).toBe("Steden oefenen");
    await user.click(screen.getByRole("button", { name: "Deze set openen" }));
    await waitFor(() => expect(loadSet()?.name).toBe(incoming.name));
    expect(loadSet()?.items).toHaveLength(1);
    expect(window.location.hash).toBe("");
    expect(loadCollection({ version: 1, name: "Fallback", items: [] }).sets).toHaveLength(2);
  });
  it("opent een link in de al geladen app en laat de eigen set behouden", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    const link = createSetLink({ version: 1, name: "Andere set", items: [initialItems[0]] }, window.location.href);
    history.replaceState(null, "", new URL(link).hash);
    fireEvent(window, new Event("hashchange"));
    await screen.findByRole("heading", { name: "Andere set" });
    await user.click(screen.getByRole("button", { name: "Mijn eigen set houden" }));
    expect(loadSet()?.name).toBe("Steden oefenen");
    expect(screen.queryByRole("heading", { name: "Andere set" })).not.toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });
  it("houdt de zoom bij feedback en herstelt de volledige kaart bij de volgende vraag", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Start oefenen" }));
    await user.click(screen.getByRole("button", { name: "Inzoomen" }));
    const mapTransform = () => container.querySelector(".topo-map g[transform]")!.getAttribute("transform");
    const zoomed = mapTransform();
    expect(zoomed).toContain("scale(1.5)");
    const name = container.querySelector(".question-name")!.textContent;
    const item = initialItems.find(i => i.naam === name && i.categorie === "plaats")!;
    fireEvent.keyDown(container.querySelector(`[data-target-id="${item.targetId}"]`)!, { key: "Enter" });
    expect(screen.getByText("Goed gevonden!")).toBeInTheDocument();
    expect(mapTransform()).toBe(zoomed);
    fireEvent.click(screen.getByLabelText("Oefenkaart"));
    expect(container.querySelector(".question-name")!.textContent).not.toBe(name);
    expect(mapTransform()).toBe("translate(0 0) scale(1)");
  });
  it("laat feedback staan als Enter het laatste kaartantwoord geeft", async () => {
    saveSet({
      version: 1,
      name: "Eén stad",
      items: [initialItems.find((i) => i.targetId === "plaats-dublin")!],
    });
    const user = userEvent.setup();
    const { container } = render(<App />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Start oefenen" }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Start oefenen" }));
    const target = container.querySelector<SVGElement>("[data-target-id]")!;
    target.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Goed gevonden!")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Bekijk eindscore/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Je kent de weg!")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Oefenkaart"));
    expect(screen.getByText("Je kent de weg!")).toBeInTheDocument();
  });
  it("gaat met een klik buiten de kaart verder na een goed antwoord", async () => {
    saveSet({ version: 1, name: "Eén stad", items: [initialItems.find(i => i.targetId === "plaats-dublin")!] });
    const user = userEvent.setup();
    const { container } = render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Start oefenen" }));
    fireEvent.keyDown(container.querySelector("[data-target-id]")!, { key: "Enter" });
    expect(screen.getByText("Goed gevonden!")).toBeInTheDocument();
    await user.click(screen.getByText("Een wereld om te leren"));
    expect(screen.getByText("Je kent de weg!")).toBeInTheDocument();
  });
  it("laat een fout antwoord staan bij klikken op de kaart of vraag", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Start oefenen" }));
    await user.click(screen.getByRole("button", { name: /Ik weet het nog niet/ }));
    const feedback = screen.getByText(/^Het is /).textContent;
    fireEvent.click(screen.getByLabelText("Oefenkaart"));
    await user.click(screen.getByText("Een wereld om te leren"));
    expect(screen.getByText(/^Het is /)).toHaveTextContent(feedback!);
  });
  it("beoordeelt een kaartantwoord en toont alleen doelen van de actieve categorie", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Start oefenen" }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Start oefenen" }));
    const name = container.querySelector(".question-name")!.textContent;
    const correct = initialItems.find((i) => i.naam === name)!;
    const mapTarget = container.querySelector(
      `[data-target-id="${correct.targetId}"]`,
    )!;
    expect(
      container.querySelector('[data-target-id="land-frankrijk"]'),
    ).toBeNull();
    fireEvent.keyDown(mapTarget, { key: "Enter" });
    expect(screen.getByText("Goed gevonden!")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Volgende vraag/ }));
    expect(screen.queryByText("Goed gevonden!")).not.toBeInTheDocument();
  });
  it("ondersteunt meerkeuze met toetsenbord en het herhalen van gemiste locaties", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      screen.getByRole("radio", { name: "Wat is dit? (meerkeuze)" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Start oefenen" }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Start oefenen" }));
    expect(screen.getAllByRole("button", { name: /^\d\./ })).toHaveLength(2);
    await user.click(
      screen.getByRole("button", { name: /Ik weet het nog niet/ }),
    );
    await user.keyboard("{Enter}");
    await user.click(
      screen.getByRole("button", { name: /Ik weet het nog niet/ }),
    );
    await user.keyboard("{Enter}");
    expect(screen.getByText("Weer een stukje wijzer.")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Oefen lastige locaties/ }),
    );
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });
  it("slaat selectie en naam op en blokkeert een lege oefenset", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Start oefenen" }),
      ).toBeEnabled(),
    );
    await user.clear(screen.getByLabelText("Naam van je set"));
    await user.type(screen.getByLabelText("Naam van je set"), "Mijn steden");
    await user.click(
      screen.getByRole("button", { name: "Dublin verwijderen" }),
    );
    expect(loadSet()?.name).toBe("Mijn steden");
    expect(loadSet()?.items).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /Nieuwe oefenset/ }));
    expect(
      screen.getByRole("button", { name: "Start oefenen" }),
    ).toBeDisabled();
    expect(loadSet()?.items).toHaveLength(0);
  });
  it("biedt bronzoeken aan en geen zelf tekenen", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Start oefenen" }),
      ).toBeEnabled(),
    );
    expect(
      screen.queryByRole("button", { name: /Eigen locatie tekenen/ }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Locatie uit bron toevoegen/ }),
    );
    expect(
      screen.getByRole("button", { name: "Zoek wereldwijd" }),
    ).toBeVisible();
  });
});
