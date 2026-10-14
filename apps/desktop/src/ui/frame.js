// The frame: the site's name, the dev server's state, and switching between edit mode and the site.
const $ = (id) => document.getElementById(id);

const WORDS = {
  idle: ['', 'idle'],
  checking: ['Starting edit mode…', 'busy'],
  starting: ['Starting edit mode…', 'busy'],
  ready: ['Edit mode ready', 'good'],
  external: ['Using the server already running', 'good'],
  restarting: ['Restarting edit mode…', 'busy'],
  failed: ['Edit mode stopped', 'bad'],
  'port-busy': ['Port in use', 'bad'],
  stopped: ['Edit mode stopped', 'bad'],
};

function draw(s) {
  $('site-name').textContent = s.workspace?.name ?? 'Atiya Studio';
  const state = s.server?.state ?? 'idle';
  const [words, tone] = WORDS[state] ?? ['', 'idle'];
  const el = $('state');
  if (el.textContent !== words) el.textContent = words;
  el.dataset.tone = tone;
  const up = state === 'ready' || state === 'external';
  $('views').hidden = !up;
  $('open-browser').hidden = !up;
  $('restart').hidden = !s.server || state === 'external';
  $('show-editor').setAttribute('aria-pressed', String(s.view === 'editor'));
  $('show-site').setAttribute('aria-pressed', String(s.view === 'site'));
}

$('show-editor').addEventListener('click', () => window.atiya.show('editor'));
$('show-site').addEventListener('click', () => window.atiya.show('site'));
$('open-browser').addEventListener('click', () => window.atiya.openInBrowser());
$('restart').addEventListener('click', () => window.atiya.restart());

window.atiya.onState(draw);
window.atiya.state().then(draw);
