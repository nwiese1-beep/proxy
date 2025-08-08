function openPrefsModal(){
  const mode = localStorage.getItem('pp_mode') || 'dark';
  const pick = prompt('Prefs\n1. Toggle theme\nCurrent: ' + mode + '\nType "toggle" to toggle');
  if (!pick) return;
  if (pick.toLowerCase() === 'toggle') {
    const next = mode === 'dark' ? 'light' : 'dark';
    localStorage.setItem('pp_mode', next);
    applyTheme(next);
    alert('Theme set to ' + next);
  }
}
