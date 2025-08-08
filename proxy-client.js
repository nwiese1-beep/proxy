function proxiedUrlFor(raw){
  if (!raw) return null;
  try { const u = new URL(raw); return '/proxy?url=' + encodeURIComponent(u.toString()); } catch { return null; }
}
