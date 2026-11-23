import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode, SVGAttributes } from "react";

import { cx } from "./class-names.ts";

const DEFAULT_PADDING_Y = 2;
const DEFAULT_PADDING_X = 4;
const DEFAULT_BACKGROUND_PADDING: [number, number] = [DEFAULT_PADDING_Y, DEFAULT_PADDING_X];
const DEFAULT_BACKGROUND_RADIUS = 2;
const HALF = 0.5;

export interface EdgeTextProps extends Omit<SVGAttributes<SVGElement>, "x" | "y"> {
  x: number;
  y: number;
  label?: ReactNode;
  labelStyle?: CSSProperties | undefined;
  labelShowBg?: boolean | undefined;
  labelBgStyle?: CSSProperties | undefined;
  labelBgPadding?: [number, number] | undefined;
  labelBgBorderRadius?: number | undefined;
  children?: ReactNode;
}

/** Whether there is a label to show: React Flow leaves out an empty one, and a 0 or a `false`. */
export function hasLabel(label: ReactNode): boolean {
  return label !== undefined && label !== null && label !== false && label !== "" && label !== 0;
}

interface Box {
  width: number;
  height: number;
}

/** A label centred on a point of an edge, with an optional background rectangle. */
export function EdgeText({
  x,
  y,
  label,
  labelStyle,
  labelShowBg = true,
  labelBgStyle,
  labelBgPadding = DEFAULT_BACKGROUND_PADDING,
  labelBgBorderRadius = DEFAULT_BACKGROUND_RADIUS,
  children,
  className,
  ...rest
}: EdgeTextProps): ReactElement | null {
  const [box, setBox] = useState<Box>({ width: 0, height: 0 });
  const textRef = useRef<SVGTextElement>(null);
  // The style as a value, so that an equal style given as a new object does not measure again.
  const styleKey = JSON.stringify(labelStyle ?? null);
  // Measured after the label is drawn and again when it or its style changes, not after every render
  // (which could go on for ever where the size comes out a little different each time). React Flow
  // measures again only for a new label, so a new font size kept the old background there.
  useEffect(() => {
    const text = textRef.current;
    const styled = styleKey.length > 0;
    if (styled && hasLabel(label) && text !== null && typeof text.getBBox === "function") {
      const measured = text.getBBox();
      setBox((current) =>
        current.width === measured.width && current.height === measured.height
          ? current
          : { width: measured.width, height: measured.height },
      );
    }
  }, [label, styleKey]);
  if (!hasLabel(label)) {
    return null;
  }
  const [paddingX, paddingY] = labelBgPadding;
  return (
    <g
      transform={`translate(${x - box.width * HALF} ${y - box.height * HALF})`}
      className={cx("react-flow__edge-textwrapper", className)}
      visibility={box.width > 0 ? "visible" : "hidden"}
      {...rest}
    >
      {labelShowBg ? (
        <rect
          width={box.width + 2 * paddingX}
          x={-paddingX}
          y={-paddingY}
          height={box.height + 2 * paddingY}
          className="react-flow__edge-textbg"
          style={labelBgStyle}
          rx={labelBgBorderRadius}
          ry={labelBgBorderRadius}
        />
      ) : null}
      <text
        className="react-flow__edge-text"
        y={box.height * HALF}
        dy="0.3em"
        ref={textRef}
        style={labelStyle}
      >
        {label}
      </text>
      {children}
    </g>
  );
}
