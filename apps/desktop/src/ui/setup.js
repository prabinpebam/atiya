// The first run's screens (documentation/desktop/spec.md §4.3), drawn from the main process's state.
const $ = (id) => document.getElementById(id);
const S = window.atiya.setup;

/** The ticks the person sees, from the machine's steps (spec §4.3). */
const TICKS = [
  ['Creating your site on GitHub', ['repository']],
  ['Saving your first pages', ['workspace', 'first-save']],
  ['Turning on publishing', ['publishing']],
  ['Opening edit mode', []],
];

let last = null;

function draw(app) {
  const s = app.setup;
  if (!s) return;
  last = s;
  for (const sec of document.querySelectorAll('[data-phase]')) sec.hidden = sec.dataset.phase !== s.phase;
  $('main').setAttribute('aria-busy', String(!!s.busy));
  for (const el of document.querySelectorAll('[data-error]')) el.textContent = s.error?.message ?? '';
  for (const b of document.querySelectorAll('button')) if (b.dataset.keep !== '1') b.disabled = !!s.busy && b.id !== 'copy-code';

  if (s.phase === 'code' && s.code) {
    $('user-code').textContent = s.code.userCode;
    const mins = Math.max(0, Math.round((s.code.expiresAt - Date.now()) / 60000));
    $('time-left').textContent = `This code works for ${mins} more ${mins === 1 ? 'minute' : 'minutes'}.`;
  }
  if (s.phase === 'site' && s.proposal) {
    const p = s.proposal;
    if (document.activeElement !== $('name')) $('name').value = p.name;
    if (document.activeElement !== $('repo')) $('repo').value = p.repo;
    $('address').textContent = p.url.replace(/^https:\/\//, '').replace(/\/$/, '');
    $('dir').textContent = p.dir;
    for (const r of document.querySelectorAll('input[name="explore"]')) r.checked = r.value === p.explore;
    $('samples').checked = p.samples;
    $('signed-in').textContent = s.user ? `Signed in to GitHub as ${s.user.login}` : '';
  }
  if (s.phase === 'choose-site') {
    const list = $('sites');
    list.replaceChildren(
      ...s.sites.map((site) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = `Open ${site.name}`;
        b.addEventListener('click', () => S.chooseSite(site.name));
        li.append(b);
        return li;
      }),
    );
    $('choose-lead').textContent = s.sites.length ? 'Choose the site to open on this computer.' : "This GitHub account has no Atiya sites yet. Go back and choose Make my site.";
  }
  if (s.phase === 'creating') {
    const editing = s.steps['first-save']?.state === 'done';
    $('ticks').replaceChildren(
      ...TICKS.map(([label, steps], i) => {
        const states = steps.map((k) => s.steps[k]?.state);
        const done = i === 3 ? editing : states.length > 0 && states.every((x) => x === 'done' || x === 'waiting');
        const failed = states.includes('failed');
        const doing = !done && !failed && (i === 3 ? s.steps['first-save']?.state === 'doing' : states.some((x) => x === 'doing' || x === 'checking'));
        const li = document.createElement('li');
        li.dataset.state = failed ? 'failed' : done ? 'done' : doing ? 'doing' : 'todo';
        li.textContent = label;
        const sr = document.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = failed ? ': stopped' : done ? ': done' : doing ? ': in progress' : '';
        li.append(sr);
        return li;
      }),
    );
  }
}

$('sign-in').addEventListener('click', () => S.signIn());
$('copy-code').addEventListener('click', () => S.copyCode());
$('open-github').addEventListener('click', () => S.openGitHub());
$('check-email').addEventListener('click', () => S.checkEmail());
$('email-settings').addEventListener('click', () => window.atiya.state().then((a) => window.atiya.openExternal(`${a.githubWeb}/settings/emails`)));
$('name').addEventListener('change', () => S.edit({ name: $('name').value }));
$('repo').addEventListener('change', () => S.edit({ repo: $('repo').value }));
$('samples').addEventListener('change', () => S.edit({ samples: $('samples').checked }));
for (const r of document.querySelectorAll('input[name="explore"]')) r.addEventListener('change', () => r.checked && S.edit({ explore: r.value }));
$('change-folder').addEventListener('click', () => S.chooseFolder());
$('create').addEventListener('click', async () => {
  // a name typed but not yet committed with Tab still counts
  if (last?.proposal && $('name').value !== last.proposal.name) await S.edit({ name: $('name').value });
  S.create();
});
$('retry').addEventListener('click', () => S.retry());
for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => S.back());

let shown = '';
/** Each screen, as it appears, takes the focus to its main button (else its heading), so the keyboard and a screen reader start there. */
function update(s) {
  draw(s);
  if (!s.setup || s.setup.phase === shown) return;
  shown = s.setup.phase;
  const heading = document.querySelector(`[data-phase="${shown}"] h1`);
  heading?.setAttribute('tabindex', '-1');
  (document.querySelector(`[data-phase="${shown}"] button.primary`) ?? heading)?.focus();
}
window.atiya.onState(update);
window.atiya.state().then(update);
