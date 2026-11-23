import { act, cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { ReactFlowState } from "./store-context.ts";
import { useStore } from "./use-store.ts";

interface Seen {
  rfId: string;
  lib: string;
  noPanClassName: string;
  connectOnClick: boolean;
  hasDomNode: boolean;
  transform: readonly number[];
  onError: ReactFlowState["onError"];
  panZoom: ReactFlowState["panZoom"];
}

const seen: Seen[] = [];

function Probe(): ReactElement {
  const state = useStore((current) => current);
  seen.push({
    rfId: state.rfId,
    lib: state.lib,
    noPanClassName: state.noPanClassName,
    connectOnClick: state.connectOnClick,
    hasDomNode: state.domNode !== null,
    transform: state.transform,
    onError: state.onError,
    panZoom: state.panZoom,
  });
  return <span />;
}

async function show(props: ReactFlowProps): Promise<Seen> {
  cleanup();
  seen.length = 0;
  await act(async () => {
    render(
      <ReactFlow width={400} height={300} {...props}>
        <Probe />
      </ReactFlow>,
    );
    await Promise.resolve();
  });
  const last = seen.at(-1);
  if (last === undefined) {
    throw new Error("the probe did not render");
  }
  return last;
}

describe("the store of a flow, read the way React Flow's is", () => {
  it("has the props the React layer keeps, under the names React Flow's store gives them", async () => {
    const onError = vi.fn<NonNullable<ReactFlowProps["onError"]>>();
    const last = await show({ id: "mine", noPanClassName: "np", connectOnClick: false, onError });
    expect([last.rfId, last.lib, last.noPanClassName, last.connectOnClick]).toStrictEqual([
      "mine",
      "react",
      "np",
      false,
    ]);
    expect(last.onError).toBe(onError);
  });

  it("holds the element of the flow once it is shown, and the transform of the viewport", async () => {
    const last = await show({ defaultViewport: { x: 12, y: 34, zoom: 1.5 } });
    expect([last.hasDomNode, [...last.transform]]).toStrictEqual([true, [12, 34, 1.5]]);
  });

  // The zoom is about the centre of the 400 by 300 canvas: 200 - (200 - 7) * 2 and 150 - (150 - 8) * 2.
  it("has the pan and zoom as an object that moves the viewport", async () => {
    const last = await show({});
    await act(async () => {
      await last.panZoom?.setViewport({ x: 7, y: 8, zoom: 1 });
      await last.panZoom?.scaleTo(2);
    });
    expect(last.panZoom?.getViewport()).toStrictEqual({ x: -186, y: -134, zoom: 2 });
  });
});
