import { updateConnection } from "@graphweave/core";
import type { ClickConnectionStart } from "@graphweave/core";

import { clientToFlow } from "./coords.ts";
import type { ReactFlowStore } from "./store-context.ts";

// The page or shadow root the flow is drawn in, which React Flow asks for the element under the pointer
// (a flow inside a shadow root, open or closed, is otherwise only seen as its host).
function rootOf(store: ReactFlowStore): Document | ShadowRoot {
  const root = store.getState().domNode?.getRootNode();
  return root instanceof ShadowRoot ? root : document;
}

// The handle the page shows under the pointer, which counts before the nearest one (React Flow asks
// the page too, so a handle larger than the connection radius can be hit anywhere on it).
function handleUnder(
  store: ReactFlowStore,
  event: { clientX: number; clientY: number },
): ClickConnectionStart | undefined {
  const element = rootOf(store).elementFromPoint(event.clientX, event.clientY);
  if (!(element instanceof HTMLElement) || !element.classList.contains("react-flow__handle")) {
    return undefined;
  }
  const nodeId = element.dataset["nodeid"];
  const type = element.classList.contains("target") ? "target" : "source";
  return nodeId === undefined
    ? undefined
    : { nodeId, type, id: element.dataset["handleid"] ?? null };
}

/** Takes the connection in progress to where the pointer is. */
export function moveConnectionTo(
  store: ReactFlowStore,
  event: { clientX: number; clientY: number },
): void {
  const point = clientToFlow(store, { x: event.clientX, y: event.clientY });
  updateConnection(store, point, handleUnder(store, event));
}
