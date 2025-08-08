function saveBookmark(url, title){
  try {
    const b = JSON.parse(localStorage.getItem('pp_bookmarks')||'[]');
    b.unshift({url:title?url:url, title:title||url, at:Date.now()});
    localStorage.setItem('pp_bookmarks', JSON.stringify(b.slice(0,200)));
  } catch {}
}
function getBookmarks(){ try { return JSON.parse(localStorage.getItem('pp_bookmarks')||'[]'); } catch { return []; } }
function openBookmarksModal(){
  const b = getBookmarks();
  if (!b.length) return alert('No bookmarks yet');
  const list = b.map(x=>x.title + ' — ' + x.url).join('\n');
  const pick = prompt('Bookmarks:\n' + list);
  if (pick) {
    const url = pick.split('—').pop().trim();
    openProxied(url);
  }
}
