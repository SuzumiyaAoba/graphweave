// The bundler of whoever uses the library replaces `process.env.NODE_ENV` as text (a browser has no
// `process`); where nothing does, reading it throws and there is no development mode to warn in.
declare const process: { env: { NODE_ENV?: string | undefined } };

/** Whether the app was built for development, as React Flow tells it. */
export function inDevelopment(): boolean {
  try {
    return process.env.NODE_ENV === "development";
  } catch {
    return false;
  }
}

/**
 * What a flow does with an error when no `onError` is given, as React Flow does: a warning in the
 * console of a development build, nothing otherwise.
 */
export function warnInDevelopment(id: string, message: string): void {
  if (inDevelopment()) {
    // oxlint-disable-next-line eslint/no-console -- the warning is the point, as in React Flow
    console.warn(`[GraphWeave]: ${message} (error ${id})`);
  }
}
