import { NO_SLOT, clampZoom, screenToFlow, zoomAt } from "@graphweave/core";
import type { Point, Size, Viewport } from "@graphweave/core";

import { contextOf, styleCanvas } from "./canvas.ts";
import { drawFrame, smoothStats } from "./draw.ts";
import type { FrameStats } from "./draw.ts";
import { MAX_ZOOM, MIN_ZOOM, createScene, initialViewport, translateNode } from "./scene.ts";
import type { Scene, SceneOptions } from "./scene.ts";

export interface PlaygroundOptions extends SceneOptions {
  /** Initial state of the grid overlay; change it later with `setShowGrid`. */
  readonly showGrid: boolean;
}

/** Frame costs averaged over recent frames, plus the facts the panel shows next to them. */
export interface PlaygroundStats extends FrameStats {
  readonly total: number;
  readonly zoom: number;
}

export const EMPTY_STATS: PlaygroundStats = {
  total: 0,
  visible: 0,
  queryMs: 0,
  drawMs: 0,
  zoom: 1,
};

type Gesture = "idle" | "pan" | "drag";

// A wheel notch of 100 scales the zoom by about 1.16x.
const WHEEL_ZOOM_SPEED = 0.0015;
// The primary mouse button; other buttons and secondary touches do not start a gesture.
const PRIMARY_BUTTON = 0;

/**
 * Turns pointer and wheel input into camera and node changes, and repaints on demand. It owns a
 * canvas and a scene built from the options; create a new controller to change either.
 */
export class PlaygroundController {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  readonly #options: PlaygroundOptions;
  readonly #scene: Scene;
  readonly #onStats: (stats: PlaygroundStats) => void;
  readonly #abort = new AbortController();
  #showGrid: boolean;
  #viewport: Viewport = { x: 0, y: 0, zoom: 1 };
  #size: Size = { width: 0, height: 0 };
  #pixelRatio = 1;
  #fitted = false;
  #gesture: Gesture = "idle";
  #last: Point = { x: 0, y: 0 };
  #dragSlot = NO_SLOT;
  #hoverSlot = NO_SLOT;
  // The hover query runs once per frame, at the newest pointer position, not once per input event.
  #hoverPoint: Point = { x: 0, y: 0 };
  #hoverPending = false;
  #frameId = 0;
  #average: FrameStats = { visible: 0, queryMs: 0, drawMs: 0 };
  #hasAverage = false;

  /** @throws {Error} When the canvas has no 2D context. */
  public constructor(
    canvas: HTMLCanvasElement,
    options: PlaygroundOptions,
    onStats: (stats: PlaygroundStats) => void,
  ) {
    this.#canvas = canvas;
    this.#context = contextOf(canvas);
    this.#options = options;
    this.#showGrid = options.showGrid;
    this.#onStats = onStats;
    this.#scene = createScene(options);
    styleCanvas(canvas);
    this.#listen();
  }

  /** Resizes the drawing buffer; the first non-empty size also frames the scene. */
  public resize(size: Size, pixelRatio: number): void {
    this.#size = size;
    this.#pixelRatio = pixelRatio;
    this.#canvas.width = Math.round(size.width * pixelRatio);
    this.#canvas.height = Math.round(size.height * pixelRatio);
    if (!this.#fitted && size.width > 0 && size.height > 0) {
      this.#viewport = initialViewport(this.#scene, size);
      this.#fitted = true;
    }
    this.#schedule();
  }

  /** Shows or hides the grid overlay without rebuilding the scene, so camera and moved nodes stay. */
  public setShowGrid(showGrid: boolean): void {
    this.#showGrid = showGrid;
    this.#schedule();
  }

