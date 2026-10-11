/**
 * The Tests screen (documentation/editor/test-runs.md §6), drawn from the live stream. The DOM is updated in
 * place by key, so focus, scroll and what's open survive every update; every clock ticks four times a second
 * between the server's half-second updates (counted from the server's own time), and the "last signal" line
 * turns red when the screen has heard nothing for 2 s.
 */
import { VERDICT_WORDS, areaOf, clock, roughly, type StepState, type TestState, type TestStatus } from '../model/testRun';
import type { RunBrief, RunView } from '../server/testRuns';

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
const STALE_MS = 2000;
const OPEN_KEY = 'editor.tests.open';

type Mark = 'passed' | 'failed' | 'flaky' | 'running' | 'queued' | 'skipped';
const MARK: Record<TestStatus, Mark> = { passed: 'passed', failed: 'failed', timedOut: 'failed', interrupted: 'failed', flaky: 'flaky', running: 'running', retrying: 'running', queued: 'queued', skipped: 'skipped' };
const WORD: Record<TestStatus, string> = { passed: 'Passed', failed: 'Failed', timedOut: 'Timed out', interrupted: 'Stopped', flaky: 'Flaky', running: 'Running', retrying: 'Retrying', queued: 'Not run yet', skipped: 'Skipped' };
const BY: Record<string, string> = { agent: 'an agent', owner: 'you', script: 'a script' };
const at = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

interface Node {
  key: string;
  kind: 'area' | 'group' | 'test';
  li: HTMLLIElement;
  children?: HTMLUListElement;
  testId?: string;
  parent?: Node;
  status?: string;
  detail?: HTMLElement;
}

