import type { PracticeSet } from "./sets";
import type { TopoItem } from "../types";
import { isSourceReference } from "./geometrySources";

const invalid = () => new Error("Deze deellink is ongeldig of onvolledig. Vraag om een nieuwe link.");
export function createSetLink(set: PracticeSet, address: string): string {
  if (!set.name.trim() || set.name.length > 120 || !set.items.length || set.items.length > 300)
    throw new Error("Geef je set een naam en kies 1 tot 300 locaties om te delen.");
  if (set.items.some(i => !isSourceReference(i)))
    throw new Error("Deze set bevat locaties die niet via een deellink beschikbaar zijn. Gebruik Exporteren.");
  const ids = set.items.map(i => i.id);
  if (new Set(ids).size !== ids.length) throw invalid();
  const bytes = new TextEncoder().encode(JSON.stringify([1, set.name.trim(), ids]));
  const encoded = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(""))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (encoded.length > 16000) throw new Error("Deze set maakt een te lange link. Gebruik Exporteren.");
  const url = new URL(address);
  url.hash = `set=${encoded}`;
  return url.href;
}

export function readSharedSet(hash: string, library: TopoItem[]): PracticeSet | null {
  if (!hash.startsWith("#set=")) return null;
  const encoded = hash.slice(5);
  if (!encoded || encoded.length > 16000 || !/^[\w-]+$/.test(encoded)) throw invalid();
  try {
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!Array.isArray(data) || data.length !== 3 || data[0] !== 1 ||
        typeof data[1] !== "string" || !data[1].trim() || data[1].length > 120 ||
        !Array.isArray(data[2]) || !data[2].length || data[2].length > 300 ||
        data[2].some(id => typeof id !== "string") || new Set(data[2]).size !== data[2].length) throw invalid();
    const byId = new Map(library.map(i => [i.id, i]));
    const items = data[2].map(id => byId.get(id));
    if (items.some(i => !i)) throw new Error("Deze deellink bevat locaties die niet meer beschikbaar zijn. Vraag om een bijgewerkte link.");
    return { version: 1, name: data[1].trim(), items: items as TopoItem[] };
  } catch (e) {
    if (e instanceof Error && e.message.includes("bijgewerkte link")) throw e;
    throw invalid();
  }
}
