import {
  ConnectionLineType,
  PanOnScrollMode,
  SelectionMode,
  withoutUndefined,
} from "@free-flow/core";
import type { Store } from "@free-flow/core";
import { createContext, useCallback, useContext } from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";

import { DEFAULT_ARIA_LABEL_CONFIG, resolveAriaLabels } from "./aria-label-config.ts";
import type { AriaLabelConfig } from "./aria-label-config.ts";
import { warnInDevelopment } from "./dev-warn.ts";
import type { ReactFlowOptions, ReactFlowProps } from "./react-flow-props.ts";

// The props that only the React layer reads. The rest (nodes, zoom limits, the change callbacks...)
// live in the flow's store, where the core uses them too.
export const VIEW_PROP_KEYS = [
  "nodeTypes",
  "edgeTypes",
  "defaultEdgeOptions",
  "onConnectStart",
  "onConnectEnd",
  "onClickConnectStart",
  "onClickConnectEnd",
  "onNodeClick",
  "onNodeDoubleClick",
  "onNodeMouseEnter",
  "onNodeMouseMove",
  "onNodeMouseLeave",
  "onNodeContextMenu",
  "onNodeDragStart",
  "onNodeDrag",
  "onNodeDragStop",
  "onEdgeClick",
  "onEdgeDoubleClick",
  "onEdgeContextMenu",
  "onEdgeMouseEnter",
  "onEdgeMouseMove",
  "onEdgeMouseLeave",
  "onReconnect",
  "onReconnectStart",
  "onReconnectEnd",
  "onSelectionDragStart",
  "onSelectionDrag",
  "onSelectionDragStop",
  "onSelectionContextMenu",
  "onSelectionStart",
  "onSelectionEnd",
  "onPaneClick",
  "onPaneContextMenu",
  "onPaneScroll",
  "onPaneMouseMove",
  "onPaneMouseEnter",
  "onPaneMouseLeave",
  "onMove",
  "onMoveStart",
  "onMoveEnd",
  "onError",
  "connectionLineType",
  "connectionLineStyle",
  "connectionLineComponent",
  "connectionLineContainerStyle",
  "connectOnClick",
  "selectionKeyCode",
  "multiSelectionKeyCode",
  "deleteKeyCode",
  "panActivationKeyCode",
  "zoomActivationKeyCode",
  "defaultMarkerColor",
  "panOnDrag",
  "panOnScroll",
  "panOnScrollSpeed",
  "panOnScrollMode",
  "zoomOnScroll",
  "zoomOnPinch",
  "zoomOnDoubleClick",
  "selectionOnDrag",
  "selectionMode",
  "preventScrolling",
  "paneClickDistance",
  "nodeClickDistance",
  "disableKeyboardA11y",
  "noDragClassName",
  "noWheelClassName",
  "noPanClassName",
  "rfId",
  "reconnectRadius",
  "proOptions",
  "autoPanOnSelection",
  "autoPanOnNodeFocus",
] as const satisfies readonly (keyof ReactFlowOptions)[];

type ViewPropKey = (typeof VIEW_PROP_KEYS)[number];

// Props with a default are always present; the rest (mostly handlers) may be missing.
type Defaulted =
  | "nodeTypes"
  | "edgeTypes"
  | "defaultEdgeOptions"
  | "connectionLineType"
  | "connectOnClick"
  | "selectionKeyCode"
  | "multiSelectionKeyCode"
  | "deleteKeyCode"
  | "panActivationKeyCode"
  | "zoomActivationKeyCode"
  | "defaultMarkerColor"
  | "panOnDrag"
  | "panOnScroll"
  | "panOnScrollSpeed"
  | "panOnScrollMode"
  | "zoomOnScroll"
  | "zoomOnPinch"
  | "zoomOnDoubleClick"
  | "selectionOnDrag"
  | "selectionMode"
  | "preventScrolling"
  | "paneClickDistance"
  | "nodeClickDistance"
  | "disableKeyboardA11y"
  | "noDragClassName"
  | "noWheelClassName"
  | "noPanClassName"
  | "rfId"
  | "reconnectRadius"
  | "proOptions"
  | "autoPanOnSelection"
  | "autoPanOnNodeFocus";

