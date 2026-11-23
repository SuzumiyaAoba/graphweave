import { describe, expect, it } from "vite-plus/test";

import type { Rect } from "./geometry.ts";
import { DEFAULT_RESIZE_CONSTRAINTS, directionOf, resizeRect } from "./node-resize.ts";
import type { ControlPosition, ResizeConstraints } from "./node-resize.ts";

const START = { x: 100, y: 100, width: 200, height: 100 };

function constraints(extra: Partial<ResizeConstraints> = {}): ResizeConstraints {
  return { ...DEFAULT_RESIZE_CONSTRAINTS, ...extra };
}

function resized(
  position: ControlPosition,
  delta: { x: number; y: number },
  extra: Partial<ResizeConstraints> = {},
): Rect {
  return resizeRect(START, {
    direction: directionOf(position),
    delta,
    constraints: constraints(extra),
  });
}

describe("directionOf", () => {
  it("maps each control to the edges it moves", () => {
    expect(directionOf("top-left")).toStrictEqual({ horizontal: -1, vertical: -1 });
    expect(directionOf("right")).toStrictEqual({ horizontal: 1, vertical: 0 });
    expect(directionOf("bottom")).toStrictEqual({ horizontal: 0, vertical: 1 });
  });
});

describe("resizeRect", () => {
  it("grows from the far edges and keeps the origin", () => {
    expect(resized("right", { x: 30, y: 99 })).toStrictEqual({
      x: 100,
      y: 100,
      width: 230,
      height: 100,
    });
    expect(resized("bottom", { x: 99, y: -20 })).toStrictEqual({
      x: 100,
      y: 100,
      width: 200,
      height: 80,
    });
    expect(resized("bottom-right", { x: 10, y: 20 })).toStrictEqual({
      x: 100,
      y: 100,
      width: 210,
      height: 120,
    });
  });

  it("moves the origin when a near edge is dragged, keeping the far edge fixed", () => {
    expect(resized("left", { x: -40, y: 0 })).toStrictEqual({
      x: 60,
      y: 100,
      width: 240,
      height: 100,
    });
    expect(resized("top", { x: 0, y: 30 })).toStrictEqual({
      x: 100,
      y: 130,
      width: 200,
      height: 70,
    });
    expect(resized("top-left", { x: 20, y: 10 })).toStrictEqual({
      x: 120,
      y: 110,
      width: 180,
      height: 90,
    });
  });

  it("stops at the minimum size without letting the far edge drift", () => {
    expect(resized("right", { x: -500, y: 0 }, { minWidth: 50 })).toStrictEqual({
      x: 100,
      y: 100,
      width: 50,
      height: 100,
    });
    expect(resized("left", { x: 500, y: 0 }, { minWidth: 50 })).toStrictEqual({
      x: 250,
      y: 100,
      width: 50,
      height: 100,
    });
  });

  it("stops at the maximum size", () => {
    expect(
      resized("bottom-right", { x: 900, y: 900 }, { maxWidth: 300, maxHeight: 150 }),
    ).toStrictEqual({
      x: 100,
      y: 100,
      width: 300,
      height: 150,
    });
    expect(
      resized("top-left", { x: -900, y: -900 }, { maxWidth: 300, maxHeight: 150 }),
    ).toStrictEqual({
      x: 0,
      y: 50,
      width: 300,
      height: 150,
    });
  });

  it("stays inside an area", () => {
    const area = { x: 50, y: 50, width: 400, height: 200 };
    expect(resized("bottom-right", { x: 900, y: 900 }, { area })).toStrictEqual({
      x: 100,
      y: 100,
      width: 350,
      height: 150,
    });
    expect(resized("top-left", { x: -900, y: -900 }, { area })).toStrictEqual({
      x: 50,
      y: 50,
      width: 250,
      height: 150,
    });
  });

  it("keeps the aspect ratio, following the axis that was dragged further", () => {
    const keep = { keepAspectRatio: true };
    expect(resized("bottom-right", { x: 100, y: 0 }, keep)).toStrictEqual({
      x: 100,
      y: 100,
      width: 300,
      height: 150,
    });
    expect(resized("bottom-right", { x: 0, y: 100 }, keep)).toStrictEqual({
      x: 100,
      y: 100,
      width: 400,
      height: 200,
    });
    expect(resized("top-left", { x: -100, y: 0 }, keep)).toStrictEqual({
      x: 0,
      y: 50,
      width: 300,
      height: 150,
    });
  });

  it("scales the other axis too when only one edge is dragged with the ratio kept", () => {
    expect(resized("right", { x: 100, y: 0 }, { keepAspectRatio: true })).toStrictEqual({
      x: 100,
      y: 100,
      width: 300,
      height: 150,
    });
    expect(resized("bottom", { x: 0, y: 50 }, { keepAspectRatio: true })).toStrictEqual({
      x: 100,
      y: 100,
      width: 300,
      height: 150,
    });
  });

  it("applies the limits to the ratio as a whole", () => {
    expect(
      resized("bottom-right", { x: 900, y: 900 }, { keepAspectRatio: true, maxWidth: 400 }),
    ).toStrictEqual({
      x: 100,
      y: 100,
      width: 400,
      height: 200,
    });
    expect(
      resized("bottom-right", { x: -900, y: -900 }, { keepAspectRatio: true, minHeight: 50 }),
    ).toStrictEqual({
      x: 100,
      y: 100,
      width: 100,
      height: 50,
    });
  });
});
