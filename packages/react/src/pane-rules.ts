import type { PaneMode } from "./pane-types.ts";
import type { PanOnDrag } from "./react-flow-props.ts";
import type { ViewProps } from "./view-props.ts";

/**
 * Whether dragging with this button pans, given `panOnDrag` (a flag, or the buttons that may). The
 * flag stands for the left and the middle button, as in d3-zoom's filter in React Flow: the right
 * button pans only when `panOnDrag` lists it.
 */
export function panAllowedFor(button: number, panOnDrag: PanOnDrag): boolean {
  const flagged = panOnDrag === true && button <= 1;
  return flagged || (Array.isArray(panOnDrag) && panOnDrag.includes(button));
}

// The `panOnDrag` that counts: holding the pan activation key turns it fully on.
function panOnDragOf(props: ViewProps, mode: PaneMode): PanOnDrag {
  return mode.panActivationKeyPressed || props.panOnDrag;
}

/** What a press is, as far as drawing a selection box is concerned. */
export interface Press {
  button: number;
  isPrimary: boolean;
  touch: boolean;
  /** Whether it landed on the pane itself, and not on something inside it. */
  onPane: boolean;
  /** Whether it landed inside something marked `nokey`. */
  noKey: boolean;
}

/**
 * Whether a press draws a selection box, as React Flow's pane decides it: with the selection key
 * held, from anywhere (a node or an edge included); with `selectionOnDrag`, from the pane itself. A
 * finger pans instead whenever the canvas can be panned, unless the selection key is held.
 */
export function startsSelection(press: Press, props: ViewProps, mode: PaneMode): boolean {
  const panning = panOnDragOf(props, mode);
  const onDrag = props.selectionOnDrag && panning !== true;
  const fingerPans = press.touch && panning !== false && !mode.selectionKeyPressed;
  const wanted = (onDrag && press.onPane) || mode.selectionKeyPressed;
  return (
    mode.elementsSelectable &&
    !fingerPans &&
    !press.noKey &&
    wanted &&
    press.button === 0 &&
    press.isPrimary
  );
}

// Panning is on for fingers whenever it is not off altogether: the buttons of `panOnDrag` only
// restrict a mouse, as in React Flow. Holding the selection key turns it off.
function panningOn(props: ViewProps, mode: PaneMode): boolean {
  return !mode.selectionKeyPressed && panOnDragOf(props, mode) !== false;
}

/** What stops a finger from panning or pinching: a box being drawn, or a connection being made. */
export interface TouchBlockers {
  userSelectionActive: boolean;
  connectionInProgress: boolean;
  /** A second finger while pinching is off. */
  extraFinger: boolean;
}

/** Whether a finger pans or pinches the canvas (d3-zoom's filter for touches). */
export function touchPans(props: ViewProps, mode: PaneMode, blockers: TouchBlockers): boolean {
  return (
    panningOn(props, mode) &&
    !blockers.userSelectionActive &&
    !blockers.connectionInProgress &&
    !blockers.extraFinger
  );
}

/** Whether a press with this button pans the canvas. */
export function startsPan(
  press: { button: number; ctrlKey: boolean },
  props: ViewProps,
  mode: PaneMode,
): boolean {
  // As in React Flow's filter for d3-zoom, a drag with Control held does not pan (Control with the
  // wheel is a pinch), unless the pan activation key is held: it may be Control itself.
  if (press.ctrlKey && !mode.panActivationKeyPressed) {
    return false;
  }
  // While the pan activation key is held the left and middle buttons pan, as if `panOnDrag` were on;
  // while the selection key is held, none does.
  return !mode.selectionKeyPressed && panAllowedFor(press.button, panOnDragOf(props, mode));
}

// What a middle press pans the canvas from, whatever its `noPanClassName` says.
const MIDDLE_PANS_FROM =
  ".react-flow__node, .react-flow__edge, .react-flow__selection, .react-flow__nodesselection";

/**
 * Whether a press is one with the middle button on a node, an edge or the selection, which pans the
 * canvas whatever they and `panOnDrag` say: React Flow's filter for d3-zoom lets it through first.
 */
export function middlePansThrough(press: {
  button: number;
  pointerType: string;
  target: EventTarget | null;
}): boolean {
  const { target } = press;
  const on = target instanceof Element && target.closest(MIDDLE_PANS_FROM) !== null;
  return press.button === 1 && press.pointerType === "mouse" && on;
}