  public destroy(): void {
    this.#abort.abort();
    cancelAnimationFrame(this.#frameId);
  }

  #listen(): void {
    const { signal } = this.#abort;
    this.#canvas.addEventListener(
      "pointerdown",
      (event) => {
        this.#pointerDown(event);
      },
      { signal },
    );
    this.#canvas.addEventListener(
      "pointermove",
      (event) => {
        this.#pointerMove(event);
      },
      { signal },
    );
    // `lostpointercapture` covers a gesture that ends without a pointerup, e.g. a context menu opening.
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      this.#canvas.addEventListener(
        type,
        () => {
          this.#release();
        },
        { signal },
      );
    }
    this.#canvas.addEventListener(
      "pointerleave",
      () => {
        this.#leave();
      },
      { signal },
    );
    // Not passive: the page must not scroll while the wheel zooms the canvas.
    this.#canvas.addEventListener(
      "wheel",
      (event) => {
        this.#wheel(event);
      },
      { signal, passive: false },
    );
  }

  #pointerDown(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== PRIMARY_BUTTON) {
      return;
    }
    const point = { x: event.offsetX, y: event.offsetY };
    this.#canvas.setPointerCapture(event.pointerId);
    this.#last = point;
    this.#hoverSlot = NO_SLOT;
    this.#grab(point);
    this.#schedule();
  }

  /** Starts dragging the topmost node under the point, or panning when there is none. */
  #grab(point: Point): void {
    const flow = screenToFlow(this.#viewport, point);
    const hits = this.#scene.index.queryPoint(flow.x, flow.y);
    this.#gesture = "pan";
    if (hits.length > 0) {
      // Slots are drawn in ascending order, so the highest one is on top.
      this.#gesture = "drag";
      this.#dragSlot = hits.at(-1) ?? NO_SLOT;
    }
  }

  #pointerMove(event: PointerEvent): void {
    if (!event.isPrimary) {
      return;
    }
    if (this.#gesture !== "idle" && event.buttons === 0) {
      // The release was missed (e.g. it happened outside the window): do not keep panning.
      this.#release();
    }
    const point = { x: event.offsetX, y: event.offsetY };
    const delta = { x: point.x - this.#last.x, y: point.y - this.#last.y };
    this.#last = point;
    this.#apply(point, delta);
    this.#schedule();
  }

  #apply(point: Point, delta: Point): void {
    if (this.#gesture === "pan") {
      this.#viewport = {
        x: this.#viewport.x + delta.x,
        y: this.#viewport.y + delta.y,
        zoom: this.#viewport.zoom,
      };
    } else if (this.#gesture === "drag") {
      translateNode(this.#scene, this.#dragSlot, {
        x: delta.x / this.#viewport.zoom,
        y: delta.y / this.#viewport.zoom,
      });
    } else {
      this.#hoverPoint = point;
      this.#hoverPending = true;
    }
  }

  #release(): void {
    this.#gesture = "idle";
    this.#dragSlot = NO_SLOT;
    this.#hoverPoint = this.#last;
    this.#hoverPending = true;
    this.#schedule();
  }

  #leave(): void {
    this.#hoverSlot = NO_SLOT;
    this.#hoverPending = false;
    this.#schedule();
  }

  #wheel(event: WheelEvent): void {
    event.preventDefault();
    const anchor = { x: event.offsetX, y: event.offsetY };
    const zoom = clampZoom(
      this.#viewport.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    this.#viewport = zoomAt(this.#viewport, anchor, zoom);
    // The node under the cursor changes when the camera does.
    this.#hoverPoint = anchor;
    this.#hoverPending = this.#gesture === "idle";
    this.#schedule();
  }

  #schedule(): void {
    if (this.#frameId !== 0) {
      return;
    }
    this.#frameId = requestAnimationFrame(() => {
      this.#frameId = 0;
      this.#render();
    });
  }

  #resolveHover(): void {
    if (!this.#hoverPending) {
      return;
    }
    this.#hoverPending = false;
    const flow = screenToFlow(this.#viewport, this.#hoverPoint);
    const hits = this.#scene.index.queryPoint(flow.x, flow.y);
    this.#hoverSlot = hits.at(-1) ?? NO_SLOT;
  }

  #render(): void {
    if (this.#size.width === 0 || this.#size.height === 0) {
      return;
    }
    this.#resolveHover();
    const stats = drawFrame({
      context: this.#context,
      scene: this.#scene,
      viewport: this.#viewport,
      size: this.#size,
      pixelRatio: this.#pixelRatio,
      // The grid overlay only means something for the grid index.
      showGrid: this.#showGrid && this.#options.index === "grid",
      cellSize: this.#options.cellSize,
      hoverSlot: this.#hoverSlot,
      dragSlot: this.#dragSlot,
    });
    this.#report(stats);
  }

  #report(stats: FrameStats): void {
    // The first frame seeds the average, so the panel does not start from a misleading zero.
    if (this.#hasAverage) {
      this.#average = smoothStats(this.#average, stats);
    } else {
      this.#average = stats;
      this.#hasAverage = true;
    }
    // Reported every frame: throttling would drop the last update, leaving the panel stale once
    // interaction stops, and re-rendering one small element costs far less than painting the canvas.
    this.#onStats({
      visible: this.#average.visible,
      queryMs: this.#average.queryMs,
      drawMs: this.#average.drawMs,
      total: this.#scene.store.count,
      zoom: this.#viewport.zoom,
    });
  }
}
