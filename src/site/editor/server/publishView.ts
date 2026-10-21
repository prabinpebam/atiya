import type { ChangeRow } from '../components/ChangeList.astro';
import { actionsUrl, groupChanges, suggestMessage, type Titles } from '../model/names';
import { pageOf, pageScope, privateNote as privateNoteFor } from '../model/selection';
import { summariseChange, type SummaryContext } from '../model/changeSummary';
import { readDoc } from './store';
import { load } from './screens';
import { changes, committedJson, git, remoteUrl, repo } from './git';

/** Builds the shared Save to remote view for the standalone screen and article dialog. */
export async function publishView(url: URL) {
  const loaded = load();
  const state = await changes();
  const committed = await committedJson(state.files.filter((file) => file.status !== 'added').map((file) => file.key));
  const read = new Map<string, unknown>();
  const now = (key: string): unknown => {
    if (read.has(key)) return read.get(key);
    let value: unknown;
    try {
      value = readDoc(key)?.value;
    } catch {
      value = undefined;
    }
    read.set(key, value);
    return value;
  };
  const field = (value: unknown, name: string) => (value && typeof value === 'object' ? ((value as Record<string, unknown>)[name] as string | undefined) : undefined);
  // a deleted page is named as it was last committed
  const titles: Titles = {
    article: (id) => {
      const keys = [`/content/articles/${id}.json`, `/private/articles/${id}.json`];
      return keys.map((key) => field(now(key), 'title')).find(Boolean) ?? keys.map((key) => field(committed.get(key), 'title')).find(Boolean);
    },
    person: (id) => field(now(`/content/people/${id}.json`), 'name') ?? field(committed.get(`/content/people/${id}.json`), 'name'),
  };
  const statusOf = new Map(state.files.map((file) => [file.key, file.status]));
  const context: SummaryContext = { status: (key) => statusOf.get(key), before: (key) => committed.get(key), after: now, titles };
  const rows: ChangeRow[] = groupChanges(state.files, titles).map((change) => {
    const id = change.resource.replace(/^\/(content|private)\/(articles|media|people)\//, '').replace(/\.json$/, '');
    const href =
      change.status === 'deleted' ? undefined
      : change.kind === 'Article' || change.kind === 'Private page' ? `articles/${id}/`
      : change.kind === 'Media' ? `media/?id=${id}`
      : change.kind === 'Sections' ? 'sections/'
      : change.kind === 'Access' || change.kind === 'Private places' ? 'access/'
      : change.kind === 'Settings' || change.kind === 'Person' ? 'settings/'
      : undefined;
    const summary = summariseChange(change, context) ?? undefined;
    return { ...change, href, summary, private: change.resource.startsWith('/private/') };
  });
  // private commits the public repository doesn't record yet (a private save whose public commit didn't
  // happen): saving links them, so it counts as a change, but there's no file here to discard
  if (state.pointer?.moved && !state.files.some((file) => file.key.startsWith('/private/'))) {
    rows.push({ resource: 'private-pages', kind: 'Private pages', name: 'Saved privately, not yet linked from the site', status: 'changed', keys: [] });
  }
  const blocked = state.error
    ? `${state.error}. Close this and open it again to check again.`
    : !(await repo())
    ? "content/ isn't in a git repository, so there's nowhere to save it."
    : !state.branch
      ? "git isn't on a branch (a detached HEAD): check out a branch, then save to remote."
      : !state.upstream
        ? `The branch ${state.branch} has no upstream to push to: set one (git push -u), then publish.`
        : !loaded.ok
          ? 'The content has problems (listed below): fix them, then save to remote.'
          : null;
  // the head comes with the status (no git of its own); the result's commit is its short form
  const head = state.head ?? (await git(['rev-parse', 'HEAD'])).stdout.trim();
  const asked = url.searchParams.get('published') ?? (url.searchParams.get('pushed') ? head.slice(0, 7) : null);
  const ahead = state.ahead + (state.private?.ahead ?? 0);
  const published = asked && /^[0-9a-f]{4,}$/.test(asked) && head.startsWith(asked) && ahead === 0 ? asked : null;
  const privateNote = privateNoteFor(state.files.map((file) => file.key));
  const remote = await remoteUrl(state.upstream);

  // opened from a page's editor: that page's changes are the ones ticked to begin with
  const pageId = pageOf(url.pathname);
  return {
    branch: state.branch,
    issues: loaded.ok ? [] : loaded.issues,
    changeList: {
      changes: rows,
      ahead,
      blocked,
      message: suggestMessage(state.files, titles),
      privateNote,
      actions: remote ? actionsUrl(remote) : null,
      published,
      scope: pageId ? pageScope(rows.map((row) => row.resource), pageId) : undefined,
    },
  };
}
