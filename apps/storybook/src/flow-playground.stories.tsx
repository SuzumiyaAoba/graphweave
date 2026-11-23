import type { Meta, StoryObj } from "@storybook/react-vite";

import { FlowPlayground } from "./flow-playground.tsx";

const meta = {
  title: "Core/Playground",
  component: FlowPlayground,
  args: { nodeCount: 2000, index: "grid", cellSize: 224, showGrid: false },
  argTypes: {
    nodeCount: { control: { type: "range", min: 100, max: 200_000, step: 100 } },
    index: { control: "inline-radio", options: ["grid", "brute-force"] },
    cellSize: { control: { type: "range", min: 32, max: 1024, step: 32 } },
    showGrid: { control: "boolean" },
  },
} satisfies Meta<typeof FlowPlayground>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Pan, zoom and drag nodes around. Every visible node comes from a rectangle query on the index. */
export const Overview: Story = {};

/** The uniform grid made visible: each node is registered in the cells it touches. */
export const GridCells: Story = { args: { nodeCount: 400, showGrid: true } };

/** 100,000 nodes answered by the grid; the query stays cheap while only a window is visible. */
export const ManyNodesGrid: Story = { args: { nodeCount: 100_000, index: "grid" } };

/** The same 100,000 nodes with the linear-scan oracle: compare the query time with the grid. */
export const ManyNodesBruteForce: Story = { args: { nodeCount: 100_000, index: "brute-force" } };
