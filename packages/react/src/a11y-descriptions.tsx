import type { ReactElement } from "react";

import { ARIA_EDGE_DESC_KEY } from "./edge-wrapper.tsx";
import { ARIA_NODE_DESC_KEY } from "./node-wrapper.tsx";
import { useStore } from "./use-store.ts";
import { useViewProps } from "./view-props.ts";

export const ARIA_LIVE_MESSAGE_KEY = "react-flow__aria-live";

const HIDDEN: Record<string, string | number> = { display: "none" };

// Visually hidden, but still read by screen readers.
const VISUALLY_HIDDEN: Record<string, string | number> = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  border: 0,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0px, 0px, 0px, 0px)",
  clipPath: "inset(100%)",
};

/**
 * Text that nodes and edges point at with `aria-describedby`, and the live region that announces
 * what the keyboard did. None of it is visible.
 */
export function A11yDescriptions(): ReactElement {
  const rfId = useViewProps((props) => props.rfId);
  const labels = useViewProps((props) => props.ariaLabels);
  const keyboardOff = useViewProps((props) => props.disableKeyboardA11y);
  const message = useStore((state) => state.ariaLiveMessage);
  return (
    <>
      <div id={`${ARIA_NODE_DESC_KEY}-${rfId}`} style={HIDDEN}>
        {keyboardOff
          ? labels["node.a11yDescription.default"]
          : labels["node.a11yDescription.keyboardDisabled"]}
      </div>
      <div id={`${ARIA_EDGE_DESC_KEY}-${rfId}`} style={HIDDEN}>
        {labels["edge.a11yDescription.default"]}
      </div>
      {keyboardOff ? null : (
        <div
          id={`${ARIA_LIVE_MESSAGE_KEY}-${rfId}`}
          aria-live="assertive"
          aria-atomic="true"
          style={VISUALLY_HIDDEN}
        >
          {message}
        </div>
      )}
    </>
  );
}
