import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { useKeyPress } from "./use-key-press.ts";
import type { UseKeyPressOptions } from "./use-key-press.ts";

// The rules of React Flow's `useKeyPress`, as measured against the real hook in a browser.
function shortcut(keyCode: string | string[] | null, options?: UseKeyPressOptions): () => boolean {
  const { result } = renderHook(() => useKeyPress(keyCode, options));
  return () => result.current;
}

// Presses a key; resolves to whether the keydown was left alone (not default-prevented).
function press(init: KeyboardEventInit, target: Document | Element = document): boolean {
  let left = true;
  act(() => {
    left = fireEvent.keyDown(target, init);
  });
  return left;
}

function release(init: KeyboardEventInit): void {
  act(() => {
    fireEvent.keyUp(document, init);
  });
}

describe("which keys make a shortcut", () => {
  it("are exactly its keys: another key held at the same time makes it another shortcut", () => {
    cleanup();
    const isPressed = shortcut("a");
    press({ key: "Alt", code: "AltLeft", altKey: true });
    press({ key: "a", code: "KeyA", altKey: true });
    expect(isPressed()).toBe(false);
  });

  it("are told apart by case: `A` with Shift held is not `a`, but its code names it", () => {
    cleanup();
    const byKey = shortcut("Shift+a");
    const byCode = shortcut("Shift+KeyA");
    press({ key: "Shift", code: "ShiftLeft", shiftKey: true });
    press({ key: "A", code: "KeyA", shiftKey: true });
    expect(byKey()).toBe(false);
    expect(byCode()).toBe(true);
  });

  it("read `+` as the separator, so a lone `+` names no key and `a++` is `a` with `+`", () => {
    cleanup();
    const lone = shortcut("+");
    const both = shortcut("a++");
    press({ key: "a", code: "KeyA" });
    press({ key: "+", code: "Equal" });
    expect(lone()).toBe(false);
    expect(both()).toBe(true);
  });

  it("can be any of several alternatives, a combination among them", () => {
    cleanup();
    const isPressed = shortcut(["b", "c+d"]);
    press({ key: "c", code: "KeyC" });
    expect(isPressed()).toBe(false);
    press({ key: "d", code: "KeyD" });
    expect(isPressed()).toBe(true);
  });
});

describe("what lets go of a shortcut", () => {
  it("is the release of a key", () => {
    cleanup();
    const isPressed = shortcut("a");
    press({ key: "a", code: "KeyA" });
    expect(isPressed()).toBe(true);
    release({ key: "a", code: "KeyA" });
    expect(isPressed()).toBe(false);
  });

  it("is the window losing the focus, or a context menu opening", () => {
    cleanup();
    const isPressed = shortcut("a");
    press({ key: "a", code: "KeyA" });
    act(() => {
      globalThis.dispatchEvent(new Event("blur"));
    });
    expect(isPressed()).toBe(false);
    press({ key: "a", code: "KeyA" });
    act(() => {
      globalThis.dispatchEvent(new Event("contextmenu"));
    });
    expect(isPressed()).toBe(false);
  });
});

describe("the default action of the keydown that completes a shortcut", () => {
  it("is prevented, unless the hook is told not to", () => {
    cleanup();
    shortcut("a");
    expect(press({ key: "a", code: "KeyA" })).toBe(false);
    release({ key: "a", code: "KeyA" });
  });

  it("is left alone with preventDefault off", () => {
    cleanup();
    shortcut("a", { preventDefault: false });
    expect(press({ key: "a", code: "KeyA" })).toBe(true);
    release({ key: "a", code: "KeyA" });
  });

  it("is left alone on a button, unless a modifier is held", () => {
    cleanup();
    shortcut("a");
    const button = document.createElement("button");
    document.body.append(button);
    expect(press({ key: "a", code: "KeyA", bubbles: true }, button)).toBe(true);
    release({ key: "a", code: "KeyA" });
    expect(press({ key: "a", code: "KeyA", ctrlKey: true, bubbles: true }, button)).toBe(false);
    button.remove();
  });
});

describe("a key typed into a field inside a shadow root", () => {
  it("is left to the field, as React Flow reads the first element of the event's path", () => {
    cleanup();
    const isPressed = shortcut("Backspace");
    const host = document.createElement("div");
    document.body.append(host);
    const field = document.createElement("input");
    host.attachShadow({ mode: "open" }).append(field);
    act(() => {
      field.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Backspace",
          code: "Backspace",
          bubbles: true,
          composed: true,
        }),
      );
    });
    host.remove();
    expect(isPressed()).toBe(false);
  });
});

describe("a key pressed on an SVG element inside a .nokey", () => {
  it("is left to it, as React Flow takes any element", () => {
    cleanup();
    const isPressed = shortcut("Backspace");
    const wrapper = document.createElement("div");
    wrapper.className = "nokey";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    wrapper.append(svg);
    document.body.append(wrapper);
    press({ key: "Backspace", code: "Backspace" }, svg);
    wrapper.remove();
    expect(isPressed()).toBe(false);
  });
});
