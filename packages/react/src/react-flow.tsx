import { createStore } from "@free-flow/core";
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactElement, UIEventHandler } from "react";

import { A11yDescriptions } from "./a11y-descriptions.tsx";
import { assignRef } from "./assign-ref.ts";
import { cx } from "./class-names.ts";
import { CONTAINER_STYLE } from "./container-style.ts";
import { NodesSelection } from "./nodes-selection.tsx";
import { noop } from "./noop.ts";
import { htmlAttributesOf, settingsOf } from "./option-keys.ts";
import { createPanZoom } from "./pan-zoom-adapter.ts";
import { Pane } from "./pane.tsx";
import { PortalRegistryContext, createPortalRegistry } from "./portal-targets.ts";
import type { ColorMode, ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlowProvider } from "./react-flow-provider.tsx";
import { SelectionListener } from "./selection-listener.tsx";
import { fitIfWaiting } from "./start-fit.ts";
import { StoreContext } from "./store-context.ts";
import { markZoomable } from "./touch-style.ts";
import type { Edge, Node } from "./types.ts";
import { updateNodeInternalsOf } from "./update-node-internals.ts";
import { useDevWarnings } from "./use-dev-warnings.ts";
import {
  useContainerSize,
  useControlledProps,
  useFlowStart,
  useStoreBindings,
} from "./use-flow-sync.ts";
import { useGlobalKeys } from "./use-global-keys.ts";
import { useHeldViewport } from "./use-held-viewport.ts";
import { useReactFlow } from "./use-react-flow.ts";
import { useStoreApi } from "./use-store.ts";
import { initialMirror, mirrorUpdate } from "./view-mirror.ts";
import { ViewPropsContext, initialViewProps, useViewPropsStore } from "./view-props.ts";
import type { ViewProps } from "./view-props.ts";
import {
  notifyGestureHandlers,
  withoutViewportEvents,
  useViewportEvents,
} from "./viewport-events.ts";
import { ViewportLayer } from "./viewport-layer.tsx";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToColorScheme(onChange: () => void): () => void {
  if (typeof matchMedia === "undefined") {
    return noop;
  }
  const query = matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

function prefersDark(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia(DARK_QUERY).matches;
}

// `system` follows the operating system; light and dark are used as given.
function useColorModeClass(colorMode: ColorMode | undefined): string | undefined {
  const systemDark = useSyncExternalStore(subscribeToColorScheme, prefersDark, () => false);
  if (colorMode === "system") {
    return systemDark ? "dark" : "light";
  }
  return colorMode ?? "light";
}

// The id that tells this flow's handles and markers apart from another flow's: its `id`, if any.
function rfIdOf(props: ReactFlowProps): string {
  const { id } = props;
  return id === undefined || id === "" ? (props.rfId ?? "1") : id;
}

// Undoes the scrolling of the container (focusing a node out of view makes the browser scroll it),
// which would shift what is drawn, and then tells the owner's `onScroll`.
function undoScroll(
  onScroll: UIEventHandler<HTMLDivElement> | undefined,
): UIEventHandler<HTMLDivElement> {
  return (event) => {
    event.currentTarget.scrollTo({ top: 0, left: 0, behavior: "instant" });
    onScroll?.(event);
  };
}

/** Everything inside the flow's container, below the context of its React-level props. */
function FlowView({ flow }: { flow: ReactFlowProps }): ReactElement {
  const store = useStoreApi();
  const view = useViewPropsStore();
  const ref = useRef<HTMLDivElement>(null);
  const [portals] = useState(createPortalRegistry);
  const rendererRef = useCallback(
    (element: HTMLDivElement | null) => {
      portals.set("renderer", element);
      markZoomable(element);
    },
    [portals],
  );
  // As React Flow, which forwards the ref it is given to the element that wraps the flow.
  const given = flow.ref;
  const wrapperRef = useCallback(
    (element: HTMLDivElement) => {
      const releaseOwn = assignRef(ref, element);
      const releaseGiven = assignRef(given, element);
      return (): void => {
        releaseOwn();
        releaseGiven();
      };
    },
    [given],
  );
  const colorClass = useColorModeClass(flow.colorMode);
  const instance = useReactFlow();
  const { onInit, onSelectionChange } = flow;
  const initialized = instance.viewportInitialized;
  const announced = useRef(false);
  useViewportEvents(store, view);
  useStoreBindings(store, view, flow);
  useControlledProps(store, flow);
  useHeldViewport(store, flow.viewport);
  useFlowStart(store, flow);
  useContainerSize({ store, view, ref }, { width: flow.width, height: flow.height });
  useGlobalKeys(store, view);
  useDevWarnings(view, flow);
  // As in React Flow, `onInit` is told a moment after the canvas is there, in a timeout: by then the
  // nodes the flow starts with have been measured.
  useEffect(() => {
    if (initialized && !announced.current && onInit !== undefined) {
      announced.current = true;
      setTimeout(() => {
        onInit(instance);
      }, 1);
    }
  }, [initialized, instance, onInit]);
  return (
    <PortalRegistryContext.Provider value={portals}>
      <div
        {...htmlAttributesOf(flow)}
        onScroll={undoScroll(flow.onScroll)}
        ref={wrapperRef}
        className={cx("react-flow", flow.className, colorClass)}
        // As in React Flow the flow's own styles come last: the owner's do not undo them.
        style={{
          ...flow.style,
          width: "100%",
          height: "100%",
          overflow: "hidden",
          position: "relative",
          zIndex: 0,
        }}
        data-testid="rf__wrapper"
        role="application"
      >
        <div ref={rendererRef} className="react-flow__renderer" style={CONTAINER_STYLE}>
          <Pane>
            <ViewportLayer />
            <NodesSelection />
          </Pane>
        </div>
        {/* Before the children, as in React Flow: the selection is told before their effects run. */}
        <SelectionListener onChange={onSelectionChange} />
        {flow.children}
        <A11yDescriptions />
      </div>
    </PortalRegistryContext.Provider>
  );
}

// Holds the React-level props in a store of their own, for the components below to read from.
function FlowRoot({ flow }: { flow: ReactFlowProps }): ReactElement {
  const [view] = useState(() => createStore<ViewProps>(() => initialViewProps(flow)));
  const store = useStoreApi();
  // The pan and zoom are an object of the store, as React Flow has it, and so is the function that
  // measures nodes again.
  useLayoutEffect(() => {
    store.setState({
      panZoom: createPanZoom(store, view),
      updateNodeInternals: updateNodeInternalsOf(store),
      onViewportChangeStart: (viewport) => {
        notifyGestureHandlers(store, "start", viewport);
      },
      onViewportChangeEnd: (viewport) => {
        notifyGestureHandlers(store, "end", viewport);
      },
    });
    fitIfWaiting(store);
    return (): void => {
      // The flow goes away: as in React Flow, which resets its store then, a store that outlives it
      // (a provider around the flow) is left with the viewport a flow starts with.
      withoutViewportEvents(store, () => {
        // Put there directly: an owner who holds the viewport is not asked to move it.
        store.setState({
          viewport: { x: 0, y: 0, zoom: 1 },
          transform: [0, 0, 1],
          pendingViewport: undefined,
        });
      });
      store.setState({
        panZoom: null,
        updateNodeInternals: noop,
        onViewportChangeStart: undefined,
        onViewportChangeEnd: undefined,
      });
    };
  }, [store, view]);
  // The props are mirrored into the store, as React Flow keeps them there.
  useLayoutEffect(() => {
    const push = (): void => {
      store.setState(mirrorUpdate(view.getState()));
    };
    push();
    return view.subscribe(push);
  }, [store, view]);
  return (
    <ViewPropsContext.Provider value={view}>
      <FlowView flow={flow} />
    </ViewPropsContext.Provider>
  );
}

/**
 * The flow: a pannable, zoomable canvas of nodes connected by edges. Give it `nodes` and `edges`
 * (and `onNodesChange`/`onEdgesChange` to keep them in your own state), or `defaultNodes` and
 * `defaultEdges` to let it manage them itself.
 */
export function ReactFlow<TNode extends Node = Node, TEdge extends Edge = Edge>(
  props: ReactFlowProps<TNode, TEdge>,
): ReactElement;
export function ReactFlow(props: ReactFlowProps): ReactElement {
  // The `id` of the flow is what handles and markers are told apart by, as in React Flow.
  const flow = { ...props, rfId: rfIdOf(props) };
  const hasProvider = useContext(StoreContext) !== null;
  if (hasProvider) {
    return <FlowRoot flow={flow} />;
  }
  return (
    <ReactFlowProvider
      initialNodes={flow.nodes}
      initialEdges={flow.edges}
      defaultNodes={flow.defaultNodes}
      defaultEdges={flow.defaultEdges}
      initialWidth={flow.width}
      initialHeight={flow.height}
      fitView={flow.fitView}
      initialFitViewOptions={flow.fitViewOptions}
      initialMinZoom={flow.minZoom}
      initialMaxZoom={flow.maxZoom}
      nodeOrigin={flow.nodeOrigin}
      nodeExtent={flow.nodeExtent}
      zIndexMode={flow.zIndexMode}
      initialSettings={settingsOf(flow)}
      initialMirror={initialMirror(initialViewProps(flow))}
    >
      <FlowRoot flow={flow} />
    </ReactFlowProvider>
  );
}
