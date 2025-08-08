function rewriteLinkToProxy(raw, base){
  if (!raw) return raw;
  if (/^\s*data:/i.test(raw) || /^\s*javascript:/i.test(raw) || /^\s*mailto:/i.test(raw) || /^\s*#/i.test(raw)) return raw;
  try {
    const abs = new URL(raw, base).toString();
    return '/proxy?url=' + encodeURIComponent(abs);
  } catch { return raw; }
}
