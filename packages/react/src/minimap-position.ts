import type { XYPosition } from "@free-flow/core";

import type { MiniMapView } from "./minimap-geometry.ts";

// Where on the map (in flow coordinates) a pointer on the page is. The browser knows the way from
// the page to the map's own coordinates, letterboxing and all, as it does for React Flow; where it
// does not, the map is taken to fill its box.
export function flowPositionOf(
  svg: SVGSVGElement,
  view: MiniMapView,
  client: XYPosition,
): XYPosition {
  const matrix = typeof svg.getScreenCTM === "function" ? svg.getScreenCTM() : null;
  if (matrix !== null && typeof DOMPoint === "function") {
    return new DOMPoint(client.x, client.y).matrixTransform(matrix.inverse());
  }
  const box = svg.getBoundingClientRect();
  const width = box.width > 0 ? box.width : view.width;
  const height = box.height > 0 ? box.height : view.height;
  return {
    x: view.x + ((client.x - box.left) / width) * view.width,
    y: view.y + ((client.y - box.top) / height) * view.height,
  };
}
