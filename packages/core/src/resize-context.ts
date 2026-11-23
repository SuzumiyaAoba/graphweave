import type { CoordinateExtent } from "./types.ts";

export type Extent = CoordinateExtent;

/** Which sides a control moves. */
export interface ControlDirection {
  isHorizontal: boolean;
  isVertical: boolean;
  affectsX: boolean;
  affectsY: boolean;
}

export interface Boundaries {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

/** The node as the resize begins: `x` and `y` are where its origin is. */
export interface ResizeStart {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeOptions {
  boundaries: Boundaries;
  keepAspectRatio: boolean;
  nodeOrigin: readonly [number, number];
  /** The area the node has to stay inside. */
  extent?: Extent | undefined;
  /** The box that the node's children need. */
  childExtent?: Extent | undefined;
}

export interface Pair {
  x: number;
  y: number;
}

export function lowerClamp(lowerExtent: number, lowerBound: number): number {
  return Math.max(0, lowerBound - lowerExtent);
}

export function upperClamp(upperExtent: number, upperBound: number): number {
  return Math.max(0, upperExtent - upperBound);
}

export function sizeClamp(size: number, minSize: number, maxSize: number): number {
  return Math.max(0, minSize - size, size - maxSize);
}

export function xor(left: boolean, right: boolean): boolean {
  return left ? !right : right;
}

// Everything the restrictions look at.
export interface Context {
  start: ResizeStart;
  aspectRatio: number;
  direction: ControlDirection;
  /** How far the pointer went, in whole units. */
  dist: Pair;
  /** The size the resize asks for, before any restriction. */
  size: { width: number; height: number };
  /** Where the top left corner is, relative to the origin. */
  originOffset: Pair;
  options: ResizeOptions;
}
