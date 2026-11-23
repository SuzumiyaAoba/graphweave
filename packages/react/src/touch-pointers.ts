// The fingers that are down on a flow, from the press until they lift: what a gesture asks to know
// whether it has company (React Flow reads `event.touches.length`).

const fingers = new Set<number>();

/** Notes a finger that went down on a flow. */
export function fingerDown(pointerId: number): void {
  fingers.add(pointerId);
}

/** Notes that a finger has lifted, or the browser has taken it back. */
export function fingerUp(pointerId: number): void {
  fingers.delete(pointerId);
}

/** How many fingers are down on a flow at the moment. */
export function fingerCount(): number {
  return fingers.size;
}
