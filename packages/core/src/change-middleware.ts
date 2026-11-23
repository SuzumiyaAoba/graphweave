/** Sees the changes before they are applied or reported, and returns the changes to use instead. */
export type ChangeMiddleware<TChange> = (changes: TChange[]) => TChange[];

/**
 * The middleware of one kind of change, in the order they were added. Each registration has a key
 * of its own, as React Flow's store has it, so that one function registered twice runs twice.
 */
export type MiddlewareMap<TChange> = Map<symbol, ChangeMiddleware<TChange>>;
