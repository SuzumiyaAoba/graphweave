import { act, cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vite-plus/test";

import type { MiniMapNodeProps } from "./minimap-node.tsx";
import { MiniMap } from "./minimap.tsx";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
];

function Dot({ x, y, width, height, color }: MiniMapNodeProps): ReactElement {
  return (
    <circle
      className="dot"
      cx={x + width / 2}
      cy={y + height / 2}
      r={Math.min(width, height) / 2}
      fill={color}
    />
  );
}

async function show(map: ReactElement): Promise<void> {
  cleanup();
  await act(async () => {
    render(
      <ReactFlow width={800} height={600} defaultNodes={NODES}>
        {map}
      </ReactFlow>,
    );
    await Promise.resolve();
  });
}

function dots(): Element[] {
  return [...document.querySelectorAll(".dot")];
}

describe("MiniMap with a node component of its own", () => {
  it("draws every node with it, giving it the geometry and the colour", async () => {
    await show(<MiniMap nodeComponent={Dot} nodeColor="#7c3aed" />);
    const found = dots().map((dot) => [
      dot.getAttribute("cx"),
      dot.getAttribute("cy"),
      dot.getAttribute("r"),
      dot.getAttribute("fill"),
    ]);
    expect(found).toStrictEqual([
      ["50", "20", "20", "#7c3aed"],
      ["250", "120", "20", "#7c3aed"],
    ]);
  });

  it("still draws the nodes when it is given a property it does not know, such as an id", async () => {
    const unknown = { id: "second-map" };
    await show(<MiniMap {...unknown} nodeComponent={Dot} />);
    expect(dots()).toHaveLength(2);
  });
});
