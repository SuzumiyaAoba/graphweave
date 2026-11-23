// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ReactFlowProvider } from "./react-flow-provider.tsx";
import { ReactFlow } from "./react-flow.tsx";
import type { Edge, Node } from "./types.ts";

// Nothing can be measured on the server, so the nodes say how big they are and where their handles
// are.
const NODES: Node[] = [
  {
    id: "a",
    position: { x: 0, y: 0 },
    data: { label: "Alpha" },
    width: 100,
    height: 40,
    handles: [{ type: "source", position: "bottom", x: 46, y: 36, width: 8, height: 8 }],
  },
  {
    id: "b",
    position: { x: 200, y: 100 },
    data: { label: "Beta" },
    width: 100,
    height: 40,
    handles: [{ type: "target", position: "top", x: 46, y: -4, width: 8, height: 8 }],
  },
];

const EDGES: Edge[] = [{ id: "e", source: "a", target: "b" }];

function markupOf(fit: boolean): string {
  return renderToString(
    <ReactFlowProvider
      initialNodes={NODES}
      initialEdges={EDGES}
      initialWidth={800}
      initialHeight={600}
      fitView={fit}
    >
      <ReactFlow nodes={NODES} edges={EDGES} width={800} height={600} />
    </ReactFlowProvider>,
  );
}

describe("rendering on the server", () => {
  it("renders the nodes without a DOM", () => {
    const markup = markupOf(false);
    expect(markup).toContain('data-id="a"');
    expect(markup).toContain("Alpha");
    expect(markup).toContain("Beta");
  });

  it("draws the edge from the handles the nodes describe", () => {
    // From the middle of a's bottom handle, (50, 44), to the middle of b's top handle, (250, 96).
    expect(markupOf(false)).toContain('d="M50,44 C50,70 250,70 250,96"');
  });

  it("frames the nodes of a bare <ReactFlow fitView> as well", () => {
    const markup = renderToString(
      <ReactFlow nodes={NODES} edges={EDGES} width={800} height={600} fitView />,
    );
    expect(markup).not.toContain("translate(0px, 0px) scale(1)");
  });

  it("frames the nodes in the markup when fitView is asked for", () => {
    expect(markupOf(true)).not.toContain("translate(0px, 0px) scale(1)");
  });
});
