import type { CSSProperties } from "react";

interface MiniMapColours {
  bgColor: string | undefined;
  maskColor: string | undefined;
  maskStrokeColor: string | undefined;
  maskStrokeWidth: number | undefined;
  nodeColor?: unknown;
  nodeStrokeColor?: unknown;
  nodeStrokeWidth?: unknown;
}

/**
 * The custom properties the stylesheet reads for the colours given as props, as React Flow sets them
 * on the panel; the width of the mask stroke is in flow units, so it is scaled by the map's scale.
 */
export function miniMapStyle(
  style: CSSProperties | undefined,
  colours: MiniMapColours,
  viewScale: number,
): CSSProperties {
  const variables: Record<string, string | undefined> = {
    "--xy-minimap-background-color-props": colours.bgColor,
    "--xy-minimap-mask-background-color-props": colours.maskColor,
    "--xy-minimap-mask-stroke-color-props": colours.maskStrokeColor,
    "--xy-minimap-mask-stroke-width-props":
      colours.maskStrokeWidth === undefined ? undefined : `${colours.maskStrokeWidth * viewScale}`,
    "--xy-minimap-node-background-color-props":
      typeof colours.nodeColor === "string" ? colours.nodeColor : undefined,
    "--xy-minimap-node-stroke-color-props":
      typeof colours.nodeStrokeColor === "string" ? colours.nodeStrokeColor : undefined,
    "--xy-minimap-node-stroke-width-props":
      typeof colours.nodeStrokeWidth === "number" ? `${colours.nodeStrokeWidth}` : undefined,
  };
  return {
    ...style,
    ...Object.fromEntries(Object.entries(variables).filter(([, value]) => value !== undefined)),
  };
}
