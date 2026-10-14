// Check my site (documentation/desktop/spec.md §3 J8): the same checks as `atiya doctor`, each with its fix.
const $ = (id) => document.getElementById(id);

/** What each check is called on the page. */
const NAMES = { site: 'The site', 'atiya.json': 'Its settings', content: 'Its content', repository: 'On GitHub', saved: 'Saved', pushed: 'Saved to GitHub', built: 'Built', publishing: 'Publishing' };

async function run() {
  $('main').setAttribute('aria-busy', 'true');
  $('summary').textContent = 'Checking your site…';
  $('again').disabled = true;
  const r = await window.atiya.checkSite();
  $('again').disabled = false;
  $('main').setAttribute('aria-busy', 'false');
  if (!r) {
    $('summary').textContent = 'Check my site is for a site made with Atiya Studio.';
    return;
  }
  const problems = r.checks.filter((c) => !c.ok).length;
  $('summary').textContent = problems ? `${problems} ${problems === 1 ? 'thing needs' : 'things need'} you.` : 'Everything is in order.';
  $('checks').replaceChildren(
    ...r.checks.map((c) => {
      const li = document.createElement('li');
      li.dataset.check = c.check;
      li.dataset.ok = String(c.ok);
      const name = document.createElement('p');
      name.className = 'check-name';
      name.textContent = `${NAMES[c.check] ?? c.check}: ${c.ok ? 'ok' : 'needs you'}`;
      const msg = document.createElement('p');
      msg.className = 'check-message';
      msg.textContent = c.message + (c.fix ? ` ${c.fix}` : '');
      li.append(name, msg);
      if (c.url) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = 'Open the build on GitHub';
        b.addEventListener('click', () => window.atiya.openExternal(c.url));
        li.append(b);
      }
      return li;
    }),
  );
}

$('again').addEventListener('click', run);
$('back').addEventListener('click', () => window.atiya.show('editor'));
run();
