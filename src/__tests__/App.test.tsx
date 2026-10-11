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
import europaSet from "../data/europaSet.json";
import { saveSet, loadSet } from "../utils/sets";
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
    expect(screen.getByLabelText("Naam van je set")).toHaveValue("Europa");
    expect(loadSet()?.items.map(item => item.id)).toEqual(europaSet.items.map(item => item.id));
    expect(container.querySelectorAll(".selected-list li, .selected-list .selected-item")).toHaveLength(54);
    await user.click(screen.getByRole("button", { name: "Lege set" }));
    await user.click(screen.getByRole("button", { name: "Standaard Europa laden" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Start oefenen" })).toBeEnabled());
    expect(loadSet()?.name).toBe("Europa");
    expect(loadSet()?.items.map(item => item.id)).toEqual(europaSet.items.map(item => item.id));
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
    await user.click(screen.getByRole("button", { name: "Lege set" }));
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
