import type { HTMLAttributes, ReactElement, ReactNode, Ref } from "react";

import { cx } from "./class-names.ts";
import type { PanelPosition } from "./types.ts";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Where on the canvas the panel sits. Top left by default. */
  position?: PanelPosition | undefined;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement> | undefined;
}

/** A fixed-position box over the canvas, for controls, legends and the like. */
export function Panel({
  position = "top-left",
  children,
  className,
  style,
  ref,
  ...rest
}: PanelProps): ReactElement {
  return (
    <div
      {...rest}
      ref={ref}
      className={cx("react-flow__panel", className, ...position.split("-"))}
      style={style}
    >
      {children}
    </div>
  );
}
