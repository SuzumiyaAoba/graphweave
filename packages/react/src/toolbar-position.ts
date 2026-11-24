import type { Position, Rect, Viewport } from "@graphweave/core";

export type ToolbarAlign = "start" | "center" | "end";

const HALF = 0.5;
const CENTER = -50;
const FULL = -100;

interface Anchor {
  x: number;
  y: number;
  alignX: number;
  alignY: number;
}

// The point on the side of the box that the toolbar attaches to, in flow units, and how far the
// toolbar itself is pulled back (in percent of its own size) so it sits outside the box.
function anchorFor(box: Rect, position: Position, offset: number): Anchor {
  if (position === "right") {
    return {
      x: box.x + box.width + offset,
      y: box.y + box.height * HALF,
      alignX: 0,
      alignY: CENTER,
    };
  }
  if (position === "left") {
    return { x: box.x - offset, y: box.y + box.height * HALF, alignX: FULL, alignY: CENTER };
  }
  if (position === "bottom") {
    return {
      x: box.x + box.width * HALF,
      y: box.y + box.height + offset,
      alignX: CENTER,
      alignY: 0,
    };
  }
  return { x: box.x + box.width * HALF, y: box.y - offset, alignX: CENTER, alignY: FULL };
}

// Slides the toolbar along the side to its start or end instead of the middle.
function aligned(
  anchor: Anchor,
  box: Rect,
  placement: { position: Position; align: ToolbarAlign },
): Anchor {
  const { position, align } = placement;
  if (align === "center") {
    return anchor;
  }
  const atEnd = align === "end";
  if (position === "top" || position === "bottom") {
    return { ...anchor, x: atEnd ? box.x + box.width : box.x, alignX: atEnd ? FULL : 0 };
  }
  return { ...anchor, y: atEnd ? box.y + box.height : box.y, alignY: atEnd ? FULL : 0 };
}

/**
 * A CSS `transform` that places a toolbar next to a node, in screen pixels (the toolbar is not
 * scaled with the zoom): `box` is the node in flow units, `offset` the gap in pixels.
 */
export function toolbarTransform(
  box: Rect,
  viewport: Viewport,
  options: { position: Position; offset: number; align: ToolbarAlign },
): string {
  const anchor = aligned(anchorFor(box, options.position, 0), box, options);
  const gap =
    options.position === "right" || options.position === "bottom"
      ? options.offset
      : -options.offset;
  const horizontal = options.position === "left" || options.position === "right";
  const x = anchor.x * viewport.zoom + viewport.x + (horizontal ? gap : 0);
  const y = anchor.y * viewport.zoom + viewport.y + (horizontal ? 0 : gap);
  return `translate(${x}px, ${y}px) translate(${anchor.alignX}%, ${anchor.alignY}%)`;
}
