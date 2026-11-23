import { act, cleanup, render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { EdgeText } from "./edge-text.tsx";

// A page whose text comes out a little wider each time it is measured, as WebKit's can at a zoom.
function withDriftingText(run: () => void): number {
  let calls = 0;
  const proto =
    Reflect.getPrototypeOf(document.createElementNS("http://www.w3.org/2000/svg", "text")) ?? {};
  const previous = Object.getOwnPropertyDescriptor(proto, "getBBox");
  Object.defineProperty(proto, "getBBox", {
    configurable: true,
    value: (): { x: number; y: number; width: number; height: number } => {
      calls += 1;
      return { x: 0, y: 0, width: 40 + calls / 100, height: 12 };
    },
  });
  try {
    run();
  } finally {
    if (previous === undefined) {
      Reflect.deleteProperty(proto, "getBBox");
    } else {
      Object.defineProperty(proto, "getBBox", previous);
    }
  }
  return calls;
}

// As React Flow, which measures the label when it is drawn and when it changes.
describe("an edge label", () => {
  it("is measured once for a label, even where the page measures it a little differently each time", () => {
    cleanup();
    const calls = withDriftingText(() => {
      const { rerender } = render(
        <svg>
          <EdgeText x={10} y={10} label="hello" />
        </svg>,
      );
      act(() => {
        rerender(
          <svg>
            <EdgeText x={20} y={10} label="hello" />
          </svg>,
        );
      });
    });
    expect(calls).toBe(1);
  });

  it("is measured again when the label or its style changes", () => {
    cleanup();
    const calls = withDriftingText(() => {
      const { rerender } = render(
        <svg>
          <EdgeText x={10} y={10} label="hello" labelStyle={{ fontSize: 12 }} />
        </svg>,
      );
      act(() => {
        rerender(
          <svg>
            <EdgeText x={10} y={10} label="hello" labelStyle={{ fontSize: 12 }} />
          </svg>,
        );
      });
      act(() => {
        rerender(
          <svg>
            <EdgeText x={10} y={10} label="hello" labelStyle={{ fontSize: 20 }} />
          </svg>,
        );
      });
      act(() => {
        rerender(
          <svg>
            <EdgeText x={10} y={10} label="bye" labelStyle={{ fontSize: 20 }} />
          </svg>,
        );
      });
    });
    expect(calls).toBe(3);
  });
});
