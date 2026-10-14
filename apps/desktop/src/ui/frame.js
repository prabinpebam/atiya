// The frame: the site's name, its state (the dev server's, then going live), and switching views.
const $ = (id) => document.getElementById(id);

const SERVER = {
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
const LIVE = { going: ['Going live: about 3 minutes', 'busy'], live: ['Live', 'good'], failed: ["Didn't publish", 'bad'] };

function draw(s) {
  $('site-name').textContent = s.workspace?.name ?? 'Atiya Studio';
  const state = s.server?.state ?? 'idle';
  const up = state === 'ready' || state === 'external';
  const [words, tone] = up && s.live ? LIVE[s.live.state] : SERVER[state] ?? ['', 'idle'];
  const el = $('state');
  if (el.textContent !== words) el.textContent = words;
  el.dataset.tone = tone;
  $('open-live').hidden = !(up && s.live?.state === 'live');
  $('see-why').hidden = !(up && s.live?.state === 'failed');
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
$('open-live').addEventListener('click', () => window.atiya.openLive());
$('see-why').addEventListener('click', () => window.atiya.show('publish'));

window.atiya.onState(draw);
window.atiya.state().then(draw);
