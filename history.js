function saveHistory(url){
  try {
    const h = JSON.parse(localStorage.getItem('pp_history')||'[]');
    h.unshift({url:url, at: Date.now()});
    localStorage.setItem('pp_history', JSON.stringify(h.slice(0,50)));
  } catch(e){}
}
function getHistory(){ try { return JSON.parse(localStorage.getItem('pp_history')||'[]'); } catch { return []; } }
function openHistoryModal(){
  const items = getHistory();
  if (!items.length) return alert('No history yet');
  const list = items.slice(0,20).map(i=>i.url).join('\n');
  const pick = prompt('Recent urls (copy one to open):\n' + list);
  if (pick) openProxied(pick);
}
