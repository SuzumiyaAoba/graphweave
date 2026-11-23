import type { ControlPosition } from "./node-resize.ts";
import type { ControlDirection } from "./resize-dimensions.ts";
import type { ResizeValues } from "./resize-session.ts";

export function controlOf(position: ControlPosition): ControlDirection {
  return {
    isHorizontal: position.includes("right") || position.includes("left"),
    isVertical: position.includes("bottom") || position.includes("top"),
    affectsX: position.includes("left"),
    affectsY: position.includes("top"),
  };
}

export function directionOf(
  next: { width: number; height: number },
  previous: { width: number; height: number },
  control: ControlDirection,
): [number, number] {
  const horizontal = Math.sign(next.width - previous.width) * (control.affectsX ? -1 : 1);
  const vertical = Math.sign(next.height - previous.height) * (control.affectsY ? -1 : 1);
  // `Math.sign` of nothing, times -1, is -0.
  return [horizontal === 0 ? 0 : horizontal, vertical === 0 ? 0 : vertical];
}

export interface Changed {
  width: boolean;
  height: boolean;
  /** The position only counts as changed along with the size on that axis. */
  x: boolean;
  y: boolean;
}

export function changedBetween(next: ResizeValues, previous: ResizeValues): Changed {
  const width = next.width !== previous.width;
  const height = next.height !== previous.height;
  return { width, height, x: next.x !== previous.x && width, y: next.y !== previous.y && height };
}
