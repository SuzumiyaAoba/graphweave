import { getBoundsOfRects } from "@graphweave/core";
import type { Position, Rect } from "@graphweave/core";
import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";

import { cx } from "./class-names.ts";
import { usePortalTarget } from "./portal-targets.ts";
import { shallow } from "./shallow.ts";
import type { ReactFlowState } from "./store-context.ts";
import { toolbarTransform } from "./toolbar-position.ts";
import type { ToolbarAlign } from "./toolbar-position.ts";
import { useNodeId } from "./use-graph-hooks.ts";
import { useStore } from "./use-store.ts";

const DEFAULT_OFFSET = 10;

export interface NodeToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** The node (or nodes) to attach to; the node whose component renders the toolbar by default. */
  nodeId?: string | string[] | undefined;
  /** Show or hide it; by default it shows while its node is the only selected one. */
  isVisible?: boolean | undefined;
  position?: Position | undefined;
  offset?: number | undefined;
  align?: ToolbarAlign | undefined;
  children?: ReactNode;
}

interface ToolbarTarget {
  /** The ids, of those asked for, that are nodes of the flow. */
  found: string[];
  box: Rect | undefined;
  z: number;
  selectedHere: boolean;
  selectedTotal: number;
}

function targetOf(state: ReactFlowState, ids: readonly string[]): ToolbarTarget {
  const nodes = ids.flatMap((id) => {
    const node = state.nodeLookup.get(id);
    return node === undefined ? [] : [node];
  });
  const boxes = nodes.map((node) => ({
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width ?? node.width ?? 0,
    height: node.measured.height ?? node.height ?? 0,
  }));
  return {
    found: nodes.map((node) => node.id),
    box: boxes.length === 0 ? undefined : getBoundsOfRects(boxes),
    z: Math.max(0, ...nodes.map((node) => node.internals.z)) + 1,
    selectedHere: nodes.length > 0 && nodes.every((node) => node.selected === true),
    selectedTotal: [...state.nodeLookup.values()].filter((node) => node.selected === true).length,
  };
}

/**
 * A toolbar that floats next to a node and does not scale with the zoom. It shows while its node
 * is selected on its own (or whenever `isVisible` says so).
 */
export function NodeToolbar({
  nodeId,
  isVisible,
  position = "top",
  offset = DEFAULT_OFFSET,
  align = "center",
  children,
  className,
  style,
  ...rest
}: NodeToolbarProps): ReactElement | null {
  const contextId = useNodeId();
  const target = usePortalTarget("renderer");
  const ids =
    typeof nodeId === "string" ? [nodeId] : (nodeId ?? (contextId === null ? [] : [contextId]));
  const info = useStore((state) => targetOf(state, ids), shallow);
  const viewport = useStore((state) => state.viewport);
  const active = isVisible ?? (info.selectedHere && info.selectedTotal === 1);
  if (target === null || !active || info.box === undefined) {
    return null;
  }
  return createPortal(
    <div
      {...rest}
      className={cx("react-flow__node-toolbar", className)}
      style={{
        position: "absolute",
        transform: toolbarTransform(info.box, viewport, { position, offset, align }),
        zIndex: info.z,
        ...style,
      }}
      data-id={info.found.join(" ")}
    >
      {children}
    </div>,
    target,
  );
}
