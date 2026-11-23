/** @throws {Error} When the canvas has no 2D context. */
export function contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("A 2D canvas context is not available");
  }
  return context;
}

/** The canvas fills its host, and touch gestures must reach the pointer handlers instead of scrolling. */
export function styleCanvas(canvas: HTMLCanvasElement): void {
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";
}
