// Why a site didn't publish, and Try again (documentation/desktop/spec.md §4.5).
const $ = (id) => document.getElementById(id);

function draw(s) {
  $('message').textContent = s.live?.message ?? '';
  if (s.live?.state !== 'failed') $('title').textContent = s.live?.state === 'live' ? 'Your site is live' : 'Publishing your site…';
  $('retry').hidden = s.live?.state !== 'failed';
}

$('retry').addEventListener('click', async () => {
  await window.atiya.setup.retryPublish();
  window.atiya.show('editor');
});
$('back').addEventListener('click', () => window.atiya.show('editor'));
window.atiya.onState(draw);
window.atiya.state().then(draw);
