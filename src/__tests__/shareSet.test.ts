import { describe, expect, it } from "vitest";
import { initialItems } from "../data/catalog";
import { createSetLink, readSharedSet } from "../utils/shareSet";

describe("Deellinks", () => {
  const set = { version: 1 as const, name: "Sébastiaan 🌍 – Europa", items: initialItems };
  const address = "https://topo.example/topo-we/";
  it("deelt een volledige set compact, met Unicode en zonder kaartgeometrie", () => {
    const link = createSetLink(set, address);
    expect(link.length).toBeLessThan(2000);
    expect(link).toContain(address + "#set=");
    expect(readSharedSet(new URL(link).hash, initialItems)).toEqual(set);
  });
  it("weigert beschadigde links en onbekende locaties zonder gedeeltelijke set", () => {
    expect(() => readSharedSet("#set=broken", initialItems)).toThrow(/ongeldig/);
    const link = createSetLink(set, address);
    expect(() => readSharedSet(new URL(link).hash, [])).toThrow(/bijgewerkte link/);
    expect(readSharedSet("#andere-sectie", initialItems)).toBeNull();
  });
  it("weigert dubbele IDs, onbekende versies en buitensporige invoer", () => {
    for (const value of [[2, "Set", [initialItems[0].id]], [1, "Set", [initialItems[0].id, initialItems[0].id]], [1, "Set", []]]) {
      expect(() => readSharedSet("#set=" + btoa(JSON.stringify(value)), initialItems)).toThrow();
    }
    expect(() => readSharedSet("#set=" + "x".repeat(16001), initialItems)).toThrow();
  });
});
