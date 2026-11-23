/** Joins the class names that are set, skipping `false`, `null` and `undefined`. */
export function cx(...names: readonly (string | false | null | undefined)[]): string {
  return names.filter((name) => typeof name === "string" && name !== "").join(" ");
}
