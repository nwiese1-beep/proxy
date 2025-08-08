document.addEventListener('keydown', e=>{
  if (e.key === 'k' && (e.ctrlKey||e.metaKey)) {
    e.preventDefault();
    document.getElementById('urlInput').focus();
  }
  if (e.key === 'b' && (e.ctrlKey||e.metaKey)) {
    e.preventDefault();
    openBookmarksModal();
  }
});
