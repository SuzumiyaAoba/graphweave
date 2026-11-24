import { Position } from "@graphweave/core";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { Handle } from "./handle.tsx";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";

async function show(props: ReactFlowProps): Promise<void> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} {...props} />);
    await Promise.resolve();
  });
}

function query(selector: string): Element {
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return element;
}

const ON_CLICK = vi.fn<() => void>();

function ClickableHandle(): ReactElement {
  return <Handle type="source" position={Position.Right} onClick={ON_CLICK} />;
}

const CUSTOM_NODE: Node = {
  id: "a",
  position: { x: 0, y: 0 },
  data: {},
  width: 100,
  height: 40,
  type: "custom",
};

describe("a handle's own onClick", () => {
  it("is called instead of the click that makes connections", async () => {
    const onClickConnectStart = vi.fn<NonNullable<ReactFlowProps["onClickConnectStart"]>>();
    await show({
      onClickConnectStart,
      nodeTypes: { custom: ClickableHandle },
      defaultNodes: [CUSTOM_NODE],
    });
    act(() => {
      fireEvent.click(query(".react-flow__handle"));
    });
    expect(ON_CLICK).toHaveBeenCalledOnce();
    expect(onClickConnectStart).not.toHaveBeenCalled();
  });
});
