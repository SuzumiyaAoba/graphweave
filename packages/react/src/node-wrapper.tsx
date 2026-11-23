import type { InternalNode } from "@free-flow/core";
import { createContext, createElement, memo, useContext, useLayoutEffect, useRef } from "react";
import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
} from "react";

import { cx } from "./class-names.ts";
import { registerFlagReader, registerRemeasure } from "./dom-registry.ts";
import { hasClassUpTo, isInputDOMNode } from "./dom-utils.ts";
import { useNodeDragging } from "./drag-flag.ts";
import { beginNodeDrag, wasJustDragged } from "./drag-session.ts";
import { queueMeasurement } from "./measure-queue.ts";
import { handleFlagLists, measureNode } from "./measure.ts";
import { panToFocusedNode } from "./node-focus.ts";
import { keyboardMove } from "./node-keyboard.ts";
import { SELECTION_KEYS, selectFromClick } from "./node-select.ts";
import { inlineSize } from "./node-size.ts";
import { resolveNodeType } from "./node-types.tsx";
import { noop } from "./noop.ts";
import { shallow } from "./shallow.ts";
import { NodeIdContext } from "./store-context.ts";
import { markDraggable } from "./touch-style.ts";
import type { Node, NodeProps } from "./types.ts";
import { useRemeasureOnShape } from "./use-remeasure-on-shape.ts";
import { useStore, useStoreApi } from "./use-store.ts";
import { useUnknownTypeError } from "./use-unknown-type-error.ts";
import { useViewProps, useViewPropsStore } from "./view-props.ts";

export const ARIA_NODE_DESC_KEY = "react-flow__node-desc";

/** Observes node elements, so their size is measured again when it changes. */
export interface NodeObserver {
  observe: (element: Element) => void;
  unobserve: (element: Element) => void;
}

export const NodeObserverContext = createContext<NodeObserver | null>(null);

interface NodeFlags {
  selectable: boolean;
  draggable: boolean;
  connectable: boolean;
  focusable: boolean;
  selectNodesOnDrag: boolean;
  nodeDragThreshold: number;
  /** Whether the node has children. */
  isParent: boolean;
  /** Whether the node is being dragged by its own press. */
  dragging: boolean;
}

function matchesDragHandle(
  target: EventTarget | null,
  selector: string,
  boundary: Element,
): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  const handle = target.closest(selector);
  return handle !== null && boundary.contains(handle);
}

function nodePropsOf(node: InternalNode<Node>, flags: NodeFlags): NodeProps {
  return {
    id: node.id,
    data: node.data,
    type: node.type ?? "default",
    selected: node.selected === true,
    dragging: flags.dragging,
    draggable: flags.draggable,
    selectable: flags.selectable,
    deletable: node.deletable !== false,
    isConnectable: flags.connectable,
    zIndex: node.internals.z,
    positionAbsoluteX: node.internals.positionAbsolute.x,
    positionAbsoluteY: node.internals.positionAbsolute.y,
    width: node.measured.width ?? node.width ?? node.initialWidth,
    height: node.measured.height ?? node.height ?? node.initialHeight,
    ...(node.sourcePosition === undefined ? {} : { sourcePosition: node.sourcePosition }),
    ...(node.targetPosition === undefined ? {} : { targetPosition: node.targetPosition }),
    ...(node.dragHandle === undefined ? {} : { dragHandle: node.dragHandle }),
    ...(node.parentId === undefined ? {} : { parentId: node.parentId }),
  };
}

