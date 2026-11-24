import "@graphweave/react/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  reconnectEdge,
  useEdgesState,
  useNodesState,
} from "@graphweave/react";
import type { Connection, Edge, Node } from "@graphweave/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useCallback } from "react";
import type { ReactElement } from "react";

const INITIAL_NODES: Node[] = [
  { id: "1", type: "input", position: { x: 250, y: 0 }, data: { label: "Input" } },
  { id: "2", position: { x: 100, y: 120 }, data: { label: "Default A" } },
  { id: "3", position: { x: 400, y: 120 }, data: { label: "Default B" } },
  { id: "4", type: "output", position: { x: 250, y: 260 }, data: { label: "Output" } },
];

const INITIAL_EDGES: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e1-3", source: "1", target: "3", label: "label" },
  { id: "e2-4", source: "2", target: "4", type: "smoothstep" },
  { id: "e3-4", source: "3", target: "4", type: "step" },
];

const FULL_SCREEN = { width: "100vw", height: "100vh" } as const;

interface BasicFlowProps {
  variant: BackgroundVariant;
  minimap: boolean;
  nodeCount: number;
}

// A grid of nodes, chained left to right and wrapped every `COLUMNS`.
const COLUMNS = 40;
const SPACING_X = 200;
const SPACING_Y = 100;

function gridNodes(count: number): Node[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `n${index}`,
    position: { x: (index % COLUMNS) * SPACING_X, y: Math.floor(index / COLUMNS) * SPACING_Y },
    data: { label: `Node ${index}` },
  }));
}

function gridEdges(count: number): Edge[] {
  return Array.from({ length: Math.max(0, count - 1) }, (_unused, index) => ({
    id: `e${index}`,
    source: `n${index}`,
    target: `n${index + 1}`,
  }));
}

function BasicFlow({ variant, minimap, nodeCount }: BasicFlowProps): ReactElement {
  const [nodes, , onNodesChange] = useNodesState(
    nodeCount === 0 ? INITIAL_NODES : gridNodes(nodeCount),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    nodeCount === 0 ? INITIAL_EDGES : gridEdges(nodeCount),
  );
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => addEdge<Edge>(connection, current));
    },
    [setEdges],
  );
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((current) => reconnectEdge(oldEdge, newConnection, current));
    },
    [setEdges],
  );
  return (
    <div style={FULL_SCREEN}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        fitView
        onlyRenderVisibleElements={nodeCount >= 1000}
      >
        <Background variant={variant} />
        <Controls />
        {minimap ? <MiniMap pannable zoomable /> : null}
      </ReactFlow>
    </div>
  );
}

const meta = {
  title: "React/ReactFlow",
  component: BasicFlow,
  args: { variant: BackgroundVariant.Dots, minimap: true, nodeCount: 0 },
  argTypes: {
    variant: { control: "inline-radio", options: Object.values(BackgroundVariant) },
    minimap: { control: "boolean" },
    nodeCount: { control: { type: "range", min: 0, max: 5000, step: 100 } },
  },
} satisfies Meta<typeof BasicFlow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Drag nodes, pan and zoom, draw connections between handles, select with Shift+drag. */
export const Basic: Story = {};

/** The same flow with a line grid behind it. */
export const LineBackground: Story = { args: { variant: BackgroundVariant.Lines } };

/** A thousand nodes in a chain; only the ones on screen are rendered. */
export const ThousandNodes: Story = { args: { nodeCount: 1000 } };
