function rewriteCssUrls(cssText, baseUrl){
  return cssText.replace(/url\(([^)]+)\)/g, (m, p1) => {
    let v = p1.trim().replace(/^['"]|['"]$/g, '');
    try {
      const abs = new URL(v, baseUrl).toString();
      return `url("/proxy?url=${encodeURIComponent(abs)}")`;
    } catch { return m; }
  });
}
