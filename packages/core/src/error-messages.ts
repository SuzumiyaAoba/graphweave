/**
 * The messages `onError` is given, by the code it is given with, worded as React Flow's are. The
 * codes 100 and up are GraphWeave's own.
 */
export const errorMessages = {
  error002: (): string =>
    "It looks like you've created a new nodeTypes or edgeTypes object. If this wasn't on purpose please define the nodeTypes/edgeTypes outside of the component or memoize them.",
  error003: (nodeType: string): string =>
    `Node type "${nodeType}" not found. Using fallback type "default".`,
  error004: (): string => "The parent container needs a width and a height to render the graph.",
  error005: (): string => "Only child nodes can use a parent extent.",
  error006: (): string => "Can't create edge. An edge needs a source and a target.",
  error007: (id: string): string => `The old edge with id=${id} does not exist.`,
  error008: (
    handleType: "source" | "target",
    edge: {
      id: string;
      sourceHandle?: string | null | undefined;
      targetHandle?: string | null | undefined;
    },
  ): string =>
    `Couldn't create edge for ${handleType} handle id: "${handleType === "source" ? edge.sourceHandle : edge.targetHandle}", edge id: ${edge.id}.`,
  error009: (type: string): string => `Marker type "${type}" doesn't exist.`,
  error010: (): string =>
    "Handle: No node id found. Make sure to only use a Handle inside a custom Node.",
  error011: (edgeType: string): string =>
    `Edge type "${edgeType}" not found. Using fallback type "default".`,
  error012: (id: string): string =>
    `Node with id "${id}" does not exist, it may have been removed. This can happen when a node is deleted before the "onNodeClick" handler is called.`,
  error013: (): string =>
    "It seems that you haven't loaded the styles. Please import '@graphweave/react/style.css' to make sure everything is working properly.",
  error014: (): string =>
    "useNodeConnections: No node ID found. Call useNodeConnections inside a custom Node or provide a node ID.",
  error015: (): string =>
    "It seems that you are trying to drag a node that is not initialized. Please use onNodesChange as explained in the docs.",
} as const;

/** What a flow tells about a problem it recovered from: a code and a message. */
export type OnError = (code: string, message: string) => void;
