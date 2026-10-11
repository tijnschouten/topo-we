import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TopoMap from "../components/TopoMap";
import { initialItems } from "../data/catalog";

const items = initialItems.filter(i => i.categorie === "plaats");
beforeEach(() => {
  vi.spyOn(SVGSVGElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, width: 1000, height: 680, right: 1000, bottom: 680, toJSON() {},
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

function dispatch(svg: Element, type: string, properties: object) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, properties);
  fireEvent(svg, event);
  return event;
}
function pointer(svg: Element, type: string, id: number, x: number, y: number) {
  dispatch(svg, type, { pointerId: id, pointerType: "touch", button: 0, clientX: x, clientY: y });
}
function transform(svg: Element) {
  return svg.querySelector("g[transform]")!.getAttribute("transform");
}
describe("kaartgebaren", () => {
  it("toont bij fout antwoord een kaartknop met leespauze, zonder overal doorklikken", () => {
    vi.useFakeTimers();
    const next = vi.fn();
    render(<TopoMap items={items} interactive={false} correctTargetId={items[0].targetId}
      onContinueButton={next} continueDelay={1200} continueLabel="Verder na dit antwoord" />);
    const button = screen.getByRole("button", { name: /Bekijk eerst het juiste antwoord/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    fireEvent.click(screen.getByLabelText("Oefenkaart"));
    expect(next).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1200); });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent("Verder na dit antwoord");
    fireEvent.click(button);
    expect(next).toHaveBeenCalledOnce();
  });
  it("zoomt met trackpad pinch rond de cursor", () => {
    render(<TopoMap items={items} interactive={false} />);
    const svg = screen.getByLabelText("Oefenkaart");
    const pinch = dispatch(svg, "wheel", { deltaY: -Math.log(2) * 100, deltaMode: 0, ctrlKey: true, clientX: 250, clientY: 200 });
    expect(pinch.defaultPrevented).toBe(true);
    expect(transform(svg)).toBe("translate(-250 -200) scale(2)");
  });
  it("pant met horizontale en verticale trackpadbeweging, ook ingezoomd, zonder antwoord", () => {
    const next = vi.fn(), answer = vi.fn();
    render(<TopoMap items={items} interactive={false} onContinue={next} onTargetClick={answer} />);
    const svg = screen.getByLabelText("Oefenkaart");
    const pan = dispatch(svg, "wheel", { deltaX: 30, deltaY: -50, deltaMode: 0, ctrlKey: false });
    expect(pan.defaultPrevented).toBe(true);
    expect(transform(svg)).toBe("translate(-30 50) scale(1)");
    fireEvent.click(screen.getByRole("button", { name: "Inzoomen" }));
    const before = transform(svg);
    dispatch(svg, "wheel", { deltaX: -30, deltaY: 50, deltaMode: 0, ctrlKey: false });
    expect(before).toBe("translate(-295 -95) scale(1.5)");
    expect(transform(svg)).toBe("translate(-265 -145) scale(1.5)");
    expect(next).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
  });
  it("ondersteunt Safari trackpadgebaren en voorkomt dubbel zoomen via wheel", () => {
    render(<TopoMap items={items} interactive={false} />);
    const svg = screen.getByLabelText("Oefenkaart");
    expect(dispatch(svg, "gesturestart", { scale: 1, clientX: 200, clientY: 300 }).defaultPrevented).toBe(true);
    dispatch(svg, "gesturechange", { scale: 2 });
    dispatch(svg, "wheel", { deltaY: -50, deltaMode: 0, ctrlKey: true, clientX: 200, clientY: 300 });
    expect(transform(svg)).toBe("translate(-200 -300) scale(2)");
    dispatch(svg, "gestureend", {});
  });
  it("zoomt en verschuift met twee vingers zonder een antwoord of volgende vraag te activeren", () => {
    const next = vi.fn(), answer = vi.fn();
    render(<TopoMap items={items} interactive={false} onContinue={next} onTargetClick={answer} />);
    const svg = screen.getByLabelText("Oefenkaart");
    pointer(svg, "pointerdown", 1, 200, 300);
    pointer(svg, "pointerdown", 2, 400, 300);
    // Safari touch gesture events must not duplicate the pointer pinch.
    dispatch(svg, "gesturestart", { scale: 1, clientX: 300, clientY: 300 });
    pointer(svg, "pointermove", 1, 100, 300);
    dispatch(svg, "gesturechange", { scale: 2 });
    expect(transform(svg)).toBe("translate(-200 -150) scale(1.5)");
    pointer(svg, "pointerup", 1, 100, 300);
    pointer(svg, "pointerup", 2, 400, 300);
    fireEvent.click(svg);
    expect(next).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
    pointer(svg, "pointerdown", 1, 600, 300);
    pointer(svg, "pointerup", 1, 600, 300);
    fireEvent.click(svg);
    expect(next).toHaveBeenCalledOnce();
  });
  it("laat kaart slepen niet doorgaan na een goed antwoord", () => {
    const next = vi.fn();
    render(<TopoMap items={items} interactive={false} onContinue={next} />);
    const svg = screen.getByLabelText("Oefenkaart");
    pointer(svg, "pointerdown", 1, 200, 300);
    pointer(svg, "pointermove", 1, 240, 320);
    pointer(svg, "pointerup", 1, 240, 320);
    fireEvent.click(svg);
    expect(transform(svg)).toBe("translate(40 20) scale(1)");
    expect(next).not.toHaveBeenCalled();
  });
});
