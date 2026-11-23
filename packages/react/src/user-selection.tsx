import type { ReactElement } from "react";

import { useStore } from "./use-store.ts";

/** The rectangle drawn while the user drags out a selection box. */
export function UserSelection(): ReactElement | null {
  const rect = useStore((state) => (state.userSelectionActive ? state.userSelectionRect : null));
  if (rect === null) {
    return null;
  }
  return (
    <div
      className="react-flow__selection react-flow__container"
      style={{
        width: rect.width,
        height: rect.height,
        transform: `translate(${rect.x}px, ${rect.y}px)`,
      }}
    />
  );
}
