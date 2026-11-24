import { errorMessages } from "@graphweave/core";
import type { InternalNode, ZIndexMode } from "@graphweave/core";
import { createElement, memo, useEffect, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactElement,
} from "react";

import { cx } from "./class-names.ts";
import { isInputDOMNode } from "./dom-utils.ts";
import { getEdgeEndpoints } from "./edge-position.ts";
import { EdgeReconnectAnchor, beginReconnect } from "./edge-reconnect.tsx";
import { resolveEdgeType } from "./edge-types.tsx";
import { markerUrl } from "./markers.tsx";
import type { ReactFlowStore } from "./store-context.ts";
import type { Edge, EdgeProps, Node } from "./types.ts";
import { useStore, useStoreApi } from "./use-store.ts";
import { useUnknownTypeError } from "./use-unknown-type-error.ts";
import { useViewProps, useViewPropsStore } from "./view-props.ts";

const SELECTED_EDGE_Z = 1000;

// The stacking of an edge, as React Flow works it out: its own z-index, lifted when it is selected
// and `elevateEdgesOnSelect` is on, plus the z of a node it hangs on that is nested in a parent or,
// with the lifting on, selected.
function elevatedZ(
  ends: { edge: Edge; source: InternalNode<Node>; target: InternalNode<Node> },
  stacking: { elevate: boolean; mode: ZIndexMode },
): number {
  const { edge, source, target } = ends;
  const { elevate, mode } = stacking;
  const own = edge.zIndex ?? 0;
  if (mode === "manual") {
    return own;
  }
  const edgeZ = elevate && edge.selected === true ? own + SELECTED_EDGE_Z : own;
  const lifts = (node: InternalNode<Node>): number =>
    node.parentId !== undefined || (elevate && node.selected === true) ? node.internals.z : 0;
  return edgeZ + Math.max(lifts(source), lifts(target));
}

export const ARIA_EDGE_DESC_KEY = "react-flow__edge-desc";

// Resolves to whether the edge left the selection.
function selectEdge(store: ReactFlowStore, edge: Edge): boolean {
  const state = store.getState();
  store.setState({ nodesSelectionActive: false });
  // As React Flow: a click on a selected edge takes it out only while several are being selected;
  // otherwise it becomes the whole selection, also when it was part of one already.
  if (edge.selected === true && state.multiSelectionActive) {
    state.unselectNodesAndEdges({ nodes: [], edges: [{ id: edge.id }] });
    return true;
  }
  state.addSelectedEdges([edge.id]);
  return false;
}

// What the edge is called to a screen reader: its own label, `null` for none, else where it goes.
function ariaLabelOf(edge: Edge): string | undefined {
  if (edge.ariaLabel === null) {
    return undefined;
  }
  return edge.ariaLabel === undefined || edge.ariaLabel === ""
    ? `Edge from ${edge.source} to ${edge.target}`
    : edge.ariaLabel;
}

