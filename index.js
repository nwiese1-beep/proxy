const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const path = require("path");

const app = express();

app.use(express.static(__dirname));

// Utility: Build absolute URL
function toAbsolute(link, base) {
  if (!link) return null;
  if (link.startsWith("//"))        return "http:" + link;
  if (link.startsWith("http://") ||
      link.startsWith("https://"))   return link;
  if (link.startsWith("/"))         return new URL(base).origin + link;
  return new URL(link, base).href;
}

// Rewrite assets to proxy
function rewriteAssets($, base) {
  $("*[href], *[src], script[type=module][src]").each((_, el) => {
    const attribs = ["href", "src"];
    attribs.forEach(attr => {
      const link = $(el).attr(attr);
      const absolute = toAbsolute(link, base);
      if (!absolute) return;
      // Bypass CDNs that break under proxy?
      $(el).attr(attr, `/proxy?url=${encodeURIComponent(absolute)}`);
    });
  });
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/proxy", async (req, res) => {
  let url = req.query.url;
  if (!url) return res.status(400).send("No URL provided");
  if (!/^https?:\/\//i.test(url)) url = "http://" + url;

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": req.headers["user-agent"] }
    });
    const contentType = upstream.headers.get("content-type") || "";

    // Non-HTML: stream directly
    if (!contentType.includes("text/html")) {
      res.set("Content-Type", contentType);
      return upstream.body.pipe(res);
    }

    // HTML: parse & rewrite
    const text = await upstream.text();
    const $ = cheerio.load(text, { decodeEntities: false });

    rewriteAssets($, url);

    // Wrap in our UI shell
    const proxied = `
      <script>
        // Dark/light toggle
        function toggleTheme() {
          document.body.classList.toggle("light");
          localStorage.theme = document.body.classList.contains("light") ? "light" : "dark";
        }
        window.onload = () => {
          if (localStorage.theme === "light") document.body.classList.add("light");
        }
      </script>
      <header class="shell-header">
        <div class="nav-left">
          <button onclick="toggleTheme()" class="theme-btn">🌗</button>
          <form action="/proxy" method="get" class="shell-search">
            <input
              name="url"
              type="text"
              placeholder="🔍 Enter URL"
              class="shell-input"
              />
            <button type="submit" class="shell-go">Go</button>
          </form>
        </div>
        <div class="nav-right">
          <span class="shell-badge">${url}</span>
        </div>
      </header>
      <main class="shell-main">
        ${$("html").html()}
      </main>`;

    res.send(proxied);
  } catch (err) {
    console.error(err);
    res.status(500).send(`
      <div style="font-family: sans-serif; 
                  padding: 2rem; text-align: center;">
        <h1>Proxy Error</h1>
        <pre>${err.message}</pre>
        <a href="/">← Back Home</a>
      </div>`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`[+] Proxy running: http://localhost:${PORT}`)
);
