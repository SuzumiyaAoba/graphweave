import type { KeyCode } from "@free-flow/core";
import { useEffect, useMemo, useState } from "react";

import { isInputDOMNode } from "./dom-utils.ts";

export interface UseKeyPressOptions {
  /** Where to listen for key events; the document by default. */
  target?: Window | Document | HTMLElement | ShadowRoot | null | undefined;
  /** Shortcuts with a modifier (like `Meta+a`) still fire inside text inputs. On by default. */
  actInsideInputWithModifier?: boolean | undefined;
  /**
   * Whether the keydown that completes the shortcut is default-prevented. On by default, as in
   * React Flow, except for a key pressed on a button or a link without a modifier.
   */
  preventDefault?: boolean | undefined;
}

function isKeyboardEvent(event: Event): event is KeyboardEvent {
  return "key" in event;
}

function modifierDown(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
}

// A button or a link keeps its own use of the key (Space or Enter clicks it) unless a modifier is held.
function isInteractiveTarget(event: KeyboardEvent): boolean {
  const target = event.composedPath().at(0) ?? event.target;
  return target instanceof Element && (target.nodeName === "BUTTON" || target.nodeName === "A");
}

/** The keys of one way to press the shortcut: `a+d` is two keys held together, `a++` is `a` and `+`. */
type Combination = readonly string[];

// Split on `+`, as React Flow does: a lone `+` therefore names no key (it is read as a separator).
function combinationsOf(keyCode: unknown): Combination[] {
  const list: unknown[] = Array.isArray(keyCode) ? keyCode : [keyCode];
  return list
    .filter((code): code is string => typeof code === "string")
    .map((code) => code.replaceAll("+", "\n").replace("\n\n", "\n+").split("\n"));
}

// A shortcut is pressed when exactly its keys are held (a key more would be another shortcut), and
// let go of as soon as all its keys are down at a key release.
function isMatchingKey(
  combinations: readonly Combination[],
  pressed: ReadonlySet<string>,
  isUp: boolean,
): boolean {
  return combinations
    .filter((keys) => isUp || keys.length === pressed.size)
    .some((keys) => keys.every((key) => pressed.has(key)));
}

interface Listening {
  combinations: readonly Combination[];
  actInsideInputWithModifier: boolean;
  preventDefault: boolean;
}

interface KeyHandlers {
  down: (event: Event) => void;
  up: (event: Event) => void;
  reset: () => void;
}

// The keydown that completes a shortcut is default-prevented, except for a key on a button or a link.
function preventIfWanted(event: KeyboardEvent, config: Listening, modifier: boolean): void {
  if (config.preventDefault && (modifier || !isInteractiveTarget(event))) {
    event.preventDefault();
  }
}

// The handlers of React Flow's `useKeyPress`: which keys are held, and whether they make the shortcut.
function keyHandlers(config: Listening, setPressed: (pressed: boolean) => void): KeyHandlers {
  const held = new Set<string>();
  const watched = new Set(config.combinations.flat());
  // A shortcut may name a key by its `code` ("KeyA") or by what it types ("a"): the code is used when
  // the shortcut names it, and what the key types otherwise (so `A` with Shift held is not `a`).
  const nameOf = (event: KeyboardEvent): string =>
    watched.has(event.code) ? event.code : event.key;
  return {
    down: (event) => {
      if (!isKeyboardEvent(event)) {
        return;
      }
      const modifier = modifierDown(event);
      if ((!modifier || !config.actInsideInputWithModifier) && isInputDOMNode(event)) {
        return;
      }
      held.add(nameOf(event));
      if (isMatchingKey(config.combinations, held, false)) {
        preventIfWanted(event, config, modifier);
        setPressed(true);
      }
    },
    up: (event) => {
      if (!isKeyboardEvent(event)) {
        return;
      }
      if (isMatchingKey(config.combinations, held, true)) {
        setPressed(false);
        held.clear();
      } else {
        held.delete(nameOf(event));
      }
      // The browser does not send keyup for other keys while Meta is held, so let go of everything.
      if (event.key === "Meta") {
        held.clear();
      }
    },
    reset: () => {
      held.clear();
      setPressed(false);
    },
  };
}

/**
 * Listens on `element` and reports, through `setPressed`, whether the keys currently held satisfy
 * the shortcut. Losing the focus of the window or opening a context menu lets go of every key.
 * Returns the function that stops listening.
 */
function listenForKeys(
  element: EventTarget,
  config: Listening,
  setPressed: (pressed: boolean) => void,
): () => void {
  const handlers = keyHandlers(config, setPressed);
  element.addEventListener("keydown", handlers.down);
  element.addEventListener("keyup", handlers.up);
  globalThis.addEventListener("blur", handlers.reset);
  globalThis.addEventListener("contextmenu", handlers.reset);
  return () => {
    element.removeEventListener("keydown", handlers.down);
    element.removeEventListener("keyup", handlers.up);
    globalThis.removeEventListener("blur", handlers.reset);
    globalThis.removeEventListener("contextmenu", handlers.reset);
  };
}

// The combinations of a key code that was turned into JSON; `null` (no key code) has none.
function alternativesOf(serialized: string): Combination[] {
  const parsed: unknown = JSON.parse(serialized);
  return parsed === null ? [] : combinationsOf(parsed);
}

/**
 * Whether a key (or combination, or any of several alternatives) is currently held. Pass `null` to
 * listen for nothing.
 */
export function useKeyPress(
  keyCode: KeyCode | null = null,
  options: UseKeyPressOptions = {},
): boolean {
  const [pressed, setPressed] = useState(false);
  // The key code is compared by value, so an inline array does not re-subscribe on every render.
  const serialized = JSON.stringify(keyCode);
  const alternatives = useMemo(() => alternativesOf(serialized), [serialized]);
  const { target, preventDefault = true, actInsideInputWithModifier = true } = options;
  useEffect(
    () =>
      listenForKeys(
        target ?? document,
        { combinations: alternatives, actInsideInputWithModifier, preventDefault },
        setPressed,
      ),
    [alternatives, target, preventDefault, actInsideInputWithModifier],
  );
  return pressed;
}
