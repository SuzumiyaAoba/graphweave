import { createContext, useContext, useSyncExternalStore } from "react";

import { noop } from "./noop.ts";

/** The elements that the portals of a flow render into. They exist once the flow has mounted. */
export interface PortalTargets {
  /** Inside the viewport layer, behind the nodes: edge labels and edge toolbars. */
  edgeLabels: HTMLElement | null;
  /** Inside the viewport layer, in front of everything: `ViewportPortal`. */
  viewportPortal: HTMLElement | null;
  /** The renderer, outside the viewport layer: toolbars that must not scale with the zoom. */
  renderer: HTMLElement | null;
}

export type PortalTargetName = keyof PortalTargets;

type Listener = () => void;

/** A tiny store of the portal targets; React reads it with `useSyncExternalStore`. */
export interface PortalRegistry {
  get: (name: PortalTargetName) => HTMLElement | null;
  set: (name: PortalTargetName, element: HTMLElement | null) => void;
  subscribe: (listener: Listener) => () => void;
}

export function createPortalRegistry(): PortalRegistry {
  const targets: PortalTargets = { edgeLabels: null, viewportPortal: null, renderer: null };
  const listeners = new Set<Listener>();
  return {
    get: (name) => targets[name],
    set: (name, element) => {
      if (targets[name] !== element) {
        targets[name] = element;
        // A snapshot, because a listener may unsubscribe while being notified.
        // oxlint-disable-next-line unicorn/no-useless-spread
        for (const listener of [...listeners]) {
          listener();
        }
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const PortalRegistryContext = createContext<PortalRegistry | null>(null);

/** The element a portal renders into, or `null` until the flow has mounted it. */
export function usePortalTarget(name: PortalTargetName): HTMLElement | null {
  const registry = useContext(PortalRegistryContext);
  return useSyncExternalStore(
    (listener) => registry?.subscribe(listener) ?? noop,
    () => registry?.get(name) ?? null,
    () => null,
  );
}
