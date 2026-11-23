import type { ButtonHTMLAttributes, ReactElement } from "react";

import { cx } from "./class-names.ts";

export type ControlButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** A button for the `Controls` panel, styled like the built-in ones. */
export function ControlButton({ children, className, ...rest }: ControlButtonProps): ReactElement {
  return (
    <button type="button" {...rest} className={cx("react-flow__controls-button", className)}>
      {children}
    </button>
  );
}
