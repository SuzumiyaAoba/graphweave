import type { Point } from "@graphweave/core";

/** Takes a listener for the events of a resize drag; a name after a dot (`drag.mine`) tells it apart. */
export type ResizeDragListener = (event: ResizeDragEvent) => void;

/**
 * The part of d3-drag's behavior that its events give a hand to: listeners for the events that
 * follow, which are called after the resize callbacks of the same event.
 */
export interface ResizeDragBehavior {
  on: ResizeDragOn<ResizeDragBehavior>;
}

/**
 * `on` of d3-drag: with a listener (or `null` to take it away) it sets it and gives its owner back
 * to chain on; without one it gives the listener that is set for the name.
 */
export type ResizeDragOn<TOwner> = (
  typenames: string,
  listener?: ResizeDragListener | null,
) => ResizeDragListener | TOwner | undefined;

/**
 * What the resize callbacks get as their event, shaped like the drag event of d3-drag, which is what
 * React Flow passes: where the pointer is, in pixels from the top left of the node, and the raw
 * event it came from.
 */
export interface ResizeDragEvent {
  /** The behavior that made the event; its `on` listens to this drag. */
  target: ResizeDragBehavior;
  type: "start" | "drag" | "end";
  /** Where the control was grabbed. */
  subject: Point;
  /** Where the pointer is now. */
  x: number;
  y: number;
  /** How far it has moved since the last event of the drag. */
  dx: number;
  dy: number;
  /** `"mouse"`, or the id of the touch. */
  identifier: "mouse" | number;
  /** How many drags are going on: 1 until it ends. */
  active: number;
  sourceEvent: PointerEvent;
  /** Listens to this drag, as `target.on` does, but gives this event back to chain on. */
  on: ResizeDragOn<ResizeDragEvent>;
}

/** Makes the events of one resize drag, and tells the listeners that were set on them. */
export interface ResizeDragEvents {
  make: (type: ResizeDragEvent["type"], source: PointerEvent) => ResizeDragEvent;
  /** Calls the listeners for the type of this event, once the resize callbacks have had it. */
  dispatch: (event: ResizeDragEvent) => void;
}

function behaviorOf(listeners: Map<string, ResizeDragListener>): ResizeDragBehavior {
  const behavior: ResizeDragBehavior = {
    on: (typenames: string, listener?: ResizeDragListener | null) => {
      if (listener === undefined) {
        return listeners.get(typenames);
      }
      if (listener === null) {
        listeners.delete(typenames);
      } else {
        listeners.set(typenames, listener);
      }
      return behavior;
    },
  };
  return behavior;
}

/** Makes the events of one resize drag, which began with the press `down` on a resize control. */
export function resizeDragEvents(down: PointerEvent): ResizeDragEvents {
  const parent = down.target instanceof Element ? down.target.parentElement : null;
  const rect = parent?.getBoundingClientRect();
  const localTo = (event: PointerEvent): Point => ({
    x: event.clientX - (rect?.left ?? 0) - (parent?.clientLeft ?? 0),
    y: event.clientY - (rect?.top ?? 0) - (parent?.clientTop ?? 0),
  });
  const listeners = new Map<string, ResizeDragListener>();
  const target = behaviorOf(listeners);
  const subject = localTo(down);
  let previous = subject;
  return {
    make: (type, source) => {
      const now = localTo(source);
      const event: ResizeDragEvent = {
        target,
        type,
        subject,
        x: now.x,
        y: now.y,
        dx: now.x - previous.x,
        dy: now.y - previous.y,
        identifier: source.pointerType === "mouse" ? "mouse" : source.pointerId,
        active: type === "end" ? 0 : 1,
        sourceEvent: source,
        on: (typenames: string, listener?: ResizeDragListener | null) => {
          if (listener === undefined) {
            return listeners.get(typenames);
          }
          target.on(typenames, listener);
          return event;
        },
      };
      previous = now;
      return event;
    },
    dispatch: (event) => {
      for (const [typenames, listener] of listeners) {
        if (typenames.split(".")[0] === event.type) {
          listener(event);
        }
      }
    },
  };
}