export function initTestRuns(root: HTMLElement, signal: AbortSignal): void {
  const $ = <T extends HTMLElement = HTMLElement>(k: string) => root.querySelector<T>(`[data-t="${k}"]`)!;
  const clone = (attr: string) => (root.querySelector<HTMLTemplateElement>(`template[${attr}]`)!.content.firstElementChild!.cloneNode(true) as HTMLElement);
  const markOf = (m: Mark) => clone(`data-mark="${m}"`);
  const want = new URLSearchParams(location.search).get('run') ?? root.dataset.run ?? 'current';
  const tree = $<HTMLUListElement>('tree');
  const open = new Set<string>(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]'));
  const saveOpen = () => localStorage.setItem(OPEN_KEY, JSON.stringify([...open].slice(-400)));
  const nodes = new Map<string, Node>();
  const details = new Map<string, TestState>();
  // tests that following opened (and so may close again); one you open stays open
  const autoOpened = new Set<string>();
  let runId = '';
  let view: RunView | null = null;
  let offset = 0;
  let heard = 0;
  let follow = true;
  let filter = 'all';
  let followed = '';
  let lastHealth = '';
  let lastFailures = new Set<string>();
  const serverNow = () => Date.now() + offset;

  // ---------- the stream ----------
  const source = new EventSource(`${BASE}/_edit/api/tests/stream?run=${encodeURIComponent(want)}`);
  source.addEventListener('view', (e) => {
    const d = JSON.parse((e as MessageEvent).data) as { asOf: number; runs: RunBrief[]; view: RunView | null };
    offset = d.asOf - Date.now();
    heard = Date.now();
    render(d.view, d.runs);
  });
  source.addEventListener('problem', (e) => {
    $('reason').textContent = `The screen couldn't read the run: ${JSON.parse((e as MessageEvent).data).message}`;
  });
  signal.addEventListener('abort', () => source.close());

  // ---------- the clocks ----------
  const ticker = setInterval(() => {
    const quiet = Date.now() - heard;
    const fresh = $('fresh');
    if (!heard) fresh.textContent = source.readyState === EventSource.CLOSED ? "Can't reach the dev server." : 'Connecting to the dev server…';
    else if (quiet > STALE_MS) {
      fresh.dataset.stale = 'true';
      fresh.textContent = `This screen hasn't heard from the dev server for ${clock(quiet)}: what's shown is from then. Reconnecting…`;
    } else if (view) {
      fresh.dataset.stale = 'false';
      const beat = view.beat ? serverNow() - view.beat : undefined;
      fresh.textContent = `Updated just now · the run's last signal ${beat === undefined ? 'not yet' : `${clock(beat)} ago`}${view.cpu !== undefined ? ` · the machine is ${view.cpu < 10 ? 'idle' : 'busy'} (${view.cpu}% CPU)` : ''}`;
    }
    for (const el of root.querySelectorAll<HTMLElement>('[data-from]')) {
      const took = clock(serverNow() - Number(el.dataset.from));
      el.textContent = el.dataset.limit ? `${took} of ${clock(Number(el.dataset.limit))}` : took;
    }
  }, 250);
  signal.addEventListener('abort', () => clearInterval(ticker));

  // ---------- one update ----------
  function render(v: RunView | null, runs: RunBrief[]) {
    renderRuns(runs, v?.id);
    if (!v) {
      $('label').textContent = 'No runs yet';
      $('reason').textContent = 'Runs show here as soon as they start: npm run e2e, or node scripts/test-run.mjs --by owner --purpose "…" -- <playwright arguments>.';
      return;
    }
    if (v.id !== runId) {
      runId = v.id;
      tree.replaceChildren();
      nodes.clear();
      details.clear();
      lastFailures = new Set();
    }
    view = v;
    const c = v.counts;
    root.dataset.health = v.health.state;
    $('label').textContent = v.health.label;
    $('counts').textContent = c.total ? `${c.done} of ${c.total} done` : '';
    const fresh = v.failures.filter((f) => f.verdict === 'new').length;
    $('failed').textContent = c.failed ? `${c.failed} failed${fresh ? ` (${fresh} new)` : ''}` : c.flaky ? `${c.flaky} flaky` : '';
    $('left').textContent = v.active && v.left !== undefined ? `${roughly(v.left)} left` : '';
    $('reason').textContent = v.active || !v.summary ? v.health.reason : `${v.health.reason === v.summary ? '' : `${v.health.reason} `}${v.summary}`;
    renderNow(v);
    renderWho(v);
    renderPhases(v);
    renderBar(v);
    const overlap = $('overlap');
    overlap.hidden = !v.overlapping.length;
    overlap.textContent = v.overlapping.length ? `Also running: ${v.overlapping.map((o) => `${o.purpose || o.id} (${o.branch || 'this tree'})`).join('; ')}. Runs at once slow each other down, and long tests may time out.` : '';
    renderFailures(v);
    renderTree(v);
    $('output').textContent = v.output.join('\n');
    $('empty').hidden = !!v.state?.order.length;
    document.title = v.active && c.total ? `(${c.done}/${c.total}) Tests · Edit mode` : 'Tests · Edit mode';
    announce(v);
  }

  function renderNow(v: RunView) {
    const el = $('now');
    el.hidden = !v.now;
    if (!v.now) return;
    const n = v.now;
    const step = n.steps[n.steps.length - 1];
    el.replaceChildren();
    const text = (s: string) => el.append(document.createTextNode(s));
    const timer = (from: number, limit?: number) => {
      const t = document.createElement('strong');
      t.dataset.from = String(from);
      if (limit) t.dataset.limit = String(limit);
      el.append(t);
    };
    text(`Now: ${n.area} › ${n.path.join(' › ')} · `);
    if (step) {
      text(`${step.title}${step.count > 1 ? ` (${step.count} tries)` : ''} for `);
      timer(step.start);
      text(' · the test ');
    } else text('the test ');
    timer(n.start ?? serverNow(), n.timeout || undefined);
    text(n.usual ? ` · it usually takes ${clock(n.usual)}` : n.timeout ? '' : '');
  }

  function renderWho(v: RunView) {
    const i = v.info;
    const servers = i.servers?.filter((s) => s.reused) ?? [];
    const parts = [
      `Started by ${BY[i.by] ?? 'someone, not through the launcher'} at ${at(i.startedAt)}`,
      i.purpose && `“${i.purpose}”`,
      `${v.worktree.main ? 'the stable tree' : `the ${v.worktree.branch || 'other'} worktree`}${i.commit ? ` @ ${i.commit}` : ''}${i.dirty ? ' (with uncommitted changes)' : ''}`,
      servers.length ? `reusing a test server already on port ${servers.map((s) => s.port).join(' and ')}, which may be an older build` : i.launcher ? 'its own test servers' : '',
      "your site on localhost:4321 isn't touched",
    ];
    $('who').textContent = parts.filter(Boolean).join(' · ');
  }

  function renderPhases(v: RunView) {
    const now = serverNow();
    const end = v.exit?.at ?? (v.phase === 'done' ? v.state?.updatedAt : undefined);
    const phase = v.phase === 'done' || v.exit ? 'done' : v.phase === 'tests' ? 'tests' : 'preparing';
    const order = ['preparing', 'tests', 'done'];
    for (const li of root.querySelectorAll<HTMLElement>('.phases li')) {
      const p = li.dataset.phase!;
      li.dataset.state = order.indexOf(p) < order.indexOf(phase) ? 'done' : p === phase ? 'current' : 'later';
    }
    const prep = $('ph-preparing');
    const tests = $('ph-tests');
    const done = $('ph-done');
    const startedAt = v.info.startedAt;
    if (v.testsFrom) {
      delete prep.dataset.from;
      prep.textContent = clock(v.testsFrom - startedAt);
    } else if (phase === 'preparing') prep.dataset.from = String(startedAt);
    if (v.testsFrom && !end) tests.dataset.from = String(v.testsFrom);
    else {
      delete tests.dataset.from;
      tests.textContent = v.testsFrom && end ? clock(end - v.testsFrom) : '';
    }
    done.textContent = end ? `at ${at(end)}` : '';
    void now;
  }

  function renderBar(v: RunView) {
    const c = v.counts;
    const n: Record<string, number> = { passed: c.passed + c.skipped, flaky: c.flaky, failed: c.failed, running: c.running, queued: c.queued };
    for (const seg of root.querySelectorAll<HTMLElement>('.seg')) seg.style.setProperty('--n', String(n[seg.dataset.seg!] ?? 0));
    $('bar').setAttribute('aria-label', c.total ? `${c.passed} passed, ${c.failed} failed, ${c.flaky} flaky, ${c.running} running, ${c.queued} not run yet, of ${c.total}` : 'No tests yet');
  }

  function renderFailures(v: RunView) {
    const box = $('failures');
    const list = $('fail-list');
    box.hidden = !v.failures.length;
    list.replaceChildren(
      ...v.failures.map((f) => {
        const li = clone('data-fail');
        li.querySelector('.mark-slot')!.append(markOf(f.verdict === 'flaky' ? 'flaky' : 'failed'));
        const a = li.querySelector<HTMLAnchorElement>('.fail-link')!;
        a.textContent = `${f.area} › ${f.path.join(' › ')}`;
        a.href = `#t:${f.id}`;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          follow = false;
          syncFollow();
          reveal(`t:${f.id}`, true);
        });
        li.querySelector('.fail-verdict')!.textContent = VERDICT_WORDS[f.verdict];
        li.querySelector('.fail-message')!.textContent = f.message ?? '';
        return li;
      }),
    );
  }

  function renderRuns(runs: RunBrief[], current?: string) {
    const list = $('runs');
    list.replaceChildren(
      ...runs.map((r) => {
        const li = clone('data-run-item');
        const a = li.querySelector<HTMLAnchorElement>('.run-link')!;
        a.textContent = `${at(r.startedAt)} · ${r.purpose || `run ${r.id}`}`;
        a.href = `?run=${encodeURIComponent(r.id)}`;
        if (r.id === current) a.setAttribute('aria-current', 'true');
        li.querySelector('.run-meta')!.textContent = `${r.health.label} · ${r.counts.done} of ${r.counts.total}${r.counts.failed ? ` · ${r.counts.failed} failed` : ''} · ${r.main ? 'stable tree' : r.branch || 'worktree'} · by ${BY[r.by] ?? 'unknown'}`;
        return li;
      }),
    );
  }

  // ---------- the tree ----------
  function node(key: string, kind: Node['kind'], title: string, parent: Node | undefined): Node {
    let n = nodes.get(key);
    if (n) return n;
    const li = clone('data-row') as HTMLLIElement;
    li.dataset.key = key;
    li.dataset.kind = kind;
    li.setAttribute('aria-level', String(kind === 'area' ? 1 : kind === 'group' ? 2 : 3));
    li.querySelector('.title')!.textContent = title;
    const children = li.querySelector<HTMLUListElement>('.children')!;
    if (kind === 'test') children.remove();
    n = { key, kind, li, ...(kind === 'test' ? {} : { children }), ...(parent ? { parent } : {}) };
    nodes.set(key, n);
    (parent?.children ?? tree).append(li);
    li.querySelector('.row')!.addEventListener('click', () => {
      follow = false;
      syncFollow();
      autoOpened.delete(key);
      toggle(n!);
      focus(n!);
    });
    if (open.has(key)) setOpen(n, true);
    if (!tree.querySelector('[tabindex="0"]')) li.tabIndex = 0;
    return n;
  }

  function setOpen(n: Node, on: boolean) {
    n.li.setAttribute('aria-expanded', String(on));
    if (n.children) n.children.hidden = !on;
    if (on) open.add(n.key);
    else open.delete(n.key);
    saveOpen();
    if (n.kind === 'test') {
      if (on) {
        n.detail ??= clone('data-detail');
        n.li.append(n.detail);
        drawDetail(n);
      } else n.detail?.remove();
    }
  }
  const toggle = (n: Node) => setOpen(n, n.li.getAttribute('aria-expanded') !== 'true');

  function reveal(key: string, openIt: boolean) {
    const n = nodes.get(key);
    if (!n) return;
    for (let p = n.parent; p; p = p.parent) if (p.li.getAttribute('aria-expanded') !== 'true') setOpen(p, true);
    if (openIt && n.li.getAttribute('aria-expanded') !== 'true') setOpen(n, true);
    n.li.scrollIntoView({ block: 'nearest' });
  }

  function setMark(el: Element, status: string) {
    const slot = el.querySelector(':scope > .row > .mark-slot, :scope > .step-row > .mark-slot, :scope > .mark-slot')!;
    if (slot.getAttribute('data-status') === status) return;
    slot.setAttribute('data-status', status);
    slot.replaceChildren(markOf(MARK[status as TestStatus] ?? 'queued'));
  }

  function renderTree(v: RunView) {
    const s = v.state;
    if (!s) return;
    const tests = s.order.map((id) => s.tests[id]);
    const groups = new Map<string, TestState[]>();
    for (const t of tests) {
      const area = areaOf(t.file);
      const a = node(`a:${area}`, 'area', area, undefined);
      const gTitle = t.path.slice(0, -1).join(' › ') || 'Tests';
      const g = node(`g:${area}|${gTitle}`, 'group', gTitle, a);
      const tn = node(`t:${t.id}`, 'test', t.path[t.path.length - 1], g);
      tn.testId = t.id;
      for (const k of [a.key, g.key]) groups.set(k, [...(groups.get(k) ?? []), t]);
      // a test's row
      setMark(tn.li, t.status);
      tn.li.querySelector('.status-word')!.textContent = WORD[t.status];
      const time = tn.li.querySelector<HTMLElement>('.time')!;
      if (t.status === 'running' && t.start) {
        time.dataset.from = String(t.start);
        if (t.timeout) time.dataset.limit = String(t.timeout);
      } else {
        delete time.dataset.from;
        delete time.dataset.limit;
        time.textContent = t.duration !== undefined ? clock(t.duration) : '';
      }
      tn.li.toggleAttribute('data-current', t.status === 'running');
      tn.li.hidden = !shows(t.status);
      if (tn.status !== t.status) details.delete(t.id);
      tn.status = t.status;
      if (tn.li.getAttribute('aria-expanded') === 'true') drawDetail(tn);
    }
    for (const [key, list] of groups) {
      const n = nodes.get(key)!;
      const failed = list.filter((t) => MARK[t.status] === 'failed').length;
      const running = list.some((t) => MARK[t.status] === 'running');
      const done = list.filter((t) => !['queued', 'running', 'retrying'].includes(t.status)).length;
      setMark(n.li, failed ? 'failed' : running ? 'running' : done === 0 ? 'queued' : done < list.length ? 'running' : list.some((t) => t.status === 'flaky') ? 'flaky' : 'passed');
      n.li.querySelector('.status-word')!.textContent = failed ? `${failed} failed` : running ? 'Running' : done === list.length ? 'Done' : 'Not run yet';
      n.li.querySelector('.meta')!.textContent = `${done} of ${list.length}`;
      n.li.hidden = !list.some((t) => shows(t.status));
      n.li.toggleAttribute('data-current', running);
    }
    // follow the running test: open its area and group, and show it (once each time it changes); the test it
    // opened before closes once it has passed, so following never leaves a trail (failures stay open)
    const current = v.now?.id;
    if (follow && current && current !== followed) {
      const before = followed && nodes.get(`t:${followed}`);
      if (before && autoOpened.has(before.key) && s.tests[followed]?.status === 'passed') setOpen(before, false);
      followed = current;
      const n = nodes.get(`t:${current}`);
      if (n && n.li.getAttribute('aria-expanded') !== 'true') autoOpened.add(n.key);
      reveal(`t:${current}`, true);
    }
  }

  const shows = (status: TestStatus) => filter === 'all' || (filter === 'failed' ? MARK[status] === 'failed' || status === 'flaky' : filter === 'running' ? MARK[status] === 'running' : status === 'queued');

  async function drawDetail(n: Node) {
    const s = view?.state;
    const t = s?.tests[n.testId!];
    if (!t || !n.detail) return;
    let full: TestState = t;
    // a test that went as expected keeps its steps in the run's log: fetched once
    if ((t.status === 'passed' || t.status === 'skipped' || t.status === 'flaky') && !t.steps.length) {
      const cached = details.get(t.id);
      if (cached) full = cached;
      else {
        details.set(t.id, t);
        const r = await fetch(`${BASE}/_edit/api/tests/runs/${encodeURIComponent(runId)}/tests/${encodeURIComponent(t.id)}`).catch(() => null);
        const d = r?.ok ? ((await r.json()) as { test: TestState }) : null;
        if (d?.test) details.set(t.id, d.test);
        full = d?.test ?? t;
      }
    }
    const d = n.detail;
    const v = view!.failures.find((f) => f.id === t.id)?.verdict;
    d.querySelector('.d-verdict')!.textContent = v ? VERDICT_WORDS[v] : WORD[t.status];
    d.querySelector('.d-times')!.textContent = [t.start && `Began at ${at(t.start)}`, t.duration !== undefined && `took ${clock(t.duration)}`, t.timeout && `its limit is ${clock(t.timeout)}`, t.retry && `retry ${t.retry}`, `${t.file}:${t.line}`].filter(Boolean).join(' · ');
    const err = d.querySelector<HTMLElement>('.d-error')!;
    err.hidden = !t.error;
    if (t.error) {
      d.querySelector('.d-message')!.textContent = t.error.message.split('\n')[0];
      d.querySelector('.d-snippet')!.textContent = t.error.snippet ?? t.error.message;
      d.querySelector('.d-where')!.textContent = t.error.file ? `At ${t.error.file}:${t.error.line}` : '';
    }
    const steps = d.querySelector<HTMLOListElement>(':scope > .steps')!;
    steps.replaceChildren(...full.steps.map(drawStep));
    if (!full.steps.length) steps.replaceChildren(textItem(t.status === 'queued' ? 'Not started yet.' : t.status === 'running' ? 'Starting…' : 'No steps recorded.'));
    const out = d.querySelector<HTMLElement>('.d-out')!;
    const outLabel = d.querySelector<HTMLElement>('.d-out-label')!;
    out.hidden = outLabel.hidden = !full.out.length;
    out.textContent = full.out.join('\n');
    const files = d.querySelector<HTMLElement>('.d-files')!;
    const filesLabel = d.querySelector<HTMLElement>('.d-files-label')!;
    const att = (full.attachments ?? t.attachments ?? []).filter((a) => a.path);
    files.hidden = filesLabel.hidden = !att.length;
    files.replaceChildren(...att.map((a) => textItem(`${a.name}: ${a.path}`)));
  }

  function textItem(text: string) {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  }

  function drawStep(s: StepState): HTMLElement {
    const li = clone('data-step');
    const running = s.end === undefined;
    setMark(li, s.error ? 'failed' : running ? 'running' : 'passed');
    li.toggleAttribute('data-open', running);
    li.toggleAttribute('data-error', !!s.error);
    li.querySelector('.step-title')!.textContent = s.error ? `${s.title}: ${s.error}` : s.title;
    li.querySelector('.step-count')!.textContent = s.count > 1 ? `${s.count} tries` : '';
    const time = li.querySelector<HTMLElement>('.step-time')!;
    if (running) {
      time.dataset.from = String(s.start);
      if (s.timeout) time.dataset.limit = String(s.timeout);
    } else time.textContent = clock((s.end ?? s.start) - s.start);
    li.querySelector<HTMLOListElement>('.steps')!.replaceChildren(...s.children.map(drawStep));
    return li;
  }

  // ---------- keys (the APG tree pattern) ----------
  const visible = () => [...tree.querySelectorAll<HTMLLIElement>('[role="treeitem"]')].filter((li) => li.offsetParent !== null);
  const nodeOf = (li: Element | null) => (li ? nodes.get((li as HTMLElement).dataset.key ?? '') : undefined);
  function focus(n: Node) {
    for (const li of tree.querySelectorAll<HTMLElement>('[tabindex="0"]')) li.tabIndex = -1;
    n.li.tabIndex = 0;
    n.li.focus({ preventScroll: false });
  }
  tree.addEventListener(
    'keydown',
    (e) => {
      const li = (e.target as HTMLElement).closest<HTMLLIElement>('[role="treeitem"]');
      const n = nodeOf(li);
      if (!n || !li) return;
      const list = visible();
      const i = list.indexOf(li);
      const go = (to: HTMLLIElement | undefined) => to && focus(nodeOf(to)!);
      const isOpen = li.getAttribute('aria-expanded') === 'true';
      const keys: Record<string, () => void> = {
        ArrowDown: () => go(list[i + 1]),
        ArrowUp: () => go(list[i - 1]),
        Home: () => go(list[0]),
        End: () => go(list[list.length - 1]),
        ArrowRight: () => (isOpen && n.children ? go(n.children.querySelector<HTMLLIElement>(':scope > [role="treeitem"]:not([hidden])') ?? undefined) : setOpen(n, true)),
        ArrowLeft: () => (isOpen ? setOpen(n, false) : n.parent && focus(n.parent)),
        Enter: () => toggle(n),
        ' ': () => toggle(n),
        '*': () => [...(n.parent?.children ?? tree).querySelectorAll<HTMLLIElement>(':scope > [role="treeitem"]')].forEach((x) => setOpen(nodeOf(x)!, true)),
      };
      const act = keys[e.key];
      if (!act) return;
      e.preventDefault();
      follow = false;
      syncFollow();
      act();
    },
    { signal },
  );

  // ---------- the actions ----------
  const followBtn = root.querySelector<HTMLElement>('[data-tests-follow]')!;
  const syncFollow = () => followBtn.setAttribute('aria-pressed', String(follow));
  syncFollow();
  followBtn.addEventListener(
    'click',
    () => {
      follow = !follow;
      followed = '';
      syncFollow();
    },
    { signal },
  );
  // scrolling away from the running test stops following it
  root.closest('main')?.addEventListener('wheel', () => follow && ((follow = false), syncFollow()), { signal, passive: true });
  root.querySelector('[data-tests-expand]')!.addEventListener('click', () => nodes.forEach((n) => n.kind !== 'test' && setOpen(n, true)), { signal });
  root.querySelector('[data-tests-collapse]')!.addEventListener('click', () => nodes.forEach((n) => setOpen(n, false)), { signal });
  for (const b of root.querySelectorAll<HTMLElement>('[data-filter]')) {
    b.setAttribute('aria-pressed', String(b.dataset.filter === filter));
    b.addEventListener(
      'click',
      () => {
        filter = b.dataset.filter!;
        for (const x of root.querySelectorAll<HTMLElement>('[data-filter]')) x.setAttribute('aria-pressed', String(x === b));
        if (view) renderTree(view);
      },
      { signal },
    );
  }
  root.querySelector('[data-tests-copy]')!.addEventListener(
    'click',
    async () => {
      if (!view) return;
      const v = view;
      const lines = [
        `${v.health.label}: ${v.active ? v.health.reason : v.summary}`,
        ...v.failures.map((f) => `- ${f.area} › ${f.path.join(' › ')} (${f.verdict})${f.message ? `: ${f.message}` : ''}`),
        `Run ${v.id} · ${v.worktree.main ? 'stable tree' : v.worktree.branch}${v.info.commit ? ` @ ${v.info.commit}` : ''}${v.info.purpose ? ` · ${v.info.purpose}` : ''}`,
      ];
      await navigator.clipboard?.writeText(lines.join('\n')).catch(() => undefined);
      say('Summary copied.');
    },
    { signal },
  );

  // ---------- announcements: failures, stalls and the end, once each ----------
  const say = (text: string) => {
    const el = $('announce');
    el.textContent = '';
    requestAnimationFrame(() => (el.textContent = text));
  };
  function announce(v: RunView) {
    const failures = new Set(v.failures.map((f) => f.id));
    const fresh = v.failures.filter((f) => !lastFailures.has(f.id));
    if (lastHealth && fresh.length) say(`Failed: ${fresh.map((f) => f.path[f.path.length - 1]).join('; ')}.`);
    if (lastHealth && v.health.state !== lastHealth && ['idle', 'silent', 'dead', 'failed', 'passed', 'stopped'].includes(v.health.state)) say(`${v.health.label}. ${v.health.reason}`);
    lastFailures = failures;
    lastHealth = v.health.state;
  }
}
