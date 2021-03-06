const nullLocationName = 'Outer space';

const list = document.querySelector('.list');

function nameEl(m) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = `https://github.com/${m.login}`;
  a.target = '_blank';
  a.innerText = m.name || m.login;
  li.appendChild(a);
  return li;
}

function locationEl(name, members) {
  const item = document.createElement('li');
  const title = document.createElement('div');
  title.innerText = name;
  item.appendChild(title);
  const ul = document.createElement('ul');
  members.forEach(m => {
    ul.appendChild(nameEl(m));
  });
  item.appendChild(ul);
  return item;
}

function membersList(members) {
  let grouped = members.reduce((acc, m) => {
    const key = m.location ? m.location.name : nullLocationName;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(m);
    return acc;
  }, {});

  Object.keys(grouped).forEach(k =>
    grouped[k].sort((a, b) => {
      if (a.name && b.name) {
        return a.name.toLowerCase() > b.name.toLowerCase();
      }
      if (a.name && !b.name) {
        return -1;
      }
      if (b.name && !a.name) {
        return 1;
      }
      return a.login > b.login;
    })
  );

  let locations = Object.keys(grouped).filter(l => l != nullLocationName);
  locations.sort((a, b) => grouped[a].length < grouped[b].length);
  locations.forEach(l => {
    list.appendChild(locationEl(l, grouped[l]));
  });
  list.appendChild(locationEl(nullLocationName, grouped[nullLocationName]));
}

const membersPromise = import('./members.json');

Promise.all([membersPromise, import('./earth')]).then(([members, Earth]) => {
  const earth = new Earth.default(document.querySelector('.earth'));
  earth.addMembers(members);
});

membersPromise.then(members => {
  membersList(members);
});
