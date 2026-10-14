// Set up private pages (documentation/desktop/spec.md §4.4, F8): one page, one choice, then the steps as
// they happen. The app runs the same machine as `atiya private setup`.
const $ = (id) => document.getElementById(id);

/** What each step is called on the page. */
const NAMES = { 'private-repository': 'A private repository', 'private-files': 'Its first files', 'build-key': "The build's key", submodule: 'Added to your site' };

/** @param {any} p the app's private pages state */
function draw(p) {
  $('main').setAttribute('aria-busy', String(!p || p.state === 'running'));
  if (!p) return;
  const summary =
    p.state === 'unavailable' ? 'Private pages are for a site made with Atiya Studio.'
    : p.state === 'ready' ? 'Your private pages are set up.'
    : p.state === 'running' ? 'Setting up your private pages…'
    : p.state === 'done' ? 'Private pages are ready. Edit mode starts again to bring them in.'
    : p.state === 'failed' ? `Private pages weren't set up. ${p.message ?? ''}`.trim()
    : 'Keep some pages for the people you choose.';
  if ($('summary').textContent !== summary) $('summary').textContent = summary;
  $('about').hidden = p.state !== 'idle' && p.state !== 'failed';
  $('go').hidden = p.state !== 'idle' && p.state !== 'failed';
  $('go').textContent = p.state === 'failed' ? 'Try again' : 'Set up private pages';
  $('done').hidden = p.state !== 'done' && p.state !== 'ready';
  $('back').hidden = p.state === 'done' || p.state === 'ready' || p.state === 'running';
  const steps = Object.entries(p.steps ?? {});
  $('steps').hidden = steps.length === 0;
  $('steps').replaceChildren(
    ...steps.map(([step, s]) => {
      const li = document.createElement('li');
      li.dataset.check = step;
      li.dataset.ok = String(s.state !== 'failed');
      li.dataset.state = s.state;
      const name = document.createElement('p');
      name.className = 'check-name';
      name.textContent = `${NAMES[step] ?? step}: ${s.state === 'done' ? 'done' : s.state === 'failed' ? 'needs you' : 'working'}`;
      const msg = document.createElement('p');
      msg.className = 'check-message';
      msg.textContent = s.message;
      li.append(name, msg);
      return li;
    }),
  );
}

$('go').addEventListener('click', () => window.atiya.privatePages.setUp());
$('done').addEventListener('click', () => window.atiya.privatePages.finish());
$('back').addEventListener('click', () => window.atiya.show('editor'));
window.atiya.onState((s) => draw(s.privatePages));
draw(await window.atiya.privatePages.state());
$('go').hidden || $('go').focus();
