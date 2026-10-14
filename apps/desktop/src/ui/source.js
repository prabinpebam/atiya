// Stage 1's welcome: open a checkout of the site's source (a developer workspace).
const $ = (id) => document.getElementById(id);

async function open(fn) {
  $('error').textContent = '';
  const r = await fn();
  if (r && !r.ok && !r.canceled) $('error').textContent = r.reason;
}

window.atiya.state().then((s) => {
  const sug = s.suggested;
  if (!sug) return;
  $('suggested').hidden = false;
  $('suggested-path').textContent = sug.path;
  if (sug.ok) {
    $('open-suggested').hidden = false;
    $('open-suggested').addEventListener('click', () => open(() => window.atiya.openWorkspace(sug.path)));
    $('open-suggested').focus();
  } else {
    $('suggested-reason').hidden = false;
    $('suggested-reason').textContent = sug.reason;
  }
});

$('choose').addEventListener('click', () => open(() => window.atiya.chooseWorkspace()));
