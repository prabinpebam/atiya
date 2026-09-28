/**
 * Models built ahead (progressive-loading.md §5.7): a summoned group's preparation builds its views'
 * models one per slice of a frame (`prebuildSteps`, run by the summoner's `runSliced`), and the views
 * read them as they mount (`prebuilt`), so mounting a group never builds all of them in one task. A
 * model that wasn't prepared is built when it's first asked for, as before. Only fixed models are kept
 * here (a key names one model, built one way), never ones that change with the game's state.
 */
const built = new Map<string, unknown>();

/** The model under `key`, built now if its group's preparation hasn't built it yet. */
export function prebuilt<T>(key: string, make: () => T): T {
  if (built.has(key)) return built.get(key) as T;
  const v = make();
  built.set(key, v);
  return v;
}

/** Builds each model not built yet, yielding after each (a resumable build for `runSliced`). */
export function* prebuildSteps(makers: ReadonlyArray<readonly [string, () => unknown]>): Generator<void, void> {
  for (const [key, make] of makers) {
    if (built.has(key)) continue;
    built.set(key, make());
    yield;
  }
}
