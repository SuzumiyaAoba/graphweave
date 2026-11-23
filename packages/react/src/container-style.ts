import type { CSSProperties } from "react";

/** Fills the box of the flow; what React Flow gives the layers that have no class of their own. */
export const CONTAINER_STYLE: CSSProperties = {
  position: "absolute",
  width: "100%",
  height: "100%",
  top: 0,
  left: 0,
};
