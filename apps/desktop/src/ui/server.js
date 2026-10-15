// The body while edit mode isn't up: starting, restarting, a taken port, or stopped, with the log.
const $ = (id) => document.getElementById(id);

function draw(s) {
  const st = s.server?.state ?? 'idle';
  const port = s.server?.port;
  const secs = s.server?.nextInMs ? Math.round(s.server.nextInMs / 1000) : 0;
  const text = {
    idle: ['Starting edit mode…', ''],
    checking: ['Starting edit mode…', "The site's dev server is starting. The first start can take a minute."],
    starting: ['Starting edit mode…', "The site's dev server is starting. The first start can take a minute."],
    restarting: ['Edit mode stopped', `Starting it again in ${secs} ${secs === 1 ? 'second' : 'seconds'}…`],
    failed: ['Edit mode stopped', s.server?.message ?? ''],
    stopped: ['Edit mode stopped', 'Choose Restart to start it again.'],
    'port-busy': [`Port ${port} is in use`, `${s.server?.message ?? ''} If that's your site's dev server, use it. Otherwise stop it, then try again.`],
    ready: ['Edit mode is ready', ''],
    external: ['Edit mode is ready', ''],
  }[st] ?? ['', ''];
  if ($('title').textContent !== text[0]) $('title').textContent = text[0];
  $('message').textContent = text[1];
  // a path is for a source checkout's developer; a site the app made never shows one (spec §12)
  const developer = s.workspace?.kind === 'developer';
  $('folder').textContent = developer ? (s.workspace?.path ?? '') : '';
  $('restart').hidden = !(st === 'failed' || st === 'stopped');
  $('use').hidden = st !== 'port-busy';
  $('retry').hidden = st !== 'port-busy';
  $('other').hidden = !developer || !(st === 'failed' || st === 'port-busy' || st === 'stopped');
  const log = (s.server?.log ?? []).join('\n');
  if ($('log').textContent !== log) {
    $('log').textContent = log;
    $('log').scrollTop = $('log').scrollHeight;
  }
  if (st === 'failed') $('log-box').open = true;
}

$('restart').addEventListener('click', () => window.atiya.restart());
$('use').addEventListener('click', () => window.atiya.useExisting());
$('retry').addEventListener('click', () => window.atiya.restart());
$('other').addEventListener('click', () => window.atiya.chooseWorkspace());

window.atiya.onState(draw);
window.atiya.state().then(draw);
