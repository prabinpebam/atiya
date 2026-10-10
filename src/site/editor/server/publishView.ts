import type { Article, Person } from '../../content/schema';
import type { ChangeRow } from '../components/ChangeList.astro';
import { actionsUrl, groupChanges, suggestMessage, type Titles } from '../model/names';
import { readDoc } from './store';
import { load } from './screens';
import { changes, git, remoteUrl, repo } from './git';

/** Builds the shared Save to remote view for the standalone screen and article dialog. */
export async function publishView(url: URL) {
  const loaded = load();
  const state = await changes();
  const titles: Titles = {
    article: (id) => (readDoc<Article>(`/content/articles/${id}.json`) ?? readDoc<Article>(`/private/articles/${id}.json`))?.value.title,
    person: (id) => readDoc<Person>(`/content/people/${id}.json`)?.value.name,
  };
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
    return { ...change, href };
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
  const currentHead = (await git(['rev-parse', '--short', 'HEAD'])).stdout.trim();
  const asked = url.searchParams.get('published') ?? (url.searchParams.get('pushed') ? currentHead : null);
  const ahead = state.ahead + (state.private?.ahead ?? 0);
  const published = asked && asked === currentHead && ahead === 0 ? currentHead : null;
  const anyPrivate = state.files.some((file) => file.key.startsWith('/private/'));
  const privateNote = anyPrivate
    ? state.files.some((file) => file.key.startsWith('/content/'))
      ? 'Private pages changed too: this message goes on the private commit only. The public commit gets one made from the public changes.'
      : 'Only private pages changed: this message goes on the private commit only. The public commit is "Private pages: update".'
    : null;
  const remote = await remoteUrl(state.upstream);
  const changed = new Set(state.files.map((file) => file.key));
  const drafts = loaded.ok
    ? loaded.index.routes.flatMap((route) => {
        if (route.published || route.node.kind !== 'item') return [];
        const article = loaded.index.articles.get(route.node.item.id);
        if (!article) return [];
        const key = `/${route.access === 'private' ? 'private' : 'content'}/articles/${article.id}.json`;
        return [{
          id: article.id,
          title: article.title,
          access: route.access === 'private' ? ('private' as const) : ('open' as const),
          checked: route.access === 'private' && changed.has(key),
        }];
      })
    : [];

  return {
    branch: state.branch,
    issues: loaded.ok ? [] : loaded.issues,
    changeList: {
      changes: rows,
      ahead,
      blocked,
      message: suggestMessage(state.files, titles) || (drafts.length ? 'Publish pages' : ''),
      privateNote,
      actions: remote ? actionsUrl(remote) : null,
      published,
      drafts,
    },
  };
}
