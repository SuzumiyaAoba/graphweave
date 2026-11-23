import { errorMessages } from "@free-flow/core";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";

import { resolveAriaLabels } from "./aria-label-config.ts";
import { registerFlowElement } from "./dom-registry.ts";
import { noop } from "./noop.ts";
import { changedSettings, settingsOf } from "./option-keys.ts";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { fitAtStart } from "./start-fit.ts";
import type { ReactFlowStore } from "./store-context.ts";
import { onErrorOf, viewPropsFrom } from "./view-props.ts";
import type { ViewPropsStore } from "./view-props.ts";

/**
 * Keeps the flow's stores in step with the props of `<ReactFlow>`: the React-level props and the
 * core settings.
 */
export function useStoreBindings(
  store: ReactFlowStore,
  view: ViewPropsStore,
  props: ReactFlowProps,
): void {
  const ariaLabels = useMemo(
    () => resolveAriaLabels(props.ariaLabelConfig),
    [props.ariaLabelConfig],
  );
  // These run every render; the stores skip updates that change nothing.
  useLayoutEffect(() => {
    view.setState({ ...viewPropsFrom(props), ariaLabels });
  });
  const applied = useRef<ReturnType<typeof settingsOf>>({});
  useLayoutEffect(() => {
    const next = settingsOf(props);
    const changed = changedSettings(applied.current, next);
    applied.current = next;
    store.getState().setConfig(changed);
  });
}

/**
 * Hands the nodes and edges that a controlled flow is given to the store whenever they change. A
 * flow that owns them (`defaultNodes`, `defaultEdges`) is left alone.
 */
export function useControlledProps(store: ReactFlowStore, props: ReactFlowProps): void {
  const { nodes, edges } = props;
  useLayoutEffect(() => {
    if (nodes !== undefined && nodes !== store.getState().nodes) {
      store.getState().setNodes(nodes);
    }
  }, [nodes, store]);
  useLayoutEffect(() => {
    if (edges !== undefined && edges !== store.getState().edges) {
      store.getState().setEdges(edges);
    }
  }, [edges, store]);
}

// A store that a provider around the flow made knows nothing of the nodes and edges the flow is to
// start with: as in React Flow they are handed to it when the flow mounts. (The store a flow makes
// for itself has them from the start.)
function takeDefaults(
  store: ReactFlowStore,
  defaults: Pick<ReactFlowProps, "defaultNodes" | "defaultEdges">,
): () => void {
  const state = store.getState();
  const nodes = state.hasDefaultNodes ? undefined : defaults.defaultNodes;
  const edges = state.hasDefaultEdges ? undefined : defaults.defaultEdges;
  if (nodes !== undefined || edges !== undefined) {
    state.setDefaultNodesAndEdges(nodes, edges);
  }
  // The flow goes away: what it handed over goes with it, so that the flow that comes next under
  // the same provider starts with its own (React Flow resets the whole store then).
  return () => {
    if (nodes !== undefined) {
      store.getState().setNodes([]);
      store.setState({ hasDefaultNodes: false });
    }
    if (edges !== undefined) {
      store.getState().setEdges([]);
      store.setState({ hasDefaultEdges: false });
    }
  };
}

/** Applies the options that only matter when the flow starts: the initial viewport and fit. */
export function useFlowStart(store: ReactFlowStore, props: ReactFlowProps): void {
  // Only the first render counts: later changes to these props do not move a flow that is running.
  const initial = useRef({
    defaultNodes: props.defaultNodes,
    defaultEdges: props.defaultEdges,
    defaultViewport: props.defaultViewport,
    fitView: props.fitView,
    fitViewOptions: props.fitViewOptions,
    onError: onErrorOf(props),
  });
  useLayoutEffect(() => {
    const { defaultViewport, fitView, fitViewOptions, onError } = initial.current;
    const giveBack = takeDefaults(store, initial.current);
    // A viewport the owner holds wins over the one to start from.
    if (defaultViewport !== undefined && !store.getState().viewportControlled) {
      store.getState().setViewport(defaultViewport);
    }
    if (fitView === true) {
      fitAtStart(store, fitViewOptions, onError);
    }
    return giveBack;
  }, [store]);
}

export interface ContainerSizing {
  store: ReactFlowStore;
  view: ViewPropsStore;
  ref: RefObject<HTMLDivElement | null>;
}

// Measures the element, tells the store, and complains when it has no usable size.
function reportSize(
  { store, view }: ContainerSizing,
  element: HTMLElement,
  explicit: { width: number | undefined; height: number | undefined },
): void {
  const width = explicit.width ?? element.offsetWidth;
  const height = explicit.height ?? element.offsetHeight;
  store.getState().setSize(width, height);
  if (width <= 0 || height <= 0) {
    view.getState().onError?.("004", errorMessages.error004());
  }
}

// Watches the element for size changes; returns the function that stops watching.
function watchSize(element: Element, onResize: () => void): () => void {
  if (typeof ResizeObserver === "undefined") {
    return noop;
  }
  const observer = new ResizeObserver(onResize);
  observer.observe(element);
  return () => {
    observer.disconnect();
  };
}

// As d3-zoom, which reads the size of the element whenever a gesture starts, a press or a wheel on
// the flow measures it again when the size the store holds is not the element's any more (the
// element resized and its ResizeObserver has not told it yet).
function measureOnGesture(
  element: HTMLElement,
  store: ReactFlowStore,
  measure: () => void,
): () => void {
  const check = (): void => {
    const { width, height } = store.getState();
    if (element.offsetWidth !== width || element.offsetHeight !== height) {
      measure();
    }
  };
  const options = { capture: true, passive: true };
  element.addEventListener("pointerdown", check, options);
  element.addEventListener("wheel", check, options);
  return (): void => {
    element.removeEventListener("pointerdown", check, options);
    element.removeEventListener("wheel", check, options);
  };
}

/**
 * Registers the container element and keeps the store informed of its size, which every viewport
 * calculation depends on. An explicit `width`/`height` prop wins over measuring.
 */
export function useContainerSize(
  sizing: ContainerSizing,
  explicit: { width: number | undefined; height: number | undefined },
): void {
  const { store, view, ref } = sizing;
  const { width, height } = explicit;
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      return noop;
    }
    const unregister = registerFlowElement(store, element);
    store.setState({ domNode: element });
    const measure = (): void => {
      reportSize({ store, view, ref }, element, { width, height });
    };
    measure();
    const unwatch = watchSize(element, measure);
    const unwatchGestures = measureOnGesture(element, store, measure);
    return (): void => {
      unwatch();
      unwatchGestures();
      unregister();
      store.setState({ domNode: null });
    };
  }, [store, view, ref, width, height]);
}
