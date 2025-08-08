const express = require("express");
const fetch = require("node-fetch");
const app = express();

app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send(`
    <form method="GET" action="/proxy">
      <input name="url" placeholder="Enter URL (with http://)" style="width: 300px" />
      <button>Go*</button>
    </form>
  `);
});

app.get("/proxy", async (req, res) => {
  let url = req.query.url;
  if (!url) return res.send("No URL provided*");

  if (!url.startsWith("http")) {
    url = "http://" + url;
  }

  try {
    const response = await fetch(url);
    let html = await response.text();

    // Rewrite href and src to route through proxy
    html = html.replace(/(href|src)="([^"]*)"/g, (match, attr, link) => {
      if (link.startsWith("http") || link.startsWith("https")) {
        return `${attr}="/proxy?url=${encodeURIComponent(link)}"`;
      } else if (link.startsWith("//")) {
        return `${attr}="/proxy?url=${encodeURIComponent("http:" + link)}"`;
      } else if (link.startsWith("/")) {
        const baseUrl = new URL(url);
        return `${attr}="/proxy?url=${encodeURIComponent(baseUrl.origin + link)}"`;
      }
      return match;
    });

    res.send(html);
  } catch (e) {
    res.send("Error fetching URL*");
  }
});

module.exports = app;
