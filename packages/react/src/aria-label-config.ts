/** The texts read out by screen readers and shown as labels. Override any of them. */
export interface AriaLabelConfig {
  "node.a11yDescription.default": string;
  "node.a11yDescription.keyboardDisabled": string;
  "node.a11yDescription.ariaLiveMessage": (params: {
    direction: string;
    x: number;
    y: number;
  }) => string;
  "edge.a11yDescription.default": string;
  "controls.ariaLabel": string;
  "controls.zoomIn.ariaLabel": string;
  "controls.zoomOut.ariaLabel": string;
  "controls.fitView.ariaLabel": string;
  "controls.interactive.ariaLabel": string;
  "minimap.ariaLabel": string;
  "handle.ariaLabel": string;
}

export const DEFAULT_ARIA_LABEL_CONFIG: AriaLabelConfig = {
  "node.a11yDescription.default":
    "Press enter or space to select a node. Press delete to remove it and escape to cancel.",
  "node.a11yDescription.keyboardDisabled":
    "Press enter or space to select a node. You can then use the arrow keys to move the node around. Press delete to remove it and escape to cancel.",
  "node.a11yDescription.ariaLiveMessage": ({ direction, x, y }) =>
    `Moved selected node ${direction}. New position, x: ${x}, y: ${y}`,
  "edge.a11yDescription.default":
    "Press enter or space to select an edge. You can then press delete to remove it or escape to cancel.",
  "controls.ariaLabel": "Control Panel",
  "controls.zoomIn.ariaLabel": "Zoom In",
  "controls.zoomOut.ariaLabel": "Zoom Out",
  "controls.fitView.ariaLabel": "Fit View",
  "controls.interactive.ariaLabel": "Toggle Interactivity",
  "minimap.ariaLabel": "Mini Map",
  "handle.ariaLabel": "Handle",
};

/** The defaults with the caller's overrides applied. */
export function resolveAriaLabels(
  overrides: Partial<AriaLabelConfig> | undefined,
): AriaLabelConfig {
  return { ...DEFAULT_ARIA_LABEL_CONFIG, ...overrides };
}
