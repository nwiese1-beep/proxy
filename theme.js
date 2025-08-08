function applyTheme(mode){
  if (mode === 'light') {
    document.documentElement.style.setProperty('--bg', '#f4f6f8');
    document.documentElement.style.setProperty('--card', '#ffffff');
    document.documentElement.style.setProperty('--muted', '#333');
  } else {
    document.documentElement.style.setProperty('--bg', '#1f2226');
    document.documentElement.style.setProperty('--card', '#232629');
    document.documentElement.style.setProperty('--muted', '#bfc4c9');
  }
}
applyTheme(localStorage.getItem('pp_mode') || 'dark');
