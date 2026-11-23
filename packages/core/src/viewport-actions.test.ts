import { describe, expect, it, vi } from "vite-plus/test";

import { screenToFlow } from "./camera.ts";
import type { Viewport } from "./camera.ts";
import type { FlowStore } from "./flow-store-types.ts";
import { createFlowStore } from "./flow-store.ts";
import type { FlowStoreOptions } from "./flow-store.ts";
import { makeNode } from "./test-fixtures.ts";
import type { EdgeBase, NodeBase } from "./types.ts";
import { currentViewport } from "./viewport-actions.ts";

type Options = FlowStoreOptions<NodeBase, EdgeBase>;

// A 100 x 100 node at (x, y).
function node(id: string, x: number, y: number): NodeBase {
  return makeNode(id, {
    position: { x, y },
    width: 100,
    height: 100,
    measured: { width: 100, height: 100 },
  });
}

// A flow on an 800 x 600 canvas.
function flow(options: Options = {}): FlowStore {
  return createFlowStore<NodeBase, EdgeBase>({ width: 800, height: 600, ...options });
}

// A flow whose canvas has not been measured yet.
function unsizedFlow(options: Options = {}): FlowStore {
  return createFlowStore<NodeBase, EdgeBase>(options);
}

describe("setViewport", () => {
  it("stores the viewport and tells onViewportChange", () => {
    const onViewportChange = vi.fn<(viewport: Viewport) => void>();
    const store = flow({ onViewportChange });
    expect(store.getState().setViewport({ x: 10, y: 20, zoom: 1.5 })).toBe(true);
    expect(store.getState().viewport).toStrictEqual({ x: 10, y: 20, zoom: 1.5 });
    expect(onViewportChange).toHaveBeenCalledWith({ x: 10, y: 20, zoom: 1.5 });
  });

  it("returns false and stays quiet when nothing changes", () => {
    const onViewportChange = vi.fn<(viewport: Viewport) => void>();
    const store = flow({ onViewportChange });
    expect(store.getState().setViewport({ x: 0, y: 0, zoom: 1 })).toBe(false);
    expect(onViewportChange).not.toHaveBeenCalled();
  });

  it("clamps the zoom into the configured range", () => {
    const store = flow({ minZoom: 0.5, maxZoom: 2 });
    store.getState().setViewport({ x: 0, y: 0, zoom: 10 });
    expect(store.getState().viewport.zoom).toBe(2);
    store.getState().setViewport({ x: 0, y: 0, zoom: 0.01 });
    expect(store.getState().viewport.zoom).toBe(0.5);
  });

  it("keeps the view inside a finite translateExtent", () => {
    const store = flow({
      translateExtent: [
        [0, 0],
        [1000, 1000],
      ],
    });
    store.getState().setViewport({ x: 100, y: 0, zoom: 1 });
    expect(store.getState().viewport).toStrictEqual({ x: 0, y: 0, zoom: 1 });
    store.getState().setViewport({ x: -5000, y: -5000, zoom: 1 });
    expect(store.getState().viewport).toStrictEqual({ x: -200, y: -400, zoom: 1 });
  });

  it("does not constrain the translation before the canvas has a size", () => {
    const store = unsizedFlow({
      translateExtent: [
        [0, 0],
        [1000, 1000],
      ],
    });
    store.getState().setViewport({ x: 100, y: 100, zoom: 1 });
    expect(store.getState().viewport).toStrictEqual({ x: 100, y: 100, zoom: 1 });
  });
});

// A flow whose viewport is held by its owner.
function held(onViewportChange: (viewport: Viewport) => void): FlowStore {
  const store = flow({ onViewportChange });
  store.setState({ viewportControlled: true });
  return store;
}

