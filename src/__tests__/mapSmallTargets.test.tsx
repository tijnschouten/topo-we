import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixtures from "./smallTargetFixtures.json";
import { initialItems } from "../data/catalog";
import type { TopoItem } from "../types";
import TopoMap from "../components/TopoMap";

// Actual Natural Earth source geometry, captured from the prepared source files.
const { rome, vatican, monaco } = fixtures as unknown as Record<string, TopoItem>;
const france = initialItems.find(item => item.targetId === "land-frankrijk")!;
const paris = initialItems.find(item => item.targetId === "plaats-parijs")!;
beforeEach(() => {
  vi.spyOn(SVGSVGElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, width: 1000, height: 680, right: 1000, bottom: 680, toJSON() {},
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function clickMarker(targetId: string) {
  const svg = screen.getByLabelText("Oefenkaart");
  const marker = svg.querySelector(`[data-target-ids~="${targetId}"] .point-hit`)!;
  fireEvent.click(marker, { clientX: Number(marker.getAttribute("cx")), clientY: Number(marker.getAttribute("cy")) });
}
describe("kleine en overlappende kaartdoelen", () => {
  it("toont één gedeeld punt voor Rome en Vaticaanstad zonder verbindingslijn", () => {
    const answer = vi.fn();
    render(<TopoMap items={[rome, vatican, paris]} interactive onTargetClick={answer} />);
    clickMarker(rome.targetId);
    expect(screen.queryByText("Welke locatie bedoel je?")).not.toBeInTheDocument();
    clickMarker(vatican.targetId);

    expect(answer.mock.calls).toEqual([[[rome.targetId, vatican.targetId]], [[rome.targetId, vatican.targetId]]]);
    expect(screen.getByLabelText("Oefenkaart").querySelectorAll(".point-target")).toHaveLength(2);
    expect(screen.getByLabelText("Oefenkaart").querySelectorAll(".map-marker-leaders line")).toHaveLength(0);
  });
  it("geeft een kaartantwoord direct door met het toetsenbord", () => {
    const answer = vi.fn();
    const { container } = render(<TopoMap items={[rome, vatican, paris]} interactive onTargetClick={answer} />);
    fireEvent.keyDown(container.querySelector(`[data-target-id="${rome.targetId}"]`)!, { key: "Enter" });
    expect(answer).toHaveBeenCalledWith([rome.targetId, vatican.targetId]);
    expect(screen.queryByText("Welke locatie bedoel je?")).not.toBeInTheDocument();
  });
  it("toont de gezamenlijke naam bij leren en de gevraagde naam bij feedback", () => {
    const { rerender, container } = render(<TopoMap items={[rome, vatican, paris]} interactive={false} labels />);
    expect(screen.getByText("Rome / Vaticaanstad")).toBeInTheDocument();
    rerender(<TopoMap items={[rome, vatican, paris]} interactive={false} correctTargetId={vatican.targetId} />);
    expect(screen.getByText("Vaticaanstad")).toBeInTheDocument();
    expect(container.querySelector(".map-marker-layer .state-correct")).toBeInTheDocument();
    expect(screen.queryByText("Rome / Vaticaanstad")).not.toBeInTheDocument();
  });
  it("geeft Monaco een groter klikpunt en behoudt de landpolygoon", () => {
    const answer = vi.fn();
    const { container } = render(<TopoMap items={[france, monaco]} interactive onTargetClick={answer} />);
    expect(container.querySelector("circle.small-area-marker")).toHaveAttribute("r", "5");
    expect(container.querySelector("rect.small-area-marker")).not.toBeInTheDocument();
    expect(container.querySelector(`path[data-target-id="${monaco.targetId}"]`)).toBeInTheDocument();
    clickMarker(monaco.targetId);
    expect(answer).toHaveBeenCalledWith([monaco.targetId]);
    expect(container.querySelector(`path[data-target-id="${monaco.targetId}"]`)).toHaveAttribute("tabindex", "-1");
  });
});
