// @ts-check
/**
 * Compares two builds of one site (documentation/desktop/spec.md §6.4, plan stage 10): the owner's source
 * build and the same commit's engine-pack build. Pure: it's given each build's files and their bytes.
 *
 * The only parts allowed to differ:
 * - the sealer's random parts (documentation/access/spec.md §6.2): the build ID, each key's ID, the
 *   ciphertexts and the sealed media's names. They're normalised: a sealed region keeps its kind and its
 *   length, a sealed file its folder and its size, so the same plaintext still has to come out the same;
 * - `docs/`, which no engine release carries (the documentation is the engine's repository's own).
 *
 * What it reports never names a sealed file, nor a page with a sealed main region (a private page's path is
 * its token): those are counted, not listed.
 */

/** Folders only the source build has, by design. */
export const ALLOWED_ONLY_IN_SOURCE = ['docs/'];

const TEXT = /\.(html|js|mjs|css|json|xml|txt|svg|webmanifest|map|md)$/i;
const SEALED_DIR = /^(_sealed|_access)\/([^/]+)\//;

/** @param {string} path */
export const isSealedFile = (path) => SEALED_DIR.test(path);

/** The build ID of a build, from its sealed folders (one per build), or null. @param {string[]} paths */
export function buildIdOf(paths) {
  for (const p of paths) {
    const m = SEALED_DIR.exec(p);
    if (m) return m[2];
  }
  return null;
}

/**
 * A text file with the sealer's random parts replaced by their shape. Pure.
 * @param {string} text
 * @param {string | null} build
 */
export function normalise(text, build) {
  let t = build ? text.split(build).join('BUILD') : text;
  t = t.replace(/(<template data-sealed="(?:main|card)") data-kid="[^"]*">([^<]*)<\/template>/g, (_, open, body) => `${open} data-kid="KID">SEALED:${body.length}</template>`);
  t = t.replace(/(_sealed\/BUILD\/)[A-Za-z0-9_-]+(\.bin)/g, '$1MEDIA$2');
  return t;
}

/** Does this page carry a sealed main region (a private page, whose path mustn't be printed)? @param {string} text */
export const isPrivatePage = (text) => text.includes('data-sealed="main"');

/**
 * @typedef {{ path: string, bytes: () => Uint8Array }} BuildFile
 * @typedef {{
 *   same: number,
 *   differ: string[], onlyInSource: string[], onlyInEngine: string[],
 *   hiddenDiffer: number, hiddenOnly: number,
 *   allowed: Record<string, number>,
 *   sealed: { source: number, engine: number, same: boolean },
 *   ok: boolean,
 * }} ParityReport
 */

/**
 * Compares the two builds. Pure.
 * @param {BuildFile[]} source the source build's files (paths relative to dist/, with / separators)
 * @param {BuildFile[]} engine the engine-pack build's files
 * @returns {ParityReport}
 */
export function compareBuilds(source, engine) {
  const dec = new TextDecoder();
  const idA = buildIdOf(source.map((f) => f.path));
  const idB = buildIdOf(engine.map((f) => f.path));
  const a = new Map(source.filter((f) => !isSealedFile(f.path)).map((f) => [f.path, f]));
  const b = new Map(engine.filter((f) => !isSealedFile(f.path)).map((f) => [f.path, f]));
  /** @type {ParityReport} */
  const r = { same: 0, differ: [], onlyInSource: [], onlyInEngine: [], hiddenDiffer: 0, hiddenOnly: 0, allowed: {}, sealed: { source: 0, engine: 0, same: true }, ok: true };
  const text = (/** @type {BuildFile} */ f) => dec.decode(f.bytes());
  const hidden = (/** @type {BuildFile} */ f) => f.path.endsWith('.html') && isPrivatePage(text(f));

  for (const [path, fa] of a) {
    const fb = b.get(path);
    if (!fb) {
      const allowed = ALLOWED_ONLY_IN_SOURCE.find((p) => path.startsWith(p));
      if (allowed) r.allowed[allowed] = (r.allowed[allowed] ?? 0) + 1;
      else if (hidden(fa)) r.hiddenOnly++;
      else r.onlyInSource.push(path);
      continue;
    }
    let same;
    if (TEXT.test(path)) same = normalise(text(fa), idA) === normalise(text(fb), idB);
    else {
      const x = fa.bytes();
      const y = fb.bytes();
      same = x.length === y.length && x.every((v, i) => v === y[i]);
    }
    if (same) r.same++;
    else if (hidden(fa) || hidden(fb)) r.hiddenDiffer++;
    else r.differ.push(path);
  }
  for (const [path, fb] of b) {
    if (a.has(path)) continue;
    if (hidden(fb)) r.hiddenOnly++;
    else r.onlyInEngine.push(path);
  }

  // sealed files: by folder and size (their names and bytes are random)
  const shape = (/** @type {BuildFile[]} */ files) =>
    files
      .filter((f) => isSealedFile(f.path))
      .map((f) => `${f.path.split('/')[0]}:${f.bytes().length}`)
      .sort();
  const sa = shape(source);
  const sb = shape(engine);
  r.sealed = { source: sa.length, engine: sb.length, same: sa.join('\n') === sb.join('\n') };
  r.ok = !r.differ.length && !r.onlyInSource.length && !r.onlyInEngine.length && !r.hiddenDiffer && !r.hiddenOnly && r.sealed.same;
  return r;
}

/**
 * The report in words: counts, and the public paths that differ (at most `max` of each).
 * @param {ParityReport} r
 * @param {number} [max]
 */
export function describe(r, max = 20) {
  const list = (/** @type {string} */ what, /** @type {string[]} */ paths) => (paths.length ? [`${paths.length} ${what}:`, ...paths.slice(0, max).map((p) => `  ${p}`), ...(paths.length > max ? [`  … and ${paths.length - max} more`] : [])] : []);
  const allowed = Object.entries(r.allowed).map(([p, n]) => `${p} (${n} files)`);
  return [
    `${r.same} files the same`,
    ...list('files differ', r.differ),
    ...list('files only in the source build', r.onlyInSource),
    ...list('files only in the engine build', r.onlyInEngine),
    ...(r.hiddenDiffer ? [`${r.hiddenDiffer} private pages differ (not named)`] : []),
    ...(r.hiddenOnly ? [`${r.hiddenOnly} private pages are in one build only (not named)`] : []),
    `sealed files: ${r.sealed.source} and ${r.sealed.engine}${r.sealed.same ? ', the same shapes' : ', NOT the same shapes'}`,
    ...(allowed.length ? [`only in the source build, as expected: ${allowed.join(', ')}`] : []),
    r.ok ? `the same, but for ${Object.keys(r.allowed).join(', ') || 'nothing'}` : 'the builds DIFFER',
  ].join('\n');
}
