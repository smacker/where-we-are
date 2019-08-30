const earth = new Earth(document.querySelector('.globe'));
const nullLocationName = 'Outer space';
const list = document.querySelector('.list');

function nameEl(m) {
  const li = document.createElement('li');
  li.innerText = m.name || m.login;
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

  let locations = Object.keys(grouped).filter(l => l != nullLocationName);
  locations.sort((a, b) => grouped[a].length < grouped[b].length);
  locations.forEach(l => list.appendChild(locationEl(l, grouped[l])));
  list.appendChild(locationEl(nullLocationName, grouped[nullLocationName]));
}

fetch('/members.json')
  .then(r => r.json())
  .then(members => {
    earth.addMembers(members);
    membersList(members);
  });
