import { Position } from "@free-flow/core";
import { isValidElement } from "react";
import type { ComponentType, ReactElement, ReactNode } from "react";

import { Handle } from "./handle.tsx";
import type { NodeProps, NodeTypes } from "./types.ts";

// Labels are whatever React can render; anything else (an object, say) is left out.
function labelOf(data: Record<string, unknown>): ReactNode {
  const { label } = data;
  const renderable =
    typeof label === "string" ||
    typeof label === "number" ||
    Array.isArray(label) ||
    isValidElement(label);
  return renderable ? label : null;
}

/** The node without a type: a target handle above and a source handle below the label. */
export function DefaultNode({
  data,
  isConnectable,
  targetPosition = Position.Top,
  sourcePosition = Position.Bottom,
}: NodeProps): ReactElement {
  return (
    <>
      <Handle type="target" position={targetPosition} isConnectable={isConnectable} />
      {labelOf(data)}
      <Handle type="source" position={sourcePosition} isConnectable={isConnectable} />
    </>
  );
}

/** A node that edges only leave: the label with a source handle. */
export function InputNode({
  data,
  isConnectable,
  sourcePosition = Position.Bottom,
}: NodeProps): ReactElement {
  return (
    <>
      {labelOf(data)}
      <Handle type="source" position={sourcePosition} isConnectable={isConnectable} />
    </>
  );
}

/** A node that edges only arrive at: a target handle with the label. */
export function OutputNode({
  data,
  isConnectable,
  targetPosition = Position.Top,
}: NodeProps): ReactElement {
  return (
    <>
      <Handle type="target" position={targetPosition} isConnectable={isConnectable} />
      {labelOf(data)}
    </>
  );
}

/** A frame for other nodes; it has no content of its own. */
export function GroupNode(): null {
  return null;
}

export const BUILT_IN_NODE_TYPES: NodeTypes = {
  default: DefaultNode,
  input: InputNode,
  output: OutputNode,
  group: GroupNode,
};

/**
 * The component that renders a node of this type: the caller's, a built-in one, or the default.
 * Components are registered for the data of their own node type, which the renderer cannot know,
 * so they are all treated as taking the plain node props.
 */
export function resolveNodeComponent(types: NodeTypes, type: string): ComponentType<NodeProps> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
  return (types[type] ?? BUILT_IN_NODE_TYPES[type] ?? DefaultNode) as ComponentType<NodeProps>;
}

/**
 * The type a node is drawn as, with its component. As in React Flow, a type nobody registered is
 * drawn as `default` (and is reported by the caller), class name included.
 */
export function resolveNodeType(
  types: NodeTypes,
  type: string,
): { type: string; component: ComponentType<NodeProps>; known: boolean } {
  if ((types[type] ?? BUILT_IN_NODE_TYPES[type]) !== undefined) {
    return { type, component: resolveNodeComponent(types, type), known: true };
  }
  return { type: "default", component: resolveNodeComponent(types, "default"), known: false };
}
