// The welcome (documentation/desktop/spec.md §4.3): Make my site, Open my existing site, and for
// developers, the checkout the app was started from (F12).
const $ = (id) => document.getElementById(id);

$('make').addEventListener('click', () => window.atiya.setup.start('new'));
$('existing').addEventListener('click', () => window.atiya.setup.start('existing'));
$('make').focus();

window.atiya.state().then((s) => {
  if (!s.suggested?.ok) return;
  $('developer').hidden = false;
  $('open-suggested').addEventListener('click', () => window.atiya.openWorkspace(s.suggested.path));
});