export type ViewProps = Required<Pick<ReactFlowOptions, Defaulted>> &
  Partial<Pick<ReactFlowOptions, Exclude<ViewPropKey, Defaulted>>> & {
    ariaLabels: AriaLabelConfig;
    /** The `nodesDraggable` of the flow as its props set it, whatever the store has been told since. */
    nodesDraggableProp: boolean;
  };

export function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/u.test(navigator.userAgent);
}

const DEFAULT_PAN_SPEED = 0.5;
const DEFAULT_RECONNECT_RADIUS = 10;

export function defaultViewProps(): ViewProps {
  const modifier = isMac() ? "Meta" : "Control";
  return {
    nodeTypes: {},
    edgeTypes: {},
    defaultEdgeOptions: {},
    connectionLineType: ConnectionLineType.Bezier,
    connectOnClick: true,
    selectionKeyCode: "Shift",
    multiSelectionKeyCode: modifier,
    deleteKeyCode: "Backspace",
    panActivationKeyCode: "Space",
    zoomActivationKeyCode: modifier,
    defaultMarkerColor: "#b1b1b7",
    panOnDrag: true,
    panOnScroll: false,
    panOnScrollSpeed: DEFAULT_PAN_SPEED,
    panOnScrollMode: PanOnScrollMode.Free,
    zoomOnScroll: true,
    zoomOnPinch: true,
    zoomOnDoubleClick: true,
    nodesDraggableProp: true,
    selectionOnDrag: false,
    selectionMode: SelectionMode.Full,
    preventScrolling: true,
    paneClickDistance: 1,
    nodeClickDistance: 0,
    disableKeyboardA11y: false,
    noDragClassName: "nodrag",
    noWheelClassName: "nowheel",
    noPanClassName: "nopan",
    rfId: "1",
    reconnectRadius: DEFAULT_RECONNECT_RADIUS,
    proOptions: {},
    autoPanOnSelection: true,
    autoPanOnNodeFocus: true,
    ariaLabels: DEFAULT_ARIA_LABEL_CONFIG,
  };
}

function pickViewProps(props: ReactFlowProps): Partial<ViewProps> {
  const picked: Partial<Pick<ReactFlowProps, ViewPropKey>> = {};
  for (const key of VIEW_PROP_KEYS) {
    Object.assign(picked, { [key]: props[key] });
  }
  return withoutUndefined(picked);
}

/** The flow's `onError`: the given one, or a warning in development builds as React Flow has. */
export function onErrorOf(
  props: Pick<ReactFlowProps, "onError">,
): NonNullable<ReactFlowProps["onError"]> {
  return props.onError ?? warnInDevelopment;
}

/** The React-level props among a flow's props, with the unset ones left out. */
export function viewPropsFrom(props: ReactFlowProps): Partial<ViewProps> {
  return {
    ...pickViewProps(props),
    // As React Flow's store, there is always an `onError`: a warning when development builds.
    onError: onErrorOf(props),
    nodesDraggableProp: props.nodesDraggable ?? true,
  };
}

export type ViewPropsStore = Store<ViewProps>;

export const ViewPropsContext = createContext<ViewPropsStore | null>(null);

/** The store holding the React-level props of the enclosing `<ReactFlow>`. */
export function useViewPropsStore(): ViewPropsStore {
  const store = useContext(ViewPropsContext);
  if (store === null) {
    throw new Error("Free-Flow: this component has to be rendered inside <ReactFlow>.");
  }
  return store;
}

/** Reads a part of the React-level props, re-rendering only when that part changes. */
export function useViewProps<TSelected>(
  selector: (props: ViewProps) => TSelected,
  equalityFn?: (a: TSelected, b: TSelected) => boolean,
): TSelected {
  const store = useViewPropsStore();
  const subscribe = useCallback(
    (onChange: () => void) =>
      store.subscribe(() => {
        onChange();
      }),
    [store],
  );
  return useSyncExternalStoreWithSelector(
    subscribe,
    store.getState,
    store.getState,
    selector,
    equalityFn,
  );
}

/** The initial React-level props of a flow: the defaults, then what the props set. */
export function initialViewProps(props: ReactFlowProps): ViewProps {
  return {
    ...defaultViewProps(),
    ...viewPropsFrom(props),
    ariaLabels: resolveAriaLabels(props.ariaLabelConfig),
  };
}
