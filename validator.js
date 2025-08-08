function isValidUrl(s){
  if (!s) return false;
  try { new URL(s.startsWith('http')?s:'https://'+s); return true; } catch { return false; }
}
