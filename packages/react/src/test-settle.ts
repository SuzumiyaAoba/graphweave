// Longer than the timeout React Flow tells `onInit` in.
const A_MOMENT = 5;

/**
 * Waits until a flow that has just been rendered has told `onInit`: as React Flow does, that is a
 * moment after the canvas is there, in a timeout.
 */
export async function flowSettled(): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new -- wraps the callback-based setTimeout
  await new Promise((resolve) => {
    setTimeout(resolve, A_MOMENT);
  });
}
