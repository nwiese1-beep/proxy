const urlInput = document.getElementById('urlInput');
const goBtn = document.getElementById('goBtn');
const frame = document.getElementById('proxyFrame');
const historyBtn = document.getElementById('historyBtn');
const bookBtn = document.getElementById('bookBtn');
const prefsBtn = document.getElementById('prefsBtn');
goBtn.addEventListener('click', ()=> openFromInput());
urlInput.addEventListener('keydown', e=> { if (e.key === 'Enter') { e.preventDefault(); openFromInput(); }});
historyBtn.addEventListener('click', ()=> openHistoryModal());
bookBtn.addEventListener('click', ()=> openBookmarksModal());
prefsBtn.addEventListener('click', ()=> openPrefsModal());
function openFromInput(){ const v = urlInput.value.trim(); if (!v) return; openProxied(v); }
function openProxied(raw){ const t = norm(raw); if (!t) return alert('Invalid URL'); const prox = '/proxy?url=' + encodeURIComponent(t); frame.src = prox; saveHistory(t); }
function norm(u){ if (!u) return null; u = u.trim(); if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(u)) u = 'https://' + u; try { return new URL(u).toString(); } catch { return null; } }
window.openProxied = openProxied;
