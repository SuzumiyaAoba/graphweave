import { noop } from "./noop.ts";

/**
 * Starts work that returns a promise and does not need its result, making sure a failure is not
 * lost: `onFailure` hears of it. This is the one place a promise is deliberately left running.
 */
export function handled(promise: Promise<unknown>, onFailure: (failure: unknown) => void): void {
  // oxlint-disable-next-line promise/prefer-await-to-then, promise/prefer-catch, promise/catch-or-return, unicorn/catch-error-name -- see above
  promise.then(noop, (failure: unknown) => {
    onFailure(failure);
  });
}
