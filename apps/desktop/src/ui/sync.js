// A page changed on two computers (documentation/desktop/spec.md §4.7): keep this one or the other, per resource.
const $ = (id) => document.getElementById(id);
/** @type {Record<string, 'mine' | 'theirs'>} */
const choices = {};
let total = 0;

function update() {
  const left = total - Object.keys(choices).length;
  $('go').disabled = left > 0;
  $('left').textContent = left ? `${left} still to choose.` : 'Ready.';
}

function draw(s) {
  const list = s.conflicts ?? [];
  total = list.length;
  $('conflicts').replaceChildren(
    ...list.map((c) => {
      const li = document.createElement('li');
      const group = document.createElement('fieldset');
      group.className = 'choice';
      const legend = document.createElement('legend');
      legend.className = 'check-name';
      legend.textContent = `${c.name}, changed here and on another computer`;
      group.append(legend);
      for (const [value, label] of [['mine', 'Keep this one'], ['theirs', 'Keep the other']]) {
        const l = document.createElement('label');
        const r = document.createElement('input');
        r.type = 'radio';
        r.name = c.file;
        r.value = value;
        r.checked = choices[c.file] === value;
        r.addEventListener('change', () => {
          choices[c.file] = value;
          update();
        });
        l.append(r, ` ${label}`);
        group.append(l);
      }
      li.append(group);
      return li;
    }),
  );
  update();
}

$('go').addEventListener('click', async () => {
  $('go').disabled = true;
  $('left').textContent = 'Bringing the two together…';
  await window.atiya.resolveSync(choices);
});
window.atiya.state().then(draw);
