const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const path = require("path");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const LRU = require("lru-cache");
const app = express();
const cache = new LRU({ max: 500, maxAge: 1000 * 60 * 5 });
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
app.use(helmet());
app.use(compression());
app.use(morgan("combined"));
app.use(limiter);
app.use(express.static(path.join(__dirname)));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/proxy", async (req, res) => {
  let { url } = req.query;
  if (!url) return res.status(400).send("No URL provided");
  if (!/^https?:\/\//i.test(url)) url = "http://" + url;
  const key = url;
  if (cache.has(key)) {
    const data = cache.get(key);
    res.setHeader("content-type", data.type);
    return res.send(data.body);
  }
  try {
    const upstream = await fetch(url, { headers: { "User-Agent": req.headers["user-agent"] } });
    const contentType = upstream.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const html = await upstream.text();
      const $ = cheerio.load(html, { decodeEntities: false });
      rewriteMeta($, url);
      rewriteAssets($, url);
      rewriteScripts($, url);
      rewriteStyles($, url);
      rewriteForms($, url);
      rewriteImports($, url);
      const wrapped = wrapShell($.html(), url);
      cache.set(key, { type: "text/html", body: wrapped });
      res.setHeader("content-type", "text/html");
      return res.send(wrapped);
    }
    if (contentType.includes("application/javascript")) {
      let js = await upstream.text();
      js = rewriteDynamicImports(js, url);
      cache.set(key, { type: "application/javascript", body: js });
      res.setHeader("content-type", "application/javascript");
      return res.send(js);
    }
    res.setHeader("content-type", contentType);
    return upstream.body.pipe(res);
  } catch (e) {
    return res.status(500).send(`<pre style="padding:20px;color:red;">Proxy Error: ${e.message}</pre>`);
  }
});
function toAbsolute(link, base) {
  if (!link) return null;
  if (link.startsWith("//")) return "http:" + link;
  if (/^https?:\/\//i.test(link)) return link;
  if (link.startsWith("/")) return new URL(base).origin + link;
  return new URL(link, base).href;
}
function rewriteMeta($, base) {
  $('meta[property="og:url"]').attr("content", base);
  $('link[rel="canonical"]').attr("href", base);
  $('base').remove();
}
function rewriteAssets($, base) {
  $("*[href], *[src]").each((i, el) => {
    ["href", "src"].forEach(attr => {
      const orig = $(el).attr(attr);
      const abs = toAbsolute(orig, base);
      if (abs) $(el).attr(attr, "/proxy?url=" + encodeURIComponent(abs));
    });
  });
}
function rewriteScripts($, base) {
  $('script[src]').each((i, el) => {
    const orig = $(el).attr("src");
    const abs = toAbsolute(orig, base);
    if (abs) $(el).attr("src", "/proxy?url=" + encodeURIComponent(abs));
  });
}
function rewriteStyles($, base) {
  $('link[rel="stylesheet"]').each((i, el) => {
    const orig = $(el).attr("href");
    const abs = toAbsolute(orig, base);
    if (abs) $(el).attr("href", "/proxy?url=" + encodeURIComponent(abs));
  });
  $('style').each((i, el) => {
    const css = $(el).html();
    const updated = css.replace(/url\(([^)]+)\)/g, (m, u) => {
      const clean = u.replace(/["']/g, "");
      const abs = toAbsolute(clean, base);
      return abs ? "url(/proxy?url=" + encodeURIComponent(abs) + ")" : m;
    });
    $(el).html(updated);
  });
}
function rewriteForms($, base) {
  $('form[action]').each((i, el) => {
    const orig = $(el).attr("action");
    const abs = toAbsolute(orig, base);
    if (abs) $(el).attr("action", "/proxy?url=" + encodeURIComponent(abs));
    $(el).attr("method", "get");
  });
}
function rewriteImports($, base) {
  $('script[type="module"]').each((i, el) => {
    const js = $(el).html();
    if (js) {
      const rep = js.replace(/import\((['"])(https?:\/\/.*?)\1\)/g, (m, q, u) => {
        return "import(" + q + "/proxy?url=" + encodeURIComponent(u) + q + ")";
      });
      $(el).html(rep);
    }
  });
}
function rewriteDynamicImports(js, base) {
  return js.replace(/import\((['"])(https?:\/\/.*?)\1\)/g, (m, q, u) => {
    return "import(" + q + "/proxy?url=" + encodeURIComponent(u) + q + ")";
  });
}
function wrapShell(content, url) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Proxy-o-Rama Pro</title>
<link rel="stylesheet" href="/style.css"/>
</head>
<body>
<div id="themeToggle" class="theme-toggle">🌗</div>
<header class="header">
  <div class="header-left">
    <span class="logo">Proxy-o-Rama Pro</span>
  </div>
  <div class="header-right">
    <span class="current-url">${url}</span>
  </div>
</header>
<div class="shell-content">${content}</div>
<footer class="footer">
  <p>&copy; 2025 Proxy-o-Rama Pro</p>
</footer>
<script>
(function(){
  var themeToggle = document.getElementById('themeToggle');
  themeToggle.addEventListener('click',function(){
    document.body.classList.toggle('light');
    if(document.body.classList.contains('light')){
      localStorage.setItem('theme','light');
    } else {
      localStorage.removeItem('theme');
    }
  });
  if(localStorage.getItem('theme')==='light'){
    document.body.classList.add('light');
  }
})();
</script>
</body>
</html>`;
}
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Proxy server running on port " + PORT);
});