/** One node of the flow: positions it, measures it and wires up selection and dragging. */
function NodeWrapperComponent({ id }: { id: string }): ReactElement | null {
  const store = useStoreApi();
  const view = useViewPropsStore();
  const node = useStore((state) => state.nodeLookup.get(id));
  const nodeTypes = useViewProps((props) => props.nodeTypes);
  const noDrag = useViewProps((props) => props.noDragClassName);
  const noPan = useViewProps((props) => props.noPanClassName);
  // As in React Flow, a node that nothing can select or drag still takes the pointer when the flow
  // listens to its clicks or to the pointer moving over it (`onNodeDoubleClick` and
  // `onNodeContextMenu` do not count).
  const listened = useViewProps(
    (props) =>
      props.onNodeClick !== undefined ||
      props.onNodeMouseEnter !== undefined ||
      props.onNodeMouseMove !== undefined ||
      props.onNodeMouseLeave !== undefined,
  );
  // As in React Flow, what a node shows of being draggable follows the `nodesDraggable` of the flow
  // and not the store, which the lock of the controls turns off: the drag itself asks the store.
  const nodesDraggable = useViewProps((props) => props.nodesDraggableProp);
  const observer = useContext(NodeObserverContext);
  const ref = useRef<HTMLDivElement>(null);
  const flags = useStore(
    (state): NodeFlags => ({
      selectable: node?.selectable ?? state.elementsSelectable,
      draggable: node?.draggable ?? nodesDraggable,
      connectable: node?.connectable ?? state.nodesConnectable,
      focusable: node?.focusable ?? state.nodesFocusable,
      selectNodesOnDrag: state.selectNodesOnDrag,
      nodeDragThreshold: state.nodeDragThreshold,
      isParent: state.parentLookup.has(id),
      dragging: false,
    }),
    shallow,
  );
  const dragging = useNodeDragging(store, id);
  const keyboardOff = useViewProps((props) => props.disableKeyboardA11y);
  const ariaLabels = useViewProps((props) => props.ariaLabels);
  const rfId = useViewProps((props) => props.rfId);
  useUnknownTypeError(
    view,
    "Node",
    node !== undefined && !resolveNodeType(nodeTypes, node.type ?? "default").known
      ? node.type
      : undefined,
  );
  // A node that can be dragged keeps its touches for itself.
  useLayoutEffect(() => {
    if (flags.draggable) {
      markDraggable(ref.current);
    }
  }, [flags.draggable]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      return noop;
    }
    const measure = (): void => {
      queueMeasurement(store, measureNode(element, store.getState().viewport.zoom));
    };
    measure();
    observer?.observe(element);
    const unregister = registerRemeasure(store, id, measure);
    const forgetFlags = registerFlagReader(store, id, () => handleFlagLists(element));
    return (): void => {
      unregister();
      forgetFlags();
      observer?.unobserve(element);
    };
  }, [id, store, observer]);
  useRemeasureOnShape(
    store,
    ref,
    `${node?.type ?? "default"} ${node?.sourcePosition ?? ""} ${node?.targetPosition ?? ""}`,
  );
  if (node === undefined) {
    return null;
  }
  const { type, component } = resolveNodeType(nodeTypes, node.type ?? "default");
  const { positionAbsolute, z } = node.internals;
  // A node is shown once its size is known: measured, or given by the owner.
  const measured =
    (node.measured.width ?? node.width ?? node.initialWidth) !== undefined &&
    (node.measured.height ?? node.height ?? node.initialHeight) !== undefined;

  const handleFocus = (event: ReactFocusEvent<HTMLDivElement>): void => {
    panToFocusedNode({ store, view, nodeId: id }, event);
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const { currentTarget: element, target } = event;
    // As React Flow's drag, which listens on the node's own element: what the node draws elsewhere
    // (its toolbar, through a portal) does not drag it, and the press pans the canvas instead.
    const inside = target instanceof Element && element.contains(target);
    const grabbed =
      node.dragHandle === undefined || matchesDragHandle(target, node.dragHandle, element);
    const free = inside && grabbed && !hasClassUpTo(target, noDrag, element);
    if (event.button === 0 && flags.draggable && free) {
      event.stopPropagation();
      beginNodeDrag({ store, view, nodeId: id }, event.nativeEvent);
    }
  };
  const handleClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (wasJustDragged(store)) {
      return;
    }
    const clickSelects =
      !flags.selectNodesOnDrag || !flags.draggable || flags.nodeDragThreshold > 0;
    if (
      flags.selectable &&
      clickSelects &&
      selectFromClick(store, id, { onError: view.getState().onError })
    ) {
      // As React Flow does, a node that left the selection by a click lets go of the focus too.
      requestAnimationFrame(() => {
        ref.current?.blur();
      });
    }
    view.getState().onNodeClick?.(event, node.internals.userNode);
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    // As React Flow, a key pressed anywhere inside the node (not in a text control) is the node's.
    if (keyboardOff || isInputDOMNode(event.nativeEvent)) {
      return;
    }
    if (SELECTION_KEYS.has(event.key) && flags.selectable) {
      const element = event.currentTarget;
      if (event.key !== "Escape" && event.target === element) {
        event.preventDefault();
      }
      const left = selectFromClick(store, id, {
        onError: view.getState().onError,
        unselect: event.key === "Escape",
      });
      if (left) {
        // As React Flow does, the node lets go of the focus in the next frame.
        requestAnimationFrame(() => {
          element.blur();
        });
      }
    } else if (flags.draggable && node.selected === true) {
      keyboardMove(store, event, {
        nodeId: id,
        announce: ariaLabels["node.a11yDescription.ariaLiveMessage"],
      });
    }
  };
  const forward =
    (
      name:
        | "onNodeDoubleClick"
        | "onNodeContextMenu"
        | "onNodeMouseEnter"
        | "onNodeMouseMove"
        | "onNodeMouseLeave",
    ) =>
    (event: ReactMouseEvent<HTMLDivElement>): void => {
      view.getState()[name]?.(event, node.internals.userNode);
    };
  return (
    // The role comes from `node.ariaRole`, which the rule cannot see; it is `group` for a node that
    // can be focused, unless set.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={ref}
      data-id={id}
      data-testid={`rf__node-${id}`}
      className={cx(
        "react-flow__node",
        `react-flow__node-${type}`,
        flags.draggable && noPan,
        node.className,
        node.selected === true && "selected",
        flags.selectable && "selectable",
        flags.isParent && "parent",
        flags.draggable && "draggable",
        dragging && "dragging",
      )}
      style={{
        zIndex: z,
        transform: `translate(${positionAbsolute.x}px,${positionAbsolute.y}px)`,
        pointerEvents: flags.selectable || flags.draggable || listened ? "all" : "none",
        visibility: measured ? "visible" : "hidden",
        ...node.style,
        ...inlineSize(node),
      }}
      tabIndex={flags.focusable ? 0 : undefined}
      role={node.ariaRole ?? (flags.focusable ? "group" : undefined)}
      aria-roledescription="node"
      aria-label={node.ariaLabel}
      aria-describedby={keyboardOff ? undefined : `${ARIA_NODE_DESC_KEY}-${rfId}`}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onDoubleClick={forward("onNodeDoubleClick")}
      onContextMenu={forward("onNodeContextMenu")}
      onMouseEnter={forward("onNodeMouseEnter")}
      onMouseMove={forward("onNodeMouseMove")}
      onMouseLeave={forward("onNodeMouseLeave")}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      {...node.domAttributes}
    >
      <NodeIdContext.Provider value={id}>
        {createElement(component, nodePropsOf(node, { ...flags, dragging }))}
      </NodeIdContext.Provider>
    </div>
  );
}

export const NodeWrapper = memo(NodeWrapperComponent);
