const DEMO_EMAIL = 'redteam@example.test';
const DEMO_PASSWORD = 'lab-pass-314';
const STORAGE_KEY = 'authorized-login-lab-records-v1';

const loginPanel = document.getElementById('login-panel');
const appPanel = document.getElementById('app-panel');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const recordsEl = document.getElementById('records');
const exportPreview = document.getElementById('export-preview');

let seedData = null;
let records = [];

async function loadSeed() {
  const res = await fetch('./data.json', { cache: 'no-store' });
  seedData = await res.json();
  const stored = localStorage.getItem(STORAGE_KEY);
  records = stored ? JSON.parse(stored) : structuredClone(seedData.records);
  persist();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  exportPreview.value = JSON.stringify({ synthetic: true, records }, null, 2);
}

function render() {
  recordsEl.innerHTML = '';
  records.forEach((record, index) => {
    const box = document.createElement('div');
    box.className = 'panel';

    const title = document.createElement('strong');
    title.textContent = `#${record.id}`;
    box.appendChild(title);

    const name = document.createElement('input');
    name.value = record.name;
    name.setAttribute('aria-label', `name-${record.id}`);
    box.appendChild(document.createElement('br'));
    box.appendChild(name);

    const role = document.createElement('input');
    role.value = record.role;
    role.setAttribute('aria-label', `role-${record.id}`);
    box.appendChild(document.createElement('br'));
    box.appendChild(role);

    const note = document.createElement('input');
    note.value = record.note;
    note.setAttribute('aria-label', `note-${record.id}`);
    box.appendChild(document.createElement('br'));
    box.appendChild(note);

    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'SAVE CHANGES';
    save.addEventListener('click', () => {
      records[index] = { ...record, name: name.value, role: role.value, note: note.value };
      persist();
      render();
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'DELETE RECORD';
    del.addEventListener('click', () => {
      records.splice(index, 1);
      persist();
      render();
    });

    box.appendChild(document.createElement('br'));
    box.appendChild(save);
    box.appendChild(document.createTextNode(' '));
    box.appendChild(del);
    recordsEl.appendChild(box);
  });
  persist();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    loginStatus.textContent = 'LOGIN FAILED — use the disposable demo account shown above.';
    return;
  }
  sessionStorage.setItem('authorized-login-lab-session', 'admin-test');
  await loadSeed();
  loginPanel.hidden = true;
  appPanel.hidden = false;
  render();
});

document.getElementById('reset-btn').addEventListener('click', async () => {
  if (!seedData) await loadSeed();
  records = structuredClone(seedData.records);
  persist();
  render();
});

document.getElementById('export-btn').addEventListener('click', () => {
  const payload = JSON.stringify({
    synthetic: true,
    exported_at: new Date().toISOString(),
    demo_token: seedData?.demo_token ?? null,
    records
  }, null, 2);
  exportPreview.value = payload;
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'authorized-login-lab-export.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem('authorized-login-lab-session');
  appPanel.hidden = true;
  loginPanel.hidden = false;
  loginStatus.textContent = 'Logged out.';
});
