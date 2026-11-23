import type { FlowSettings } from "@free-flow/core";
import type { HTMLAttributes } from "react";

import type { ReactFlowOptions, ReactFlowProps } from "./react-flow-props.ts";

// One entry per option of `<ReactFlow>`. Being a record of every key, it fails to compile when an
// option is added to the type and forgotten here, which keeps options from leaking into the DOM.
const OPTION_KEY_RECORD: Record<keyof ReactFlowOptions, true> = {
  nodes: true,
  edges: true,
  defaultNodes: true,
  defaultEdges: true,
  nodeTypes: true,
  edgeTypes: true,
  defaultEdgeOptions: true,
  onNodesChange: true,
  onEdgesChange: true,
  onConnect: true,
  onConnectStart: true,
  onConnectEnd: true,
  onClickConnectStart: true,
  onClickConnectEnd: true,
  isValidConnection: true,
  onNodeClick: true,
  onNodeDoubleClick: true,
  onNodeMouseEnter: true,
  onNodeMouseMove: true,
  onNodeMouseLeave: true,
  onNodeContextMenu: true,
  onNodeDragStart: true,
  onNodeDrag: true,
  onNodeDragStop: true,
  onEdgeClick: true,
  onEdgeDoubleClick: true,
  onEdgeContextMenu: true,
  onEdgeMouseEnter: true,
  onEdgeMouseMove: true,
  onEdgeMouseLeave: true,
  onReconnect: true,
  onReconnectStart: true,
  onReconnectEnd: true,
  onSelectionChange: true,
  onSelectionDragStart: true,
  onSelectionDrag: true,
  onSelectionDragStop: true,
  onSelectionContextMenu: true,
  onSelectionStart: true,
  onSelectionEnd: true,
  onPaneClick: true,
  onPaneContextMenu: true,
  onPaneScroll: true,
  onPaneMouseMove: true,
  onPaneMouseEnter: true,
  onPaneMouseLeave: true,
  onMove: true,
  onMoveStart: true,
  onMoveEnd: true,
  onViewportChange: true,
  onInit: true,
  onDelete: true,
  onNodesDelete: true,
  onEdgesDelete: true,
  onBeforeDelete: true,
  onError: true,
  connectionMode: true,
  connectionLineType: true,
  connectionLineStyle: true,
  connectionLineComponent: true,
  connectionLineContainerStyle: true,
  connectionRadius: true,
  connectOnClick: true,
  selectionKeyCode: true,
  multiSelectionKeyCode: true,
  deleteKeyCode: true,
  panActivationKeyCode: true,
  zoomActivationKeyCode: true,
  fitView: true,
  fitViewOptions: true,
  minZoom: true,
  maxZoom: true,
  defaultViewport: true,
  viewport: true,
  snapToGrid: true,
  snapGrid: true,
  defaultMarkerColor: true,
  nodesDraggable: true,
  nodesConnectable: true,
  nodesFocusable: true,
  edgesFocusable: true,
  edgesReconnectable: true,
  elementsSelectable: true,
  autoPanOnConnect: true,
  autoPanOnNodeDrag: true,
  autoPanOnSelection: true,
  autoPanOnNodeFocus: true,
  attributionPosition: true,
  autoPanSpeed: true,
  selectNodesOnDrag: true,
  panOnDrag: true,
  panOnScroll: true,
  panOnScrollSpeed: true,
  panOnScrollMode: true,
  zoomOnScroll: true,
  zoomOnPinch: true,
  zoomOnDoubleClick: true,
  selectionOnDrag: true,
  selectionMode: true,
  preventScrolling: true,
  paneClickDistance: true,
  nodeClickDistance: true,
  nodeDragThreshold: true,
  connectionDragThreshold: true,
  nodeExtent: true,
  translateExtent: true,
  nodeOrigin: true,
  elevateNodesOnSelect: true,
  elevateEdgesOnSelect: true,
  zIndexMode: true,
  onlyRenderVisibleElements: true,
  disableKeyboardA11y: true,
  noDragClassName: true,
  noWheelClassName: true,
  noPanClassName: true,
  rfId: true,
  ariaLabelConfig: true,
  colorMode: true,
  proOptions: true,
  debug: true,
  width: true,
  height: true,
  reconnectRadius: true,
};

export function isOptionKey(key: string): key is keyof ReactFlowOptions {
  return Object.hasOwn(OPTION_KEY_RECORD, key);
}

/** The props that are not options: HTML attributes for the container element. */
export function htmlAttributesOf(props: ReactFlowProps): HTMLAttributes<HTMLDivElement> {
  const entries = Object.entries(props).filter(([key]) => !isOptionKey(key) && key !== "children");
  return Object.fromEntries(entries);
}

// The options the core store understands directly, taken from `<ReactFlow>`'s props.
const SETTING_KEYS = [
  "minZoom",
  "maxZoom",
  "translateExtent",
  "nodeExtent",
  "nodeOrigin",
  "snapToGrid",
  "snapGrid",
  "nodesDraggable",
  "nodesConnectable",
  "nodesFocusable",
  "edgesFocusable",
  "edgesReconnectable",
  "elementsSelectable",
  "selectNodesOnDrag",
  "elevateNodesOnSelect",
  "elevateEdgesOnSelect",
  "zIndexMode",
  "connectionMode",
  "connectionRadius",
  "connectionDragThreshold",
  "nodeDragThreshold",
  "autoPanOnConnect",
  "autoPanOnNodeDrag",
  "autoPanSpeed",
  "onlyRenderVisibleElements",
  "debug",
  "onNodesChange",
  "onEdgesChange",
  "onConnect",
  "onNodesDelete",
  "onEdgesDelete",
  "onDelete",
  "onBeforeDelete",
  "onViewportChange",
  "isValidConnection",
] as const satisfies readonly (keyof ReactFlowOptions & keyof FlowSettings<never, never>)[];

type SettingKey = (typeof SETTING_KEYS)[number];

/** The store settings among a flow's props; unset ones are left out. */
export function settingsOf(props: ReactFlowProps): Partial<Pick<ReactFlowProps, SettingKey>> {
  const picked: Partial<Pick<ReactFlowProps, SettingKey>> = {};
  for (const key of SETTING_KEYS) {
    if (props[key] !== undefined) {
      Object.assign(picked, { [key]: props[key] });
    }
  }
  return picked;
}

/**
 * The settings in `next` whose value differs from the one applied last time. Re-applying an
 * unchanged setting would overwrite what the flow changed since (a handle's own validator, the
 * lock button of the controls), so only what the props changed is passed on.
 */
export function changedSettings(
  applied: Partial<Pick<ReactFlowProps, SettingKey>>,
  next: Partial<Pick<ReactFlowProps, SettingKey>>,
): Partial<Pick<ReactFlowProps, SettingKey>> {
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => !Object.is(Reflect.get(applied, key), value)),
  );
}
