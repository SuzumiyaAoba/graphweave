import type { CSSProperties, ReactElement } from "react";

import { cx } from "./class-names.ts";
import { CONTAINER_STYLE } from "./container-style.ts";
import { useStore } from "./use-store.ts";
import { useViewProps } from "./view-props.ts";

export const BackgroundVariant = {
  Lines: "lines",
  Dots: "dots",
  Cross: "cross",
} as const;
export type BackgroundVariant = (typeof BackgroundVariant)[keyof typeof BackgroundVariant];

const DEFAULT_GAP = 20;
const DEFAULT_LINE_WIDTH = 1;
const HALF = 0.5;

// The size of a mark when none is given: a dot or a line is 1 across, a cross arm 6.
const DEFAULT_SIZES: Readonly<Record<BackgroundVariant, number>> = {
  [BackgroundVariant.Dots]: 1,
  [BackgroundVariant.Lines]: 1,
  [BackgroundVariant.Cross]: 6,
};

export interface BackgroundProps {
  /** Tells several backgrounds on one flow apart. */
  id?: string | undefined;
  variant?: BackgroundVariant | undefined;
  /** Distance between the marks, in flow units; a pair gives the horizontal and vertical gap. */
  gap?: number | [number, number] | undefined;
  /** Size of a dot (its diameter) or of a cross (its arm length). */
  size?: number | undefined;
  lineWidth?: number | undefined;
  /** Shifts the pattern, in flow units. */
  offset?: number | [number, number] | undefined;
  color?: string | undefined;
  bgColor?: string | undefined;
  className?: string | undefined;
  patternClassName?: string | undefined;
  style?: CSSProperties | undefined;
}

function pair(value: number | [number, number]): [number, number] {
  return Array.isArray(value) ? value : [value, value];
}

interface PatternProps {
  variant: BackgroundVariant;
  /** The cell the lines are drawn in (the gap, or the size of a cross). */
  dimensions: [number, number];
  /** The diameter of a dot, in pixels. */
  size: number;
  lineWidth: number;
  className: string | undefined;
}

// One mark of the pattern, as React Flow draws it: a dot at the corner of its own box, or lines that
// cross in the middle of the cell.
function Mark({ variant, dimensions, size, lineWidth, className }: PatternProps): ReactElement {
  if (variant === BackgroundVariant.Dots) {
    const radius = size * HALF;
    return (
      <circle
        cx={radius}
        cy={radius}
        r={radius}
        className={cx("react-flow__background-pattern", "dots", className)}
      />
    );
  }
  const [width, height] = dimensions;
  return (
    <path
      strokeWidth={lineWidth}
      d={`M${width * HALF} 0 V${height} M0 ${height * HALF} H${width}`}
      className={cx("react-flow__background-pattern", variant, className)}
    />
  );
}

// The custom properties the stylesheet reads for the colours that were passed as props.
function colourVariables(color: string | undefined, bgColor: string | undefined): CSSProperties {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- custom properties are valid in a style
  return {
    "--xy-background-color-props": bgColor,
    "--xy-background-pattern-color-props": color,
  } as CSSProperties;
}

/** A pattern of dots, lines or crosses behind the nodes that pans and zooms with them. */
export function Background({
  id,
  variant = BackgroundVariant.Dots,
  gap = DEFAULT_GAP,
  size,
  lineWidth = DEFAULT_LINE_WIDTH,
  offset = 0,
  color,
  bgColor,
  className,
  patternClassName,
  style,
}: BackgroundProps): ReactElement {
  const rfId = useViewProps((props) => props.rfId);
  const { x, y, zoom } = useStore((state) => state.viewport);
  const [gapX, gapY] = pair(gap);
  const [offsetX, offsetY] = pair(offset);
  const scaledGap: [number, number] = [gapX * zoom || 1, gapY * zoom || 1];
  // A size of 0 is no size at all, as in React Flow.
  const scaledSize = (size === undefined || size === 0 ? DEFAULT_SIZES[variant] : size) * zoom;
  const dimensions: [number, number] =
    variant === BackgroundVariant.Cross ? [scaledSize, scaledSize] : scaledGap;
  // The marks sit in the middle of their cell, so the pattern is shifted back by half of it.
  const shiftX = offsetX * zoom + dimensions[0] * HALF;
  const shiftY = offsetY * zoom + dimensions[1] * HALF;
  const patternId = `pattern-${rfId}${id ?? ""}`;
  return (
    <svg
      className={cx("react-flow__background", className)}
      style={{ ...style, ...CONTAINER_STYLE, ...colourVariables(color, bgColor) }}
      data-testid="rf__background"
    >
      <pattern
        id={patternId}
        x={x % scaledGap[0]}
        y={y % scaledGap[1]}
        width={scaledGap[0]}
        height={scaledGap[1]}
        patternUnits="userSpaceOnUse"
        patternTransform={`translate(-${shiftX},-${shiftY})`}
      >
        <Mark
          variant={variant}
          dimensions={dimensions}
          size={scaledSize}
          lineWidth={lineWidth}
          className={patternClassName}
        />
      </pattern>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