describe("a viewport the owner holds", () => {
  it("is only reported when the user moves it, and stays where it is", () => {
    const onViewportChange = vi.fn<(viewport: Viewport) => void>();
    const store = held(onViewportChange);
    expect(store.getState().zoomIn()).toBe(true);
    expect(onViewportChange).toHaveBeenCalledOnce();
    expect(onViewportChange.mock.calls[0]?.[0].zoom).toBeCloseTo(1.2);
    expect(store.getState().viewport).toStrictEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("goes on from where the user moved it to, so a burst of zooms adds up", () => {
    const onViewportChange = vi.fn<(viewport: Viewport) => void>();
    const store = held(onViewportChange);
    store.getState().zoomIn();
    store.getState().zoomIn();
    expect(currentViewport(store.getState()).zoom).toBeCloseTo(1.44);
    expect(onViewportChange.mock.calls.map(([viewport]) => viewport.zoom)).toStrictEqual([
      expect.closeTo(1.2),
      expect.closeTo(1.44),
    ]);
    expect(store.getState().viewport.zoom).toBe(1);
  });

  it("forgets the move the user made once the owner hands a viewport in", () => {
    const store = held(vi.fn<(viewport: Viewport) => void>());
    store.getState().zoomIn();
    store.getState().syncViewport({ x: 0, y: 0, zoom: 1 });
    expect(store.getState().pendingViewport).toBeUndefined();
    expect(currentViewport(store.getState()).zoom).toBe(1);
  });

  it("is taken from the owner by syncViewport, without being reported back", () => {
    const onViewportChange = vi.fn<(viewport: Viewport) => void>();
    const store = held(onViewportChange);
    store.getState().syncViewport({ x: 10, y: 20, zoom: 2 });
    expect(store.getState().viewport).toStrictEqual({ x: 10, y: 20, zoom: 2 });
    expect(onViewportChange).not.toHaveBeenCalled();
  });

  it("takes what syncViewport is given as it is, whatever the zoom range, as React Flow does", () => {
    const store = held(vi.fn<(viewport: Viewport) => void>());
    store.getState().syncViewport({ x: 0, y: 0, zoom: 100 });
    expect(store.getState().viewport.zoom).toBe(100);
  });
});

describe("panBy and zoom", () => {
  it("pans by a delta", () => {
    const store = flow();
    store.getState().panBy({ x: 30, y: -10 });
    store.getState().panBy({ x: 5, y: 5 });
    expect(store.getState().viewport).toStrictEqual({ x: 35, y: -5, zoom: 1 });
  });

  it("zooms about an anchor so the point under it stays put", () => {
    const store = flow({ viewport: { x: 40, y: 30, zoom: 1 } });
    const anchor = { x: 100, y: 50 };
    const before = screenToFlow(store.getState().viewport, anchor);
    store.getState().zoomTo(2, anchor);
    const after = screenToFlow(store.getState().viewport, anchor);
    expect(store.getState().viewport.zoom).toBe(2);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("zooms about the centre of the canvas by default", () => {
    const store = flow();
    store.getState().zoomIn();
    const { viewport } = store.getState();
    expect(viewport.zoom).toBeCloseTo(1.2);
    expect(viewport.x).toBeCloseTo(400 - 400 * 1.2);
    expect(viewport.y).toBeCloseTo(300 - 300 * 1.2);
  });

  it("zooms out by the same factor and stops at the limits", () => {
    const store = flow();
    store.getState().zoomIn();
    store.getState().zoomOut();
    expect(store.getState().viewport.zoom).toBeCloseTo(1);
    store.getState().zoomTo(100);
    expect(store.getState().viewport.zoom).toBe(2);
    expect(store.getState().zoomIn()).toBe(false);
  });
});

describe("fitView", () => {
  const nodes = [node("a", 0, 0), node("b", 300, 200)];

  it("frames all nodes with the default padding", () => {
    const store = flow({ nodes });
    expect(store.getState().fitView()).toBe(true);
    const { viewport } = store.getState();
    // The padding is whole pixels, as in React Flow: 36 of the 800 on each side.
    const zoom = (800 - 2 * 36) / 400;
    expect(viewport.zoom).toBeCloseTo(zoom);
    expect(viewport.x).toBeCloseTo(400 - 200 * zoom);
    expect(viewport.y).toBeCloseTo(300 - 150 * zoom);
  });

  it("frames only the requested nodes", () => {
    const store = flow({ nodes });
    store.getState().fitView({ nodes: [{ id: "a" }] });
    expect(store.getState().viewport).toStrictEqual({ x: 300, y: 200, zoom: 2 });
  });

  it("leaves hidden nodes out unless asked", () => {
    const hidden = [node("a", 0, 0), { ...node("b", 5000, 5000), hidden: true }];
    const store = flow({ nodes: hidden });
    store.getState().fitView();
    expect(store.getState().viewport.zoom).toBe(2);
    store.getState().fitView({ includeHiddenNodes: true });
    expect(store.getState().viewport.zoom).toBeCloseTo(0.5);
  });

  it("respects minZoom, maxZoom and padding from the options", () => {
    const store = flow({ nodes });
    store.getState().fitView({ maxZoom: 1, padding: 0 });
    expect(store.getState().viewport.zoom).toBe(1);
    store.getState().fitView({ maxZoom: 10, padding: 0, minZoom: 0.1 });
    expect(store.getState().viewport.zoom).toBeCloseTo(2);
  });

  it("cannot fit nodes that have not been measured, or before the canvas has a size", () => {
    const unmeasured = flow({ nodes: [{ id: "a", position: { x: 0, y: 0 }, data: {} }] });
    expect(unmeasured.getState().fitView()).toBe(false);
    const noCanvas = unsizedFlow({ nodes });
    expect(noCanvas.getState().fitView()).toBe(false);
    expect(flow().getState().fitView()).toBe(false);
  });

  it("uses the measured size once a node has been measured", () => {
    const store = flow({
      nodes: [
        { id: "a", position: { x: 0, y: 0 }, data: {}, measured: { width: 800, height: 600 } },
      ],
    });
    store.getState().fitView({ padding: 0 });
    expect(store.getState().viewport).toStrictEqual({ x: 0, y: 0, zoom: 1 });
  });
});

describe("fitBounds and setCenter", () => {
  it("fits arbitrary bounds", () => {
    const store = flow();
    expect(
      store.getState().fitBounds({ x: 0, y: 0, width: 400, height: 300 }, { padding: 0 }),
    ).toBe(true);
    expect(store.getState().viewport).toStrictEqual({ x: 0, y: 0, zoom: 2 });
  });

  it("keeps to the zoom limits of the flow, whatever zoom limits are passed, as React Flow does", () => {
    const store = flow();
    // Passed as a variable, as a caller holding fit-view options would.
    const options = { padding: 0, maxZoom: 8 };
    store.getState().fitBounds({ x: 0, y: 0, width: 100, height: 75 }, options);
    expect(store.getState().viewport.zoom).toBe(2);
  });

  it("refuses to fit before the canvas has a size", () => {
    const store = unsizedFlow();
    expect(store.getState().fitBounds({ x: 0, y: 0, width: 10, height: 10 })).toBe(false);
  });

  it("centres a flow point at the highest zoom unless one is given, as React Flow does", () => {
    const store = flow();
    store.getState().setCenter(100, 50);
    expect(store.getState().viewport).toStrictEqual({ x: 200, y: 200, zoom: 2 });
    store.getState().setCenter(50, 50, { zoom: 2 });
    expect(store.getState().viewport).toStrictEqual({ x: 300, y: 200, zoom: 2 });
  });
});

describe("fitView queue", () => {
  it("waits for a canvas size and for measured nodes, then fits by itself", () => {
    const store = unsizedFlow({ nodes: [node("a", 0, 0)] });
    expect(store.getState().fitView({ padding: 0 })).toBe(false);
    expect(store.getState().fitViewQueued).toBe(true);
    store.getState().setSize(800, 600);
    expect(store.getState().fitViewQueued).toBe(false);
    expect(store.getState().viewport.zoom).toBe(2);
  });

  it("fits once nodes appear after the canvas already has a size", () => {
    const store = flow();
    store.getState().fitView({ padding: 0 });
    expect(store.getState().fitViewQueued).toBe(true);
    store.getState().setNodes([node("a", 0, 0)]);
    expect(store.getState().fitViewQueued).toBe(false);
    expect(store.getState().viewport).toStrictEqual({ x: 300, y: 200, zoom: 2 });
  });

  it("keeps the options it was queued with", () => {
    const store = unsizedFlow({ nodes: [node("a", 0, 0)] });
    store.getState().fitView({ maxZoom: 1, padding: 0 });
    store.getState().setSize(800, 600);
    expect(store.getState().viewport.zoom).toBe(1);
  });

  it("is not queued when the fit could run", () => {
    const store = flow({ nodes: [node("a", 0, 0)] });
    store.getState().fitView();
    expect(store.getState().fitViewQueued).toBe(false);
  });
});