/** One edge of the flow: finds its endpoints, draws it, and wires up selection and events. */
function EdgeWrapperComponent({ id }: { id: string }): ReactElement | null {
  const store = useStoreApi();
  const view = useViewPropsStore();
  const stored = useStore((state) => state.edgeLookup.get(id));
  const source = useStore((state) =>
    stored === undefined ? undefined : state.nodeLookup.get(stored.source),
  );
  const target = useStore((state) =>
    stored === undefined ? undefined : state.nodeLookup.get(stored.target),
  );
  const mode = useStore((state) => state.connectionMode);
  // The flags are read from the edge as it is drawn: with the `defaultEdgeOptions` under its own.
  const flags = useStore(
    (state) => {
      const own = { ...state.defaultEdgeOptions, ...stored };
      return {
        selectable: own.selectable ?? state.elementsSelectable,
        focusable: own.focusable ?? state.edgesFocusable,
        elevate: state.elevateEdgesOnSelect,
        mode: state.zIndexMode,
        reconnectable: own.reconnectable ?? state.edgesReconnectable,
      };
    },
    (a, b) =>
      a.selectable === b.selectable &&
      a.focusable === b.focusable &&
      a.elevate === b.elevate &&
      a.mode === b.mode &&
      a.reconnectable === b.reconnectable,
  );
  const edgeTypes = useViewProps((props) => props.edgeTypes);
  const defaults = useViewProps((props) => props.defaultEdgeOptions);
  const rfId = useViewProps((props) => props.rfId);
  const keyboardOff = useViewProps((props) => props.disableKeyboardA11y);
  const clickable = useViewProps((props) => props.onEdgeClick !== undefined);
  const noPan = useViewProps((props) => props.noPanClassName);
  const canReconnect = useViewProps((props) => props.onReconnect !== undefined);
  const reconnectRadius = useViewProps((props) => props.reconnectRadius);
  const [updateHover, setUpdateHover] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const edge: Edge | undefined = stored === undefined ? undefined : { ...defaults, ...stored };
  const result =
    edge === undefined || source === undefined || target === undefined
      ? undefined
      : getEdgeEndpoints(edge, { source, target }, mode);
  const missingSide = result?.status === "missing-handle" ? result.side : undefined;
  const resolved =
    edge === undefined ? undefined : resolveEdgeType(edgeTypes, edge.type ?? "default");
  useUnknownTypeError(
    view,
    "Edge",
    resolved !== undefined && !resolved.known ? edge?.type : undefined,
  );
  const sourceHandle = edge?.sourceHandle;
  const targetHandle = edge?.targetHandle;
  useEffect(() => {
    if (missingSide !== undefined) {
      view
        .getState()
        .onError?.("008", errorMessages.error008(missingSide, { id, sourceHandle, targetHandle }));
    }
  }, [missingSide, id, view, sourceHandle, targetHandle]);
  if (
    edge === undefined ||
    source === undefined ||
    target === undefined ||
    result?.status !== "ready" ||
    source.hidden === true ||
    target.hidden === true
  ) {
    return null;
  }
  const { type, component } = resolveEdgeType(edgeTypes, edge.type ?? "default");
  const selected = edge.selected === true;
  const zIndex = elevatedZ({ edge, source, target }, flags);
  const userEdge = stored ?? edge;
  const props: EdgeProps = {
    id,
    type,
    source: edge.source,
    target: edge.target,
    ...result.endpoints,
    // As the owner wrote them, not the ids of the handles that were found.
    sourceHandleId: edge.sourceHandle,
    targetHandleId: edge.targetHandle,
    selected: edge.selected,
    animated: edge.animated,
    selectable: flags.selectable,
    deletable: edge.deletable !== false,
    data: edge.data,
    style: edge.style,
    markerStart: markerUrl(edge.markerStart, rfId),
    markerEnd: markerUrl(edge.markerEnd, rfId),
    interactionWidth: edge.interactionWidth,
    pathOptions: edge.pathOptions,
    label: edge.label,
    labelStyle: edge.labelStyle,
    labelShowBg: edge.labelShowBg,
    labelBgStyle: edge.labelBgStyle,
    labelBgPadding: edge.labelBgPadding,
    labelBgBorderRadius: edge.labelBgBorderRadius,
  };
  const handleClick = (event: ReactMouseEvent<SVGGElement>): void => {
    // As React Flow does, an edge that left the selection by a click lets go of the focus too.
    if (flags.selectable && selectEdge(store, userEdge)) {
      event.currentTarget.blur();
    }
    view.getState().onEdgeClick?.(event, userEdge);
  };
  const handleKeyDown = (event: ReactKeyboardEvent<SVGGElement>): void => {
    // As React Flow, a key pressed anywhere inside the edge is the edge's, but not one typed into a
    // control (React Flow's edge also takes those, from an input in its label: not copied).
    if (keyboardOff || isInputDOMNode(event.nativeEvent)) {
      return;
    }
    // As in React Flow, an edge that cannot be selected does nothing for these keys, and Enter and
    // Space only ever add it to the selection.
    if (!flags.selectable) {
      return;
    }
    if (event.key === "Escape") {
      event.currentTarget.blur();
      store.getState().unselectNodesAndEdges({ nodes: [], edges: [{ id }] });
    } else if (event.key === "Enter" || event.key === " ") {
      if (event.target === event.currentTarget) {
        event.preventDefault();
      }
      store.getState().addSelectedEdges([id]);
    }
  };
  const forward =
    (
      name:
        | "onEdgeDoubleClick"
        | "onEdgeContextMenu"
        | "onEdgeMouseEnter"
        | "onEdgeMouseMove"
        | "onEdgeMouseLeave",
    ) =>
    (event: ReactMouseEvent<SVGGElement>): void => {
      view.getState()[name]?.(event, userEdge);
    };
  return (
    <svg style={{ zIndex }}>
      <g
        className={cx(
          "react-flow__edge",
          `react-flow__edge-${type}`,
          edge.className,
          noPan,
          selected && "selected",
          edge.animated === true && "animated",
          // An edge that cannot be selected and has no click handler looks inactive.
          !flags.selectable && !clickable && "inactive",
          flags.selectable && "selectable",
          updateHover && "updating",
        )}
        data-id={id}
        data-testid={`rf__edge-${id}`}
        tabIndex={flags.focusable ? 0 : undefined}
        role={edge.ariaRole ?? (flags.focusable ? "group" : "img")}
        aria-roledescription="edge"
        aria-label={ariaLabelOf(edge)}
        aria-describedby={flags.focusable ? `${ARIA_EDGE_DESC_KEY}-${rfId}` : undefined}
        onClick={handleClick}
        onDoubleClick={forward("onEdgeDoubleClick")}
        onContextMenu={forward("onEdgeContextMenu")}
        onMouseEnter={forward("onEdgeMouseEnter")}
        onMouseMove={forward("onEdgeMouseMove")}
        onMouseLeave={forward("onEdgeMouseLeave")}
        onKeyDown={handleKeyDown}
        {...edge.domAttributes}
      >
        {reconnecting ? null : createElement(component, props)}
        {canReconnect
          ? (["source", "target"] as const)
              .filter((end) => flags.reconnectable === true || flags.reconnectable === end)
              .map((end) => (
                <EdgeReconnectAnchor
                  key={end}
                  end={end}
                  x={end === "source" ? result.endpoints.sourceX : result.endpoints.targetX}
                  y={end === "source" ? result.endpoints.sourceY : result.endpoints.targetY}
                  radius={reconnectRadius}
                  position={
                    end === "source"
                      ? result.endpoints.sourcePosition
                      : result.endpoints.targetPosition
                  }
                  onHover={setUpdateHover}
                  onPress={(pressed, down) => {
                    const fixedIsSource = pressed === "target";
                    beginReconnect(
                      {
                        store,
                        view,
                        edge: userEdge,
                        fixed: fixedIsSource
                          ? {
                              nodeId: edge.source,
                              handleId: result.endpoints.sourceHandleId,
                              handleType: "source",
                            }
                          : {
                              nodeId: edge.target,
                              handleId: result.endpoints.targetHandleId,
                              handleType: "target",
                            },
                        onReconnecting: setReconnecting,
                      },
                      down,
                    );
                  }}
                />
              ))
          : null}
      </g>
    </svg>
  );
}

export const EdgeWrapper = memo(EdgeWrapperComponent);
