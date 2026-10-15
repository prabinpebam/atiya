// @ts-check
/** Plan stage 7C: who's signed in and which site is open, as the title bar's account menu shows them. */
import { describe, expect, it } from 'vitest';
import { parseRemote, shortAddress, siteAddress, sitesFor } from '../src/core/account.mjs';

describe('the account menu', () => {
  it("reads a checkout's GitHub repository from its remote, in either form", () => {
    expect(parseRemote('https://github.com/prabinpebam/atiya.git')).toEqual({ owner: 'prabinpebam', repo: 'atiya' });
    expect(parseRemote('https://github.com/prabinpebam/atiya')).toEqual({ owner: 'prabinpebam', repo: 'atiya' });
    expect(parseRemote('git@github.com:ada/ada.github.io.git\n')).toEqual({ owner: 'ada', repo: 'ada.github.io' });
    expect(parseRemote('https://gitlab.com/ada/site.git')).toBeNull();
    expect(parseRemote('E:/somewhere/remote.git')).toBeNull();
    expect(parseRemote(null)).toBeNull();
  });

  it("gives a repository's Pages address: the account's own site, or a project site", () => {
    expect(siteAddress('prabinpebam/atiya')).toBe('https://prabinpebam.github.io/atiya/');
    expect(siteAddress('Ada/ada.github.io')).toBe('https://ada.github.io/');
    expect(siteAddress('nonsense')).toBeNull();
    expect(shortAddress('https://prabinpebam.github.io/atiya/')).toBe('prabinpebam.github.io/atiya');
  });

  it('lists every remembered site, the open one first and marked, each with its address', () => {
    const sites = sitesFor(
      [
        { kind: 'managed', path: 'C:\\Users\\ada\\Atiya\\ada.github.io', name: 'Ada Lovelace', repository: 'ada/ada.github.io', url: 'https://ada.github.io/' },
        { kind: 'managed', path: 'C:\\Users\\ada\\Atiya\\notes', name: 'Ada’s notes', repository: 'ada/notes' },
        { kind: 'developer', path: 'E:\\Projects\\personal-site', name: 'Prabin Pebam', repository: 'prabinpebam/atiya' },
        { kind: 'developer', path: 'E:\\Projects\\scratch' },
      ],
      'c:\\users\\ada\\atiya\\notes',
    );
    expect(sites.map((s) => [s.name, s.address, s.current])).toEqual([
      ['Ada’s notes', 'ada.github.io/notes', true],
      ['Ada Lovelace', 'ada.github.io', false],
      ['Prabin Pebam', 'prabinpebam.github.io/atiya', false],
      ['scratch', 'Source checkout: scratch', false],
    ]);
    expect(sitesFor([], null)).toEqual([]);
  });
});
