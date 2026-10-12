import { describe, expect, it } from "vitest";
import smallTargets from "./smallTargetFixtures.json";
import type { TopoItem } from "../types";
import { topoItems } from "../data/topoItems";
import {
  buildMultipleChoiceOptions,
  buildQuestions,
  isCorrectAnswer,
  calculateScore,
  calculateStreak,
  filterItemsByCategory,
} from "../utils/quiz";

describe("quiz helpers", () => {
  it("maakt vragen zonder duplicaten voor gefilterde categorieen", () => {
    const filtered = filterItemsByCategory(topoItems, ["plaats"]);
    const questions = buildQuestions(filtered, "zoek-op-kaart", () => 0.42);
    const ids = questions.map((question) => question.item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(filtered.length);
  });

  it("berekent score en streak correct", () => {
    expect(calculateScore(3, true)).toBe(4);
    expect(calculateScore(3, false)).toBe(3);
    expect(calculateStreak(2, true)).toBe(3);
    expect(calculateStreak(4, false)).toBe(0);
  });

  it("bouwt multiple choice met precies 1 correct antwoord", () => {
    const correct = topoItems.find((item) => item.naam === "Parijs");
    if (!correct) throw new Error("Testdata incorrect");

    const options = buildMultipleChoiceOptions(
      correct,
      topoItems,
      4,
      () => 0.15,
    );
    expect(options.length).toBe(4);

    const unique = new Set(options.map((item) => item.id));
    expect(unique.size).toBe(4);
    expect(options.filter((item) => item.id === correct.id)).toHaveLength(1);
  });
});

describe("Rome en Vaticaanstad op de kaart", () => {
  const { rome, vatican, monaco } = smallTargets as unknown as Record<string, TopoItem>;
  it.each([[rome, vatican], [vatican, rome]])("accepteert beide stadsmarkeringen bij een kaartvraag", (requested, chosen) => {
    expect(isCorrectAnswer(requested, chosen, "zoek-op-kaart")).toBe(true);
    expect(isCorrectAnswer(requested, requested, "zoek-op-kaart")).toBe(true);
    expect(isCorrectAnswer(requested, chosen, "wat-is-dit")).toBe(false);
    expect(isCorrectAnswer(requested, requested, "wat-is-dit")).toBe(true);
  });
  it("biedt de andere naam van het gedeelde punt niet als meerkeuze-afleider aan", () => {
    for (const correct of [rome, vatican]) {
      const other = correct.id === rome.id ? vatican : rome;
      const options = buildMultipleChoiceOptions(correct, [rome, vatican, monaco], 4, () => 0.5);
      expect(options).toContain(correct);
      expect(options).not.toContain(other);
    }
  });
  it("blijft andere locaties, ontbrekende antwoorden en een gelijknamig land weigeren", () => {
    expect(isCorrectAnswer(rome, undefined, "zoek-op-kaart")).toBe(false);
    expect(isCorrectAnswer(rome, monaco, "zoek-op-kaart")).toBe(false);
    expect(isCorrectAnswer(rome, { ...vatican, id: "country-vatican", categorie: "land" }, "zoek-op-kaart")).toBe(false);
    expect(isCorrectAnswer(rome, { ...vatican, id: "custom", wikidataId: undefined }, "zoek-op-kaart")).toBe(false);
  });
});
