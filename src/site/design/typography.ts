/**
 * Print typography for plain strings (tier 0): straight quotes and apostrophes become curly ones, as
 * a typesetter would set them. For copy that comes from code (doc comments, data), not for code
 * samples. Pure; unit-tested.
 */
export function smart(s: string): string {
  return (
    s
      // apostrophes inside words and after digits: don't, it's, 90's
      .replace(/(\w)'(\w)/g, '$1\u2019$2')
      // opening quotes: at the start, or after a space, a bracket or a dash
      .replace(/(^|[\s([{\u2014\u2013-])'/g, '$1\u2018')
      .replace(/(^|[\s([{\u2014\u2013-])"/g, '$1\u201C')
      // the rest close
      .replace(/'/g, '\u2019')
      .replace(/"/g, '\u201D')
  );
}
