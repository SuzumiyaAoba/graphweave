import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vite-plus/test";

import { ReactFlow } from "./react-flow.tsx";

// As React Flow, whose <ReactFlow> forwards its ref to the element that wraps the flow.
describe("a ref given to the flow", () => {
  it("is the element that wraps the flow", async () => {
    cleanup();
    const ref = createRef<HTMLDivElement>();
    await act(async () => {
      render(<ReactFlow ref={ref} width={400} height={300} />);
      await Promise.resolve();
    });
    expect(ref.current?.classList.contains("react-flow")).toBe(true);
  });

  it("lets go of the element when the flow goes away, running the cleanup a callback ref returned", async () => {
    cleanup();
    const ref = createRef<HTMLDivElement>();
    const seen: string[] = [];
    const callback = (element: HTMLDivElement | null): (() => void) => {
      seen.push(`given ${String(element !== null)}`);
      return () => {
        seen.push("cleanup");
      };
    };
    const { unmount } = render(
      <>
        <ReactFlow ref={ref} width={400} height={300} />
        <ReactFlow ref={callback} width={400} height={300} />
      </>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      unmount();
    });
    expect([ref.current, seen]).toStrictEqual([null, ["given true", "cleanup"]]);
  });
});
