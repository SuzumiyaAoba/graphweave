/** `T` with every property optional and allowed to be `undefined`, as React passes unset props. */
export type WithUndefined<TObject> = { [Key in keyof TObject]?: TObject[Key] | undefined };

/** `T` with every property optional and never `undefined`. */
export type Defined<TObject> = { [Key in keyof TObject]?: Exclude<TObject[Key], undefined> };

/**
 * A copy of `object` without the keys whose value is `undefined`. React passes every prop it was not
 * given as `undefined`, and those must not overwrite the defaults.
 */
export function withoutUndefined<TObject extends object>(object: TObject): Defined<TObject> {
  const result: Defined<TObject> = {};
  for (const key of Reflect.ownKeys(object)) {
    const value: unknown = Reflect.get(object, key);
    if (value !== undefined) {
      Reflect.set(result, key, value);
    }
  }
  return result;
}
